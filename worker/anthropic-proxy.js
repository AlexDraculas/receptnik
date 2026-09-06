// Cloudflare Worker: the Cookly app's small server piece. Two jobs:
//
// 1) AI proxy (unchanged from before) — holds the real Anthropic API key
//    server-side and forwards the app's three AI features (dish search,
//    "add from link", cart cost estimate) to the Anthropic Messages API.
//    Route: POST / (the root path).
//
// 2) Accounts + cross-device sync (new) — email/password accounts with a
//    "forgot password" email-code flow, and a small per-account data store
//    (your recipes/cart/stats/profile) so logging in on another device shows
//    the same data. Routes: POST /auth/register, /auth/login,
//    /auth/request-reset, /auth/reset-password; GET and PUT /sync.
//
// Hardening pass (2026-09): rate limiting on every auth route, request-size
// caps, and length caps on user input — see the "abuse limits" section below
// for the reasoning. None of this claims to be unbreakable (nothing is) —
// the goal is to make scripted brute-force/spam/DoS attempts expensive
// enough to not be worth it, and to fail loudly (429) rather than silently.
//
// See DEPLOY.md in this folder for the exact setup steps (Cloudflare
// dashboard only, no command line needed).

const ANTHROPIC_VERSION = "2023-06-01";

// Always "*" — deliberately, not a bug. Echoing back the request's actual
// Origin header looks more "secure" but breaks for pages opened as a local
// file (file://), where browsers send a literal "Origin: null" and then
// refuse a response that echoes "null" back. Every route here gates access
// with its own token instead of relying on cookies/origin, so a wildcard is
// safe and works whether the site is opened locally or hosted anywhere.
// There's also no CSRF surface: nothing here uses cookies, so a third-party
// page can't ride the browser's ambient credentials — an attacker's page
// would have to already have the bearer token, at which point CORS is moot.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token, Authorization",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    // no-store: responses here can carry session tokens or account data —
    // never let a browser/proxy cache keep a copy around.
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

// ---------- small crypto helpers (all built on the Workers-native Web Crypto API — no npm packages, so this still deploys by pasting into the dashboard editor) ----------

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}
function randomHex(numBytes) {
  const arr = new Uint8Array(numBytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bufToHex(digest);
}
// Cloudflare Workers' PBKDF2 implementation caps out at 100000 iterations
// (a higher count throws "iteration counts above 100000 are not supported" at
// runtime) — this is the practical max on this platform, not a deliberate
// weakening; it's still a solid, standard PBKDF2-SHA256 work factor.
const PBKDF2_ITERATIONS = 100000;
async function hashPassword(password, saltHex) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBuf(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b64url(binaryStr) {
  return btoa(binaryStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const SESSION_DAYS = 30;
async function signToken(email, secret) {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
  const payloadB64 = b64url(payload);
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
  return payloadB64 + "." + sigB64;
}
async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const key = await hmacKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts[0]));
  const expectedSigB64 = b64url(String.fromCharCode(...new Uint8Array(expectedSig)));
  if (!timingSafeEqual(expectedSigB64, parts[1])) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(parts[0]));
  } catch (e) {
    return null;
  }
  if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;
  return payload.email;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return verifyToken(token, env.AUTH_SECRET);
}

// ---------- abuse limits: request size, input length, and rate limiting ----------
//
// Every one of these is "best-effort", not a formal guarantee — the honest
// framing (see the file header) is that this raises the cost of automated
// abuse enormously without claiming to be unbreakable:
//
// - Body size caps stop someone from POSTing a multi-MB junk body just to
//   waste CPU/KV-write bandwidth.
// - Length caps on email/password/code specifically stop someone from
//   sending a huge password string, which would make hashPassword() (real
//   CPU work, 100000 PBKDF2 rounds) far more expensive per request than
//   intended — a cheap way to burn a disproportionate amount of the
//   Worker's CPU budget per request otherwise.
// - Rate limiting is a fixed-window counter stored in the same KV namespace
//   as everything else, keyed by client IP (Cloudflare's own
//   CF-Connecting-IP header — set by Cloudflare's edge, not something a
//   client can forge) and, for login/reset, also by the target email so a
//   distributed attacker can't work around a per-IP cap by spreading
//   requests across many IPs at one victim account. It is NOT perfectly
//   atomic (KV reads-then-writes aren't transactional, so a very tight
//   concurrent burst could slip a few requests past the cap) — a fully
//   atomic limiter would need Durable Objects, which is more moving parts
//   than a personal-scale app like this needs. As a fixed window it also
//   allows a short burst right at the window boundary (a known, accepted
//   trade-off of fixed-window over sliding-window limiters). None of that
//   matters for stopping the realistic threat here — scripted brute-force
//   or spam tools that fire far more than a handful of requests a minute.

