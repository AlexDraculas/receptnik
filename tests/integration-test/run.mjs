// Full-stack integration test: loads the real index.html + all real JS files
// into a jsdom window (scripts inlined so nothing needs network access),
// wires window.fetch to the REAL worker module (in-memory KV mock, mocked
// Resend), and drives actual DOM events (typing into fields, clicking
// submit) to exercise register -> sync push -> logout -> login on another
// "device" -> sync pull, exactly like a real user would.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import worker from "../../worker/anthropic-proxy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

class FakeKV {
  constructor() { this.store = new Map(); }
  async get(key) { return this.store.has(key) ? this.store.get(key) : null; }
  async put(key, value) { this.store.set(key, value); }
  async delete(key) { this.store.delete(key); }
}
const env = {
  APP_TOKEN: "test-app-token",
  ANTHROPIC_API_KEY: "sk-ant-fake",
  AUTH_SECRET: "test-auth-secret",
  RESEND_API_KEY: "test-resend-key",
  RECEPTNIK_DATA: new FakeKV(),
};
let lastResendCode = null;

function buildHtml() {
  let html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
  // Drop the external Google Identity Services script — not needed for this test, and jsdom has no real network here.
  html = html.replace(/<script src="https:\/\/accounts\.google\.com\/gsi\/client"[^>]*><\/script>\s*/, "");
  // Inline every local <script src="..."> so jsdom needs zero network / filesystem resource loading.
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, relPath) => {
    const code = fs.readFileSync(`${ROOT}/${relPath}`, "utf8");
    return `<script>\n${code}\n</script>`;
  });
  return html;
}

