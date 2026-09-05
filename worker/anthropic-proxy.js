// Cloudflare Worker: the Рецептник app's small server piece. Two jobs:
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
// See DEPLOY.md in this folder for the exact setup steps (Cloudflare
// dashboard only, no command line needed).

const ANTHROPIC_VERSION = "2023-06-01";

// Always "*" — deliberately, not a bug. Echoing back the request's actual
// Origin header looks more "secure" but breaks for pages opened as a local
// file (file://), where browsers send a literal "Origin: null" and then
// refuse a response that echoes "null" back. Every route here gates access
// with its own token instead of relying on cookies/origin, so a wildcard is
// safe and works whether the site is opened locally or hosted anywhere.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token, Authorization",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...cors },
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
const PBKDF2_ITERATIONS = 150000;
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

// ---------- password-reset email, via Resend (https://resend.com — free, no domain needed as long as the app's account email is the same address you signed up to Resend with) ----------
async function sendResetEmail(env, toEmail, code) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.RESEND_API_KEY },
    body: JSON.stringify({
      from: "Рецептник <onboarding@resend.dev>",
      to: [toEmail],
      subject: "Код за нова парола — Рецептник",
      html:
        "<p>Ето кода за смяна на паролата ти в Рецептника:</p>" +
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
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid-json" }, 400, cors); }
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!isValidEmail(email)) return json({ error: "invalid-email" }, 400, cors);
  if (password.length < 8) return json({ error: "weak-password" }, 400, cors);

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
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid-json" }, 400, cors); }
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  const raw = await env.RECEPTNIK_DATA.get("user:" + email);
  if (!raw) return json({ error: "invalid-credentials" }, 401, cors);
  const user = JSON.parse(raw);
  const attemptHash = await hashPassword(password, user.salt);
  if (!timingSafeEqual(attemptHash, user.passwordHash)) return json({ error: "invalid-credentials" }, 401, cors);

  const token = await signToken(email, env.AUTH_SECRET);
  return json({ token, email }, 200, cors);
}

async function handleRequestReset(request, env, cors) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid-json" }, 400, cors); }
  const email = normalizeEmail(body.email);

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
  // Same response whether or not the account exists, so the endpoint can't be used to
  // check which emails are registered.
  return json({ ok: true }, 200, cors);
}

async function handleResetPassword(request, env, cors) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid-json" }, 400, cors); }
  const email = normalizeEmail(body.email);
  const code = String(body.code || "").trim();
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) return json({ error: "weak-password" }, 400, cors);

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

// ---------- the original AI proxy (unchanged behavior) ----------
async function handleAiProxy(request, env, cors) {
  if (env.APP_TOKEN && request.headers.get("X-App-Token") !== env.APP_TOKEN) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }
  if (!env.ANTHROPIC_API_KEY) {
    return new Response("Server misconfigured: ANTHROPIC_API_KEY secret not set", { status: 500, headers: cors });
  }
  let body;
  try {
    body = await request.text();
    JSON.parse(body);
  } catch (e) {
    return new Response("Invalid JSON body", { status: 400, headers: cors });
  }
  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: body,
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