const MAX_AUTH_BODY = 8 * 1024; // 8 KB — generous for email+password+code JSON, tiny for anything else
const MAX_EMAIL_LEN = 254; // RFC 5321 practical limit
const MAX_PASSWORD_LEN = 128; // generous for any real password; blocks CPU-burning giant strings into PBKDF2
const MAX_CODE_LEN = 32; // real codes are 6 digits; this just blocks garbage before hashing it

async function readJsonBody(request, maxBytes) {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

const RATE_LIMITS = {
  register: { max: 8, windowSec: 600 }, // 8 registrations / 10 min / IP
  "login-ip": { max: 15, windowSec: 600 }, // 15 login attempts / 10 min / IP
  "login-email": { max: 8, windowSec: 600 }, // 8 login attempts / 10 min / target account
  "reset-request-ip": { max: 10, windowSec: 900 }, // 10 reset requests / 15 min / IP
  "reset-request-email": { max: 5, windowSec: 900 }, // 5 reset emails / 15 min / target account
  "reset-password-ip": { max: 20, windowSec: 900 }, // 20 code attempts / 15 min / IP — makes brute-forcing a
  // 6-digit code (1,000,000 possibilities) inside its own 15-min TTL statistically pointless
  "sync-put": { max: 60, windowSec: 60 }, // 60 syncs / min / account — way above normal debounced usage (~1/sec bursts)
  "ai-proxy": { max: 40, windowSec: 600 }, // 40 AI calls / 10 min / IP — generous for real interactive use (search/import/cart-cost), tight for a scripted cost-abuse loop
};

async function checkRateLimit(env, bucket, key) {
  const limit = RATE_LIMITS[bucket];
  if (!limit) return true;
  const kvKey = "rl:" + bucket + ":" + key;
  const raw = await env.RECEPTNIK_DATA.get(kvKey);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= limit.max) return false;
  await env.RECEPTNIK_DATA.put(kvKey, String(count + 1), { expirationTtl: limit.windowSec });
  return true;
}

// ---------- password-reset email, via Resend (https://resend.com — free, no domain needed as long as the app's account email is the same address you signed up to Resend with) ----------
async function sendResetEmail(env, toEmail, code) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.RESEND_API_KEY },
    body: JSON.stringify({
      from: "Cookly <onboarding@resend.dev>",
      to: [toEmail],
      subject: "Код за нова парола — Cookly",
      html:
        "<p>Ето кода за смяна на паролата ти в Cookly:</p>" +
        '<p style="font-size:28px; font-weight:800; letter-spacing:4px;">' + code + "</p>" +
        "<p>Кодът важи 15 минути. Ако не си поискал/а това, просто игнорирай имейла.</p>",
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error("Resend HTTP " + resp.status + (errText ? ": " + errText : ""));
  }
}

// ---------- routes ----------

async function handleRegister(request, env, cors) {
  const ip = clientIp(request);
  if (!(await checkRateLimit(env, "register", ip))) return json({ error: "rate-limited" }, 429, cors);

  const body = await readJsonBody(request, MAX_AUTH_BODY);
  if (!body) return json({ error: "invalid-json" }, 400, cors);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!isValidEmail(email) || email.length > MAX_EMAIL_LEN) return json({ error: "invalid-email" }, 400, cors);
  if (password.length < 8 || password.length > MAX_PASSWORD_LEN) return json({ error: "weak-password" }, 400, cors);

  const existing = await env.RECEPTNIK_DATA.get("user:" + email);
  if (existing) return json({ error: "email-taken" }, 409, cors);

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  await env.RECEPTNIK_DATA.put("user:" + email, JSON.stringify({ salt, passwordHash, createdAt: Date.now() }));
  await env.RECEPTNIK_DATA.put("data:" + email, JSON.stringify({ recipes: [], stats: null, profile: null, updatedAt: Date.now() }));

  const token = await signToken(email, env.AUTH_SECRET);
  return json({ token, email }, 200, cors);
}