async function main() {
  const html = buildHtml();
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://alexdraculas.github.io/receptnik/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.addEventListener("error", (e) => { console.error("WINDOW ERROR:", e.error && e.error.stack || e.message); });
  window.addEventListener("unhandledrejection", (e) => { console.error("UNHANDLED REJECTION:", e.reason && e.reason.stack || e.reason); });

  // Route the page's fetch() calls: our Worker's base URL -> real worker.fetch(); Resend calls are
  // handled inside the worker itself calling fetch too, so patch fetch at the *global* level the
  // worker module also sees (Node's global fetch), not just window.fetch.
  const realGlobalFetch = global.fetch;
  const routedFetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://recipe-ai-proxy.alexcvetanovv.workers.dev/")) {
      const path = urlStr.replace("https://recipe-ai-proxy.alexcvetanovv.workers.dev", "");
      // Use Node's *global* Request/Response (not jsdom's window.Request) — the worker module
      // was imported under plain Node and expects the same Request/Response realm it was built with.
      const plainOpts = opts ? { method: opts.method, headers: opts.headers, body: opts.body } : undefined;
      const req = new global.Request("https://recipe-ai-proxy.example.workers.dev" + path, plainOpts);
      return worker.fetch(req, env); // real Response (global realm) — duck-typed access from window code works fine
    }
    if (urlStr.startsWith("https://api.resend.com")) {
      const body = JSON.parse(opts.body);
      const match = body.html.match(/(\d{6})/);
      lastResendCode = match ? match[1] : null;
      return new (global.Response)(JSON.stringify({ id: "fake" }), { status: 200 });
    }
    throw new Error("Unexpected fetch in test: " + urlStr);
  };
  window.fetch = routedFetch;
  global.fetch = routedFetch; // the worker module was imported once at top-level and uses the *global* fetch internally

  let failures = 0;
  function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); failures++; }
    else console.log("ok:", msg);
  }
  function $(id) { return window.document.getElementById(id); }
  function setValue(id, value) {
    const el = $(id);
    el.value = value;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  }
  function submit(formId) {
    $(formId).dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  }
  function click(id) {
    $(id).dispatchEvent(new window.Event("click", { bubbles: true }));
  }
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  // Poll until a condition is true (or timeout) — needed because the app's own async chains
  // (fetch -> .then -> re-render) settle on real event-loop ticks, not synchronously.
  async function waitFor(fn, label, timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fn()) return true;
      await tick(20);
    }
    console.error("TIMEOUT waiting for:", label);
    return false;
  }

  // Wait for the app's own boot sequence (Promise.all(...).then(loadRecipes).then(...)) to finish.
  await waitFor(() => $("rnLoading").hidden === true, "initial app boot to finish");
  await tick(50);

  // Go to the Profile view where the account UI lives.
  click("rnNavStats");
  await tick(20);

  assert($("rnAccountLoggedOut").hidden === false, "starts logged out");
  assert($("rnAccountSignedIn").hidden === true, "signed-in card starts hidden");

  // Add a real recipe locally BEFORE registering, to check that it gets adopted into the new account (migration-on-first-login).
  window.recipes.push({
    id: "local-only-recipe", name: "Local Only Recipe", cuisine: "Италианска", style: "Печене",
    description: "d", time: "10 min", dateAdded: Date.now(), ingredients: ["x"], steps: [{ text: "y" }],
    favorite: false, myRating: 0,
  });
  await window.saveRecipes();
  assert(window.recipes.length === 2, "local recipe added before registering (seed + new one)");

  // ---- Local library search filter (item #2 of the improvement list) ----
  click("rnNavLibrary");
  await tick(20);
  assert($("rnList").children.length === 2, "library shows both recipes before searching");

  setValue("rnLibrarySearch", "Local Only");
  await tick(20);
  assert($("rnList").children.length === 1, "search narrows list to the one matching recipe");
  assert($("rnList").children[0].dataset.id === "local-only-recipe", "the visible card is the matching recipe");
  assert($("rnEmpty").hidden === true, "empty state stays hidden when a search match exists");

  setValue("rnLibrarySearch", "zzz-no-such-recipe-zzz");
  await tick(20);
  assert($("rnList").children.length === 0, "search with no matches hides all cards");
  assert($("rnEmpty").hidden === false, "empty state shown when search matches nothing");
  assert($("rnEmptyTitle").textContent === window.t("librarySearchEmptyTitle"), "empty state uses the search-specific title");

  setValue("rnLibrarySearch", "");
  await tick(20);
  assert($("rnList").children.length === 2, "clearing the search restores both recipes");

  // ---- Recipe sharing (item #4 of the improvement list): share a card, then view + import it as if from a link ----
  {
    // Open the "Local Only Recipe" card so its drop-in (incl. the Share button) exists and is wired up.
    let card = $("rnList").querySelector('[data-id="local-only-recipe"]');
    card.querySelector(".rn-card-head").dispatchEvent(new window.Event("click", { bubbles: true }));
    await tick(20);
    card = $("rnList").querySelector('[data-id="local-only-recipe"]'); // re-query: the list was re-rendered on open
    const shareBtn = card.querySelector(".rn-share-card-btn");
    const shareStatusEl = card.querySelector(".rn-share-card-status");
    shareBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await waitFor(() => shareStatusEl.className.indexOf("is-success") > -1 || shareStatusEl.className.indexOf("is-error") > -1, "share creation to settle");
    assert(shareStatusEl.className.indexOf("is-success") > -1, "sharing the local recipe succeeds (status: " + shareStatusEl.textContent + ")");

    // Pull the id straight out of KV (same way a real recipient's link would encode it), then open it
    // through the app's own shared-recipe view, exactly like following a "?share=<id>" link would.
    const shareKeys = [...env.RECEPTNIK_DATA.store.keys()].filter((k) => k.startsWith("share:"));
    assert(shareKeys.length === 1, "exactly one share record was written to KV");
    const shareId = shareKeys[0].slice("share:".length);

    window.fetchSharedRecipe(shareId);
    await waitFor(() => $("rnShareView").classList.contains("is-open"), "shared-recipe view to open");
    await waitFor(() => $("rnShareRecipe").hidden === false, "shared recipe to finish loading");
    assert($("rnShareName").textContent === "Local Only Recipe", "shared-recipe view shows the correct recipe name");
    assert($("rnShareIngList").children.length === 1, "shared-recipe view lists the recipe's ingredients");

    const recipeCountBefore = window.recipes.length;
    $("rnShareAddBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
    await waitFor(() => window.recipes.length === recipeCountBefore + 1, "shared recipe added to the local library");
    await waitFor(() => $("rnShareAddBtn").disabled === true, "add button to disable once the import's save finishes");
    const imported = window.recipes[window.recipes.length - 1];
    assert(imported.name === "Local Only Recipe", "the imported recipe carries over the shared name");
    assert($("rnShareAddBtn").disabled === true, "the add button disables itself after a successful import");

    $("rnShareCloseBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
    await tick(20);
    assert($("rnShareView").classList.contains("is-open") === false, "closing the shared-recipe view hides it again");

    // Undo the import so the recipe count downstream (register/sync assertions) is unaffected by this block.
    window.recipes.pop();
    await window.saveRecipes();
    assert(window.recipes.length === recipeCountBefore, "test cleanup: back to the pre-share recipe count");
  }

  // ---- Register ----
  setValue("rnRegisterEmail", "aleks@example.com");
  setValue("rnRegisterPassword", "correcthorse123");
  setValue("rnRegisterPasswordConfirm", "correcthorse123");
  submit("rnRegisterForm");
  await waitFor(() => window.authToken, "authToken set after register");
  await waitFor(() => $("rnAccountSignedIn").hidden === false, "signed-in card shown after register");
  assert($("rnAccountEmail").textContent === "aleks@example.com", "signed-in card shows the registered email");

  await waitFor(() => $("rnAccountSyncStatus").textContent.indexOf("✓") > -1 || $("rnAccountSyncStatus").textContent.indexOf("Synced") > -1, "sync status shows synced after register's post-register sync push");

  // Server should now hold the 2 local recipes we had before registering (push-as-migration).
  let serverData = JSON.parse(await env.RECEPTNIK_DATA.get("data:aleks@example.com"));
  assert(serverData.recipes.length === 2, "server received the pre-existing local recipes on first register (got " + serverData.recipes.length + ")");
  assert(serverData.recipes.some((r) => r.id === "local-only-recipe"), "server has the specific local-only recipe");

  // ---- Edit a recipe while logged in -> should auto-push after the debounce ----
  window.profile.name = "Aleks";
  await window.saveProfile();
  await tick(1000); // debounce is 800ms
  serverData = JSON.parse(await env.RECEPTNIK_DATA.get("data:aleks@example.com"));
  assert(serverData.profile && serverData.profile.name === "Aleks", "profile edit auto-synced to server after debounce");

  // ---- Logout ----
  click("rnAccountLogoutBtn");
  await tick(20);
  assert(window.authToken === null, "authToken cleared after logout");
  assert($("rnAccountLoggedOut").hidden === false, "logged-out forms shown again after logout");
  assert(window.recipes.length === 2, "local recipes NOT wiped by logout");

  // ---- Simulate a second, fresh device: wipe local recipes/profile/stats back to nothing, then log in ----
  window.recipes = [];
  window.profile = { name: "", avatar: "🧑‍🍳" };
  window.stats = { streak: 0, lastCookAt: null, streakCreditDate: null, totalCooked: 0 };

  setValue("rnLoginEmail", "aleks@example.com");
  setValue("rnLoginPassword", "correcthorse123");
  submit("rnLoginForm");
  await waitFor(() => window.authToken, "authToken set after login (second device)");
  await waitFor(() => window.recipes.length === 2, "recipes pulled down from server on login (second device)");
  assert(window.profile.name === "Aleks", "profile pulled down from server on login (second device)");
  assert($("rnAccountSignedIn").hidden === false, "signed-in card shown after login");

  // ---- Wrong password ----
  click("rnAccountLogoutBtn");
  await tick(20);
  setValue("rnLoginEmail", "aleks@example.com");
  setValue("rnLoginPassword", "totallywrongpassword");
  submit("rnLoginForm");
  await waitFor(() => $("rnAccountStatus").className.indexOf("is-error") > -1, "error status shown for wrong password");
  assert(/парола|password/i.test($("rnAccountStatus").textContent), "wrong-password error message shown: \"" + $("rnAccountStatus").textContent + "\"");
  assert(window.authToken === null, "authToken still null after failed login");

  // ---- Forgot password flow ----
  click("rnForgotPasswordLink");
  await tick(20);
  assert($("rnForgotForm").hidden === false, "forgot-password form shown");
  setValue("rnForgotEmail", "aleks@example.com");
  submit("rnForgotForm");
  await waitFor(() => lastResendCode !== null, "reset code email was sent via Resend");
  await waitFor(() => $("rnResetForm").hidden === false, "reset form shown after code sent");

  setValue("rnResetCode", lastResendCode);
  setValue("rnResetPassword", "brandnewpassword1");
  submit("rnResetForm");
  await waitFor(() => window.authToken, "authToken set after password reset");

  click("rnAccountLogoutBtn");
  await tick(20);
  setValue("rnLoginEmail", "aleks@example.com");
  setValue("rnLoginPassword", "brandnewpassword1");
  submit("rnLoginForm");
  await waitFor(() => window.authToken, "login works with the NEW password after reset");

  global.fetch = realGlobalFetch;
  console.log(failures === 0 ? "\nALL INTEGRATION TESTS PASSED" : `\n${failures} INTEGRATION TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
