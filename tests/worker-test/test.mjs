// Local test harness: loads the worker's fetch handler and exercises the new
// auth/sync routes against an in-memory KV mock + a mocked fetch for Resend,
// without touching real Cloudflare or sending a real email.

import worker from "../../worker/anthropic-proxy.js";

// --- in-memory KV mock (mimics the bits of the Workers KV API we use) ---
class FakeKV {
  constructor() { this.store = new Map(); }
  async get(key) { return this.store.has(key) ? this.store.get(key) : null; }
  async put(key, value) { this.store.set(key, value); }
  async delete(key) { this.store.delete(key); }
}

const env = {
  APP_TOKEN: "test-app-token",
  ANTHROPIC_API_KEY: "sk-ant-fake",
  AUTH_SECRET: "test-auth-secret-please-ignore",
  RESEND_API_KEY: "test-resend-key",
  RECEPTNIK_DATA: new FakeKV(),
};

// --- mock global fetch so we don't hit the real internet ---
const realFetch = global.fetch;
let lastResendCall = null;
global.fetch = async (url, opts) => {
  if (String(url).startsWith("https://api.resend.com")) {
    lastResendCall = { url, opts, body: JSON.parse(opts.body) };
    return new Response(JSON.stringify({ id: "fake-email-id" }), { status: 200 });
  }
  if (String(url).startsWith("https://api.anthropic.com")) {
    return new Response(JSON.stringify({ type: "message", content: [{ type: "text", text: "hi" }] }), { status: 200 });
  }
  throw new Error("unexpected fetch to " + url);
};

function req(path, opts = {}) {
  return new Request("https://recipe-ai-proxy.example.workers.dev" + path, opts);
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); failures++; }
  else console.log("ok:", msg);
}