async function handleLogin(request, env, cors) {
  const ip = clientIp(request);
  if (!(await checkRateLimit(env, "login-ip", ip))) return json({ error: "rate-limited" }, 429, cors);

  const body = await readJsonBody(request, MAX_AUTH_BODY);
  if (!body) return json({ error: "invalid-json" }, 400, cors);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (email.length > MAX_EMAIL_LEN || password.length > MAX_PASSWORD_LEN) return json({ error: "invalid-credentials" }, 400, cors);

  if (!(await checkRateLimit(env, "login-email", email))) return json({ error: "rate-limited" }, 429, cors);

  const raw = await env.RECEPTNIK_DATA.get("user:" + email);
  if (!raw) return json({ error: "invalid-credentials" }, 401, cors);
  const user = JSON.parse(raw);
  const attemptHash = await hashPassword(password, user.salt);
  if (!timingSafeEqual(attemptHash, user.passwordHash)) return json({ error: "invalid-credentials" }, 401, cors);

  const token = await signToken(email, env.AUTH_SECRET);
  return json({ token, email }, 200, cors);
}

async function handleRequestReset(request, env, cors) {
  const ip = clientIp(request);
  if (!(await checkRateLimit(env, "reset-request-ip", ip))) return json({ error: "rate-limited" }, 429, cors);

  const body = await readJsonBody(request, MAX_AUTH_BODY);
  if (!body) return json({ error: "invalid-json" }, 400, cors);
  const email = normalizeEmail(body.email);

  // Per-email limit fails "silently" (still ok:true) rather than 429 — so the
  // response never differs based on whether the email exists or has been
  // reset-spammed, preserving the no-enumeration property below.
  const emailOk = email.length <= MAX_EMAIL_LEN && (await checkRateLimit(env, "reset-request-email", email));

  if (emailOk) {
    const raw = await env.RECEPTNIK_DATA.get("user:" + email);
    if (raw) {
      const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
      const codeHash = await sha256Hex(code);
      await env.RECEPTNIK_DATA.put("reset:" + email, JSON.stringify({ codeHash }), { expirationTtl: 900 }); // 15 min
      try {
        await sendResetEmail(env, email, code);
      } catch (e) {
        return json({ error: "email-send-failed", detail: e.message }, 502, cors);
      }
    }
  }
  // Same response whether or not the account exists (or was rate-limited), so
  // the endpoint can't be used to check which emails are registered.
  return json({ ok: true }, 200, cors);
}

async function handleResetPassword(request, env, cors) {
  const ip = clientIp(request);
  if (!(await checkRateLimit(env, "reset-password-ip", ip))) return json({ error: "rate-limited" }, 429, cors);

  const body = await readJsonBody(request, MAX_AUTH_BODY);
  if (!body) return json({ error: "invalid-json" }, 400, cors);
  const email = normalizeEmail(body.email);
  const code = String(body.code || "").trim();
  const newPassword = String(body.newPassword || "");
  if (code.length > MAX_CODE_LEN) return json({ error: "invalid-or-expired-code" }, 400, cors);
  if (newPassword.length < 8 || newPassword.length > MAX_PASSWORD_LEN) return json({ error: "weak-password" }, 400, cors);

  const rawReset = await env.RECEPTNIK_DATA.get("reset:" + email);
  if (!rawReset) return json({ error: "invalid-or-expired-code" }, 400, cors);
  const reset = JSON.parse(rawReset);
  const codeHash = await sha256Hex(code);
  if (!timingSafeEqual(codeHash, reset.codeHash)) return json({ error: "invalid-or-expired-code" }, 400, cors);

  const rawUser = await env.RECEPTNIK_DATA.get("user:" + email);
  if (!rawUser) return json({ error: "invalid-or-expired-code" }, 400, cors);
  const user = JSON.parse(rawUser);
  const salt = randomHex(16);
  user.passwordHash = await hashPassword(newPassword, salt);
  user.salt = salt;
  await env.RECEPTNIK_DATA.put("user:" + email, JSON.stringify(user));
  await env.RECEPTNIK_DATA.delete("reset:" + email);

  const token = await signToken(email, env.AUTH_SECRET);
  return json({ token, email }, 200, cors);
}

async function handleGetSync(request, env, cors) {
  const email = await requireAuth(request, env);
  if (!email) return json({ error: "unauthorized" }, 401, cors);
  const raw = await env.RECEPTNIK_DATA.get("data:" + email);
  const data = raw ? JSON.parse(raw) : { recipes: [], stats: null, profile: null, updatedAt: null };
  return json(data, 200, cors);
}

