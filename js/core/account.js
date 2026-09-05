"use strict";

// Email/password accounts + cross-device sync, talking to the same Cloudflare
// Worker as the AI features (see js/core/api.js for AI_PROXY_URL) — new routes
// under /auth/* and /sync. See worker/anthropic-proxy.js and worker/DEPLOY.md.
//
// How this differs from js/core/google-auth.js: Google sign-in there is
// purely cosmetic (name/photo, never leaves the browser). An account here
// actually stores your recipes/cart/stats/profile server-side, so logging in
// with the same email+password on another device shows the same data.

var authToken = null;
var authEmail = null;
var syncApplyingRemote = false; // true while we're writing server data into local state, so that save doesn't immediately echo it back
var syncBootDone = false; // true once the app has finished its first pull-or-not-logged-in check on load
var syncPushTimer = null;

function loadAuth(){
  return window.storage.get("app-auth", false).then(function(res){
    var data = JSON.parse(res.value);
    if(data && data.token && data.email){ authToken = data.token; authEmail = data.email; }
  }).catch(function(){});
}
function saveAuthLocal(){
  return window.storage.set("app-auth", JSON.stringify({ token: authToken, email: authEmail }), false).catch(function(){});
}
function clearAuthLocal(){
  authToken = null;
  authEmail = null;
  return window.storage.set("app-auth", JSON.stringify({}), false).catch(function(){});
}

function accountError(code){
  var map = {
    "invalid-email": "accountErrInvalidEmail",
    "weak-password": "accountErrWeakPassword",
    "email-taken": "accountErrEmailTaken",
    "invalid-credentials": "accountErrInvalidCredentials",
    "invalid-or-expired-code": "accountErrInvalidCode",
  };
  var e = new Error(t(map[code] || "accountErrGeneric"));
  e.isAccountError = true;
  return e;
}
function authFetch(path, opts){
  return fetch(AI_PROXY_URL + path, opts).then(function(res){
    if(res.ok) return res.json();
    return res.json().catch(function(){ return {}; }).then(function(data){ throw accountError(data.error); });
  });
}

function setAccountStatus(text, kind){
  elAccountStatus.hidden = !text;
  elAccountStatus.textContent = text || "";
  elAccountStatus.className = "rn-account-status rn-link-status" + (kind ? " is-" + kind : "");
}
function setSyncStatus(state){
  if(!authToken){ elAccountSyncStatus.hidden = true; return; }
  var map = { syncing: "accountSyncSyncing", synced: "accountSyncSynced", error: "accountSyncError" };
  elAccountSyncStatus.hidden = !state;
  elAccountSyncStatus.textContent = state ? t(map[state] || "") : "";
}

function showAccountForm(which){
  elLoginForm.hidden = which !== "login";
  elRegisterForm.hidden = which !== "register";
  elForgotForm.hidden = which !== "forgot";
  elResetForm.hidden = which !== "reset";
  elAccountTabLogin.parentElement.hidden = (which === "forgot" || which === "reset");
  if(which === "login" || which === "register"){
    elAccountTabLogin.classList.toggle("is-active", which === "login");
    elAccountTabRegister.classList.toggle("is-active", which === "register");
  }
}

function renderAccountState(){
  var loggedIn = !!authToken;
  elAccountLoggedOut.hidden = loggedIn;
  elAccountSignedIn.hidden = !loggedIn;
  if(loggedIn){ elAccountEmail.textContent = authEmail; }
}

function handleAuthExpired(){
  clearAuthLocal();
  renderAccountState();
  showAccountForm("login");
  setAccountStatus("", "");
}

// A device counts as having "real" local data worth keeping if it's not just
// the untouched starter recipe and default profile/stats.
function localHasRealData(){
  if(Array.isArray(recipes)){
    if(recipes.length > 1) return true;
    if(recipes.length === 1 && recipes[0].id !== "seed-cheeseburger-bombs") return true;
  }
  if(profile && (profile.name || (profile.avatar && profile.avatar !== "🧑‍🍳"))) return true;
  if(stats && ((stats.totalCooked || 0) > 0 || (stats.streak || 0) > 0)) return true;
  return false;
}

function syncPull(){
  if(!authToken) return Promise.resolve();
  clearTimeout(syncPushTimer);
  setSyncStatus("syncing");
  return fetch(AI_PROXY_URL + "sync", { headers: { Authorization: "Bearer " + authToken } })
    .then(function(res){
      if(res.status === 401){ handleAuthExpired(); throw new Error("unauthorized"); }
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function(data){
      var serverHasData = !!(data && (data.profile || data.stats || (Array.isArray(data.recipes) && data.recipes.length > 0)));
      if(serverHasData){
        syncApplyingRemote = true;
        recipes = migrateTimers(migrateFavorites(Array.isArray(data.recipes) ? data.recipes : []));
        if(data.stats) stats = data.stats;
        if(data.profile) profile = data.profile;
        return Promise.all([saveRecipes(), saveStats(), saveProfile()]).then(function(){
          syncApplyingRemote = false;
          refreshCurrentView();
          renderProfile();
          updateStreakBadge();
          setSyncStatus("synced");
        });
      }
      if(localHasRealData()) return syncPush();
      setSyncStatus("synced");
    })
    .catch(function(err){
      if(!err || err.message !== "unauthorized"){ console.error("Sync pull failed:", err); setSyncStatus("error"); }
    });
}

function syncPush(){
  if(!authToken) return Promise.resolve();
  setSyncStatus("syncing");
  return fetch(AI_PROXY_URL + "sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
    body: JSON.stringify({ recipes: recipes, stats: stats, profile: profile }),
  })
    .then(function(res){
      if(res.status === 401){ handleAuthExpired(); throw new Error("unauthorized"); }
      if(!res.ok) throw new Error("HTTP " + res.status);
      setSyncStatus("synced");
    })
    .catch(function(err){
      if(!err || err.message !== "unauthorized"){ console.error("Sync push failed:", err); setSyncStatus("error"); }
    });
}