async function main() {
  // 1. Register
  let res = await worker.fetch(req("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "Test@Example.com", password: "correcthorse123" }),
  }), env);
  let data = await res.json();
  assert(res.status === 200, "register returns 200");
  assert(!!data.token, "register returns a token");
  assert(data.email === "test@example.com", "register normalizes email to lowercase");
  const token = data.token;

  // 2. Duplicate register should 409
  res = await worker.fetch(req("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "anotherpassword1" }),
  }), env);
  assert(res.status === 409, "duplicate register returns 409");

  // 3. Login with wrong password should 401
  res = await worker.fetch(req("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "wrongpassword" }),
  }), env);
  assert(res.status === 401, "login with wrong password returns 401");

  // 4. Login with correct password should succeed
  res = await worker.fetch(req("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "correcthorse123" }),
  }), env);
  data = await res.json();
  assert(res.status === 200 && !!data.token, "login with correct password returns a token");

  // 5. GET /sync without token should 401
  res = await worker.fetch(req("/sync", { method: "GET" }), env);
  assert(res.status === 401, "GET /sync without Authorization header returns 401");

  // 6. GET /sync with token should return empty data for a fresh account
  res = await worker.fetch(req("/sync", { method: "GET", headers: { Authorization: "Bearer " + token } }), env);
  data = await res.json();
  assert(res.status === 200, "GET /sync with valid token returns 200");
  assert(Array.isArray(data.recipes) && data.recipes.length === 0, "fresh account has empty recipes");

  // 7. PUT /sync should store data, and GET should return it back
  const payload = { recipes: [{ id: "r1", name: "Test Recipe" }], stats: { streak: 3 }, profile: { name: "Aleks" } };
  res = await worker.fetch(req("/sync", {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }), env);
  assert(res.status === 200, "PUT /sync returns 200");

  res = await worker.fetch(req("/sync", { method: "GET", headers: { Authorization: "Bearer " + token } }), env);
  data = await res.json();
  assert(data.recipes.length === 1 && data.recipes[0].name === "Test Recipe", "GET /sync round-trips PUT data");
  assert(data.stats.streak === 3, "GET /sync round-trips stats");
  assert(data.profile.name === "Aleks", "GET /sync round-trips profile");

  // 8. Tampered token should be rejected
  const tampered = token.slice(0, -1) + (token.slice(-1) === "a" ? "b" : "a");
  res = await worker.fetch(req("/sync", { method: "GET", headers: { Authorization: "Bearer " + tampered } }), env);
  assert(res.status === 401, "tampered token is rejected");

  // 9. Request password reset — should call Resend and store a reset code
  res = await worker.fetch(req("/auth/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com" }),
  }), env);
  data = await res.json();
  assert(res.status === 200 && data.ok === true, "request-reset returns ok");
  assert(!!lastResendCall, "request-reset actually called the Resend API");
  assert(lastResendCall.body.to[0] === "test@example.com", "reset email addressed to the account's email");
  const emailHtml = lastResendCall.body.html;
  const codeMatch = emailHtml.match(/(\d{6})/);
  assert(!!codeMatch, "reset email contains a 6-digit code");
  const code = codeMatch[1];

  // 10. request-reset for a NON-existent account should still return ok:true (no user enumeration) and NOT call Resend again
  lastResendCall = null;
  res = await worker.fetch(req("/auth/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com" }),
  }), env);
  data = await res.json();
  assert(res.status === 200 && data.ok === true, "request-reset for unknown email still returns ok:true");
  assert(lastResendCall === null, "request-reset for unknown email does NOT send an email");

  // 11. Reset with wrong code should fail
  res = await worker.fetch(req("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", code: "000000", newPassword: "brandnewpassword1" }),
  }), env);
  assert(res.status === 400, "reset with wrong code returns 400");

  // 12. Reset with correct code should succeed and issue a new token
  res = await worker.fetch(req("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", code, newPassword: "brandnewpassword1" }),
  }), env);
  data = await res.json();
  assert(res.status === 200 && !!data.token, "reset with correct code succeeds and returns a token");

  // 13. Old password should no longer work; new password should
  res = await worker.fetch(req("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "correcthorse123" }),
  }), env);
  assert(res.status === 401, "old password rejected after reset");

  res = await worker.fetch(req("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "brandnewpassword1" }),
  }), env);
  assert(res.status === 200, "new password works after reset");

  // 14. The reset code should be single-use (consumed)
  res = await worker.fetch(req("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", code, newPassword: "yetanotherpassword1" }),
  }), env);
  assert(res.status === 400, "reused reset code is rejected");

  // 15. Existing AI-proxy route (root) should still work as before, gated by X-App-Token,
  // using the exact shape the real app sends (search.js/cart.js): model, max_tokens:1000,
  // a non-empty messages array, and (optionally) the single web_search tool.
  const validAiBody = {
    model: "claude-sonnet-5",
    max_tokens: 1000,
    messages: [{ role: "user", content: "hello" }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  };
  res = await worker.fetch(req("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validAiBody),
  }), env);
  assert(res.status === 403, "root AI-proxy route still requires X-App-Token (rejects without it)");

  res = await worker.fetch(req("/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Token": "test-app-token" },
    body: JSON.stringify(validAiBody),
  }), env);
  assert(res.status === 200, "root AI-proxy route works with correct X-App-Token and a request shaped like the real app's");

  // 16. AI-proxy request validation — only the shape the app itself ever sends is allowed through
  async function aiReq(overrides, ip) {
    return worker.fetch(req("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Token": "test-app-token", "CF-Connecting-IP": ip || "203.0.113.50" },
      body: JSON.stringify({ ...validAiBody, ...overrides }),
    }), env);
  }
  res = await aiReq({ model: "claude-opus-4" }, "203.0.113.51");
  assert(res.status === 400, "AI-proxy rejects a model outside the allowlist");

  res = await aiReq({ max_tokens: undefined }, "203.0.113.52");
  assert(res.status === 400, "AI-proxy rejects a missing max_tokens");

  res = await aiReq({ max_tokens: 50000 }, "203.0.113.53");
  assert(res.status === 400, "AI-proxy rejects a max_tokens above the server-side cap");

  res = await aiReq({ messages: [] }, "203.0.113.54");
  assert(res.status === 400, "AI-proxy rejects an empty messages array");

  res = await aiReq({ tools: [{ type: "some_other_tool" }] }, "203.0.113.55");
  assert(res.status === 400, "AI-proxy rejects a tool type outside the allowlist");

  res = await worker.fetch(req("/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Token": "test-app-token", "CF-Connecting-IP": "203.0.113.56" },
    body: "x".repeat(30 * 1024),
  }), env);
  assert(res.status === 400, "an oversized AI-proxy body (>20KB) is rejected with 400, never forwarded upstream");

  // 17. AI-proxy per-IP rate limit (40/10min) — same fixed-window IP the whole time
  const aiLimitIp = "203.0.113.60";
  for (let i = 0; i < 40; i++) {
    res = await aiReq({}, aiLimitIp);
    assert(res.status === 200, `AI-proxy call #${i + 1} under the per-IP limit succeeds`);
  }
  res = await aiReq({}, aiLimitIp);
  assert(res.status === 429, "AI-proxy call beyond the per-IP limit is rejected with 429");

  // 16. Weak password rejected on register
  res = await worker.fetch(req("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "weak@example.com", password: "short" }),
  }), env);
  assert(res.status === 400, "register rejects a too-short password");

  // 17. Unknown route
  res = await worker.fetch(req("/nope", { method: "GET" }), env);
  assert(res.status === 404, "unknown route returns 404");

  // ---- hardening: rate limiting + input-size caps ----
  // Each block below uses its own fake CF-Connecting-IP so it doesn't share a
  // rate-limit bucket with the "unknown"-IP calls above.

  // 18. Register is rate-limited per IP (limit is 8/10min in the worker)
  {
    const ip = "198.51.100.10";
    let lastStatus = 0;
    for (let i = 0; i < 9; i++) {
      const r = await worker.fetch(req("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
        body: JSON.stringify({ email: "ratelimit" + i + "@example.com", password: "correcthorse123" }),
      }), env);
      lastStatus = r.status;
      if (i < 8) assert(r.status === 200, "register #" + (i + 1) + " under the limit succeeds");
    }
    assert(lastStatus === 429, "register beyond the per-IP limit is rejected with 429");
  }

  // 19. Login is rate-limited per target email (limit is 8/10min), independent of IP
  {
    // First register a fresh account to attack.
    await worker.fetch(req("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.20" },
      body: JSON.stringify({ email: "loginlimit@example.com", password: "correcthorse123" }),
    }), env);
    let lastStatus = 0;
    for (let i = 0; i < 9; i++) {
      // Different IP each time — proves the limit is following the target
      // account, not just the source IP (guards against distributed guessing).
      const r = await worker.fetch(req("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100." + (30 + i) },
        body: JSON.stringify({ email: "loginlimit@example.com", password: "wrongpassword" }),
      }), env);
      lastStatus = r.status;
      if (i < 8) assert(r.status === 401, "login attempt #" + (i + 1) + " under the per-account limit returns 401 (wrong password)");
    }
    assert(lastStatus === 429, "login attempts beyond the per-account limit are rejected with 429, even from a fresh IP each time");
  }

  // 20. request-reset is rate-limited per IP, and returns ok:true either way (no enumeration leak from rate limiting itself)
  {
    const ip = "198.51.100.40";
    let lastStatus = 0, lastBody = null;
    for (let i = 0; i < 11; i++) {
      const r = await worker.fetch(req("/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
        body: JSON.stringify({ email: "someone" + i + "@example.com" }),
      }), env);
      lastStatus = r.status;
      lastBody = await r.json();
    }
    assert(lastStatus === 429, "request-reset beyond the per-IP limit is rejected with 429");
    assert(lastBody.error === "rate-limited", "the 429 body is a normal JSON error, not a generic failure");
  }

  // 21. Oversized auth body is rejected before it's parsed
  {
    const hugePassword = "x".repeat(20000);
    const r = await worker.fetch(req("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.50" },
      body: JSON.stringify({ email: "huge@example.com", password: hugePassword }),
    }), env);
    assert(r.status === 400, "an oversized register body (>8KB) is rejected with 400, not processed");
  }

  // 22. Overly long (but small-enough-body) password is rejected without ever reaching PBKDF2
  {
    const longPassword = "x".repeat(200); // small body, but over MAX_PASSWORD_LEN (128)
    const r = await worker.fetch(req("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.51" },
      body: JSON.stringify({ email: "longpw@example.com", password: longPassword }),
    }), env);
    assert(r.status === 400, "a password over the length cap is rejected as weak-password");
  }

  // 23. Recipe sharing — create, then read it back publicly (no auth, no X-App-Token needed)
  const validShareRecipe = {
    name: "Гарлик пармезан бомбички с кайма",
    description: "Топки кайма с чеснов сос",
    cuisine: "Италианска",
    style: "Печене",
    difficulty: "easy",
    time: "35 мин",
    ingredients: ["500g кайма", "2 скилидки чесън", "пармезан"],
    steps: [
      { text: "Смеси каймата", timer: null },
      { text: "Изпечи 20 мин", timer: { seconds: 1200, type: "bake", label: "Печене", message: "Извади фурмата" } },
    ],
  };
  let shareId;
  {
    const r = await worker.fetch(req("/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
      body: JSON.stringify(validShareRecipe),
    }), env);
    const body = await r.json();
    assert(r.status === 200, "creating a share returns 200");
    assert(typeof body.id === "string" && body.id.length > 0, "creating a share returns an id");
    shareId = body.id;
  }

  // 24. Reading back a shared recipe by id is public — no auth header, no X-App-Token
  {
    const r = await worker.fetch(req("/share/" + shareId, {
      method: "GET",
      headers: { "CF-Connecting-IP": "203.0.113.11" }, // deliberately a different IP than the creator
    }), env);
    const body = await r.json();
    assert(r.status === 200, "reading a shared recipe by id returns 200");
    assert(body.name === validShareRecipe.name, "shared recipe name round-trips");
    assert(Array.isArray(body.ingredients) && body.ingredients.length === 3, "shared recipe ingredients round-trip");
    assert(body.steps.length === 2 && body.steps[1].timer && body.steps[1].timer.seconds === 1200, "shared recipe steps (incl. timer) round-trip");
  }

  // 25. Reading a nonexistent share id returns 404, not a crash
  {
    const r = await worker.fetch(req("/share/" + "0".repeat(18), {
      method: "GET",
      headers: { "CF-Connecting-IP": "203.0.113.12" },
    }), env);
    const body = await r.json();
    assert(r.status === 404, "reading an unknown share id returns 404");
    assert(body.error === "not-found", "unknown share id returns a not-found error body");
  }

  // 26. A share id with characters outside the expected hex shape is rejected as not-found, never reaches KV.get with attacker-controlled key shape
  {
    const r = await worker.fetch(req("/share/" + encodeURIComponent("../user:test@example.com"), {
      method: "GET",
      headers: { "CF-Connecting-IP": "203.0.113.13" },
    }), env);
    assert(r.status === 404, "a non-hex share id is rejected with 404");
  }

  // 27. Creating a share with an invalid body (missing name) is rejected with 400
  {
    const r = await worker.fetch(req("/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.14" },
      body: JSON.stringify({ ingredients: ["x"], steps: [{ text: "y" }] }),
    }), env);
    const body = await r.json();
    assert(r.status === 400, "creating a share without a name is rejected with 400");
    assert(body.error === "invalid-request", "invalid share body returns invalid-request");
  }

  // 27b. Creating a share with a malformed step timer (e.g. a bare number instead of the real {seconds,...} shape) is rejected with 400
  {
    const r = await worker.fetch(req("/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.141" },
      body: JSON.stringify({ ...validShareRecipe, steps: [{ text: "y", timer: 1200 }] }),
    }), env);
    assert(r.status === 400, "a step timer that isn't the real {seconds,type,label,message} object shape is rejected with 400");
  }

  // 28. Creating a share with an oversized body (>20KB) is rejected with 400
  {
    const hugeIngredient = "x".repeat(30000);
    const r = await worker.fetch(req("/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.15" },
      body: JSON.stringify({ ...validShareRecipe, description: hugeIngredient }),
    }), env);
    assert(r.status === 400, "an oversized share body (>20KB) is rejected with 400");
  }

  // 29. share-create per-IP rate limit (20/10min) — same fixed-window IP the whole time
  {
    const ip = "203.0.113.16";
    let lastStatus;
    for (let i = 0; i < 21; i++) {
      const r = await worker.fetch(req("/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
        body: JSON.stringify(validShareRecipe),
      }), env);
      lastStatus = r.status;
    }
    assert(lastStatus === 429, "share creation beyond the per-IP limit (20/10min) is rejected with 429");
  }

  // 30. share-read per-IP rate limit (120/10min) — same fixed-window IP the whole time
  {
    const ip = "203.0.113.17";
    let lastStatus;
    for (let i = 0; i < 121; i++) {
      const r = await worker.fetch(req("/share/" + shareId, {
        method: "GET",
        headers: { "CF-Connecting-IP": ip },
      }), env);
      lastStatus = r.status;
    }
    assert(lastStatus === 429, "reading shares beyond the per-IP limit (120/10min) is rejected with 429");
  }

  global.fetch = realFetch;
  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