const MAX_SYNC_BODY = 3 * 1024 * 1024; // 3 MB — generous for recipes/stats/profile JSON, small enough to block abuse
async function handlePutSync(request, env, cors) {
  const email = await requireAuth(request, env);
  if (!email) return json({ error: "unauthorized" }, 401, cors);
  if (!(await checkRateLimit(env, "sync-put", email))) return json({ error: "rate-limited" }, 429, cors);
  const text = await request.text();
  if (text.length > MAX_SYNC_BODY) return json({ error: "payload-too-large" }, 413, cors);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: "invalid-json" }, 400, cors); }
  const data = {
    recipes: Array.isArray(body.recipes) ? body.recipes : [],
    stats: body.stats || null,
    profile: body.profile || null,
    updatedAt: Date.now(),
  };
  await env.RECEPTNIK_DATA.put("data:" + email, JSON.stringify(data));
  return json({ ok: true, updatedAt: data.updatedAt }, 200, cors);
}

// ---------- the AI proxy ----------
//
// X-App-Token is NOT a real secret — it lives in plain sight in the client
// JS bundle (js/core/api.js), which is served from a public repo. It only
// ever stopped drive-by scanners hitting the bare URL, never a person who
// actually reads the app's own source. Without anything past that check,
// anyone who copies the token can call api.anthropic.com through this Worker
// with Aleks's real ANTHROPIC_API_KEY, with no cap on cost, model, or volume
// — this is the same class of risk as the AUTH_SECRET leak, just against
// the API bill instead of accounts. The checks below don't try to replace a
// real per-user auth system (this proxy is intentionally anonymous, same as
// before); they cap it to the shape the app itself actually sends, so a
// scraped token is only as useful as the app's own three real AI features.
const MAX_AI_BODY = 20 * 1024; // generous for a search/cart-cost prompt with a full ingredient list
const MAX_AI_TOKENS = 1500; // every real call site asks for 1000
const ALLOWED_AI_MODELS = ["claude-sonnet-5"]; // the only model the app ever requests
const ALLOWED_AI_TOOL_TYPES = ["web_search_20250305"]; // the only tool the app ever requests

function validateAiRequest(parsed) {
  if (!parsed || typeof parsed !== "object") return "invalid-request";
  if (ALLOWED_AI_MODELS.indexOf(parsed.model) === -1) return "invalid-request";
  if (typeof parsed.max_tokens !== "number" || parsed.max_tokens <= 0 || parsed.max_tokens > MAX_AI_TOKENS) return "invalid-request";
  if (!Array.isArray(parsed.messages) || parsed.messages.length === 0 || parsed.messages.length > 10) return "invalid-request";
  if (parsed.tools !== undefined) {
    if (!Array.isArray(parsed.tools) || parsed.tools.length > 1) return "invalid-request";
    if (parsed.tools.some((tool) => ALLOWED_AI_TOOL_TYPES.indexOf(tool && tool.type) === -1)) return "invalid-request";
  }
  return null;
}

async function handleAiProxy(request, env, cors) {
  if (env.APP_TOKEN && request.headers.get("X-App-Token") !== env.APP_TOKEN) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }
  if (!env.ANTHROPIC_API_KEY) {
    return new Response("Server misconfigured: ANTHROPIC_API_KEY secret not set", { status: 500, headers: cors });
  }
  const ip = clientIp(request);
  if (!(await checkRateLimit(env, "ai-proxy", ip))) return json({ error: "rate-limited" }, 429, cors);

  const body = await readJsonBody(request, MAX_AI_BODY);
  if (body === null) {
    return new Response("Invalid JSON body", { status: 400, headers: cors });
  }
  const validationError = validateAiRequest(body);
  if (validationError) {
    return json({ error: validationError }, 400, cors);
  }
  const bodyText = JSON.stringify(body);
  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: bodyText,
    });
  } catch (e) {
    return new Response("Upstream request failed: " + e.message, { status: 502, headers: cors });
  }
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "Content-Type": "application/json", ...cors } });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders();
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const path = new URL(request.url).pathname.replace(/\/+$/, ""); // strip trailing slash(es)

    // Accounts + sync routes need their own KV/secret setup — see DEPLOY.md.
    // They're kept out of the way of the (unauthenticated-by-account) AI proxy below.
    if (path === "/auth/register" && request.method === "POST") return handleRegister(request, env, cors);
    if (path === "/auth/login" && request.method === "POST") return handleLogin(request, env, cors);
    if (path === "/auth/request-reset" && request.method === "POST") return handleRequestReset(request, env, cors);
    if (path === "/auth/reset-password" && request.method === "POST") return handleResetPassword(request, env, cors);
    if (path === "/sync" && request.method === "GET") return handleGetSync(request, env, cors);
    if (path === "/sync" && request.method === "PUT") return handlePutSync(request, env, cors);
    if (path.startsWith("/auth/") || path === "/sync") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    if (path === "" || path === "/") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
      return handleAiProxy(request, env, cors);
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