// Called from storage.js after every local save. Debounced so rapid edits
// (typing, checking off ingredients) don't fire a request per keystroke.
function queueSync(){
  if(!syncBootDone || !authToken || syncApplyingRemote) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(syncPush, 800);
}

// ---------- forms ----------

elAccountTabLogin.addEventListener("click", function(){ setAccountStatus("", ""); showAccountForm("login"); });
elAccountTabRegister.addEventListener("click", function(){ setAccountStatus("", ""); showAccountForm("register"); });
elForgotPasswordLink.addEventListener("click", function(){
  elForgotEmail.value = elLoginEmail.value || "";
  setAccountStatus("", "");
  showAccountForm("forgot");
});
elForgotBackLink1.addEventListener("click", function(){ setAccountStatus("", ""); showAccountForm("login"); });
elForgotBackLink2.addEventListener("click", function(){ setAccountStatus("", ""); showAccountForm("login"); });

elLoginForm.addEventListener("submit", function(e){
  e.preventDefault();
  setAccountStatus(t("accountLoggingIn"), "loading");
  elLoginSubmitBtn.disabled = true;
  authFetch("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: elLoginEmail.value.trim(), password: elLoginPassword.value }),
  })
    .then(function(data){
      authToken = data.token; authEmail = data.email;
      return saveAuthLocal();
    })
    .then(function(){
      elLoginForm.reset();
      setAccountStatus("", "");
      renderAccountState();
      return syncPull();
    })
    .catch(function(err){ setAccountStatus(err.isAccountError ? err.message : t("accountErrGeneric"), "error"); })
    .finally(function(){ elLoginSubmitBtn.disabled = false; });
});

elRegisterForm.addEventListener("submit", function(e){
  e.preventDefault();
  if(elRegisterPassword.value !== elRegisterPasswordConfirm.value){
    setAccountStatus(t("accountErrPasswordMismatch"), "error");
    return;
  }
  setAccountStatus(t("accountRegistering"), "loading");
  elRegisterSubmitBtn.disabled = true;
  authFetch("auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: elRegisterEmail.value.trim(), password: elRegisterPassword.value }),
  })
    .then(function(data){
      authToken = data.token; authEmail = data.email;
      return saveAuthLocal();
    })
    .then(function(){
      elRegisterForm.reset();
      setAccountStatus("", "");
      renderAccountState();
      return syncPull(); // if this device already had real recipes, they become the new account's starting data
    })
    .catch(function(err){ setAccountStatus(err.isAccountError ? err.message : t("accountErrGeneric"), "error"); })
    .finally(function(){ elRegisterSubmitBtn.disabled = false; });
});

elForgotForm.addEventListener("submit", function(e){
  e.preventDefault();
  setAccountStatus(t("accountSendingCode"), "loading");
  elForgotSendBtn.disabled = true;
  authFetch("auth/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: elForgotEmail.value.trim() }),
  })
    .then(function(){
      showAccountForm("reset");
      setAccountStatus(t("accountCodeSent"), "success");
    })
    .catch(function(err){ setAccountStatus(err.isAccountError ? err.message : t("accountErrGeneric"), "error"); })
    .finally(function(){ elForgotSendBtn.disabled = false; });
});

elResetForm.addEventListener("submit", function(e){
  e.preventDefault();
  setAccountStatus(t("accountResetting"), "loading");
  elResetSubmitBtn.disabled = true;
  authFetch("auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: elForgotEmail.value.trim(), code: elResetCode.value.trim(), newPassword: elResetPassword.value }),
  })
    .then(function(data){
      authToken = data.token; authEmail = data.email;
      return saveAuthLocal();
    })
    .then(function(){
      elResetForm.reset();
      elForgotForm.reset();
      setAccountStatus("", "");
      showAccountForm("login");
      renderAccountState();
      return syncPull();
    })
    .catch(function(err){ setAccountStatus(err.isAccountError ? err.message : t("accountErrGeneric"), "error"); })
    .finally(function(){ elResetSubmitBtn.disabled = false; });
});

elAccountLogoutBtn.addEventListener("click", function(){
  clearAuthLocal();
  renderAccountState();
  showAccountForm("login");
  setAccountStatus(t("accountLogoutConfirm"), "success");
});
