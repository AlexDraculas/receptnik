"use strict";

// "Sign in with Google", using Google Identity Services (GIS) — loaded in
// index.html via <script src="https://accounts.google.com/gsi/client">.
//
// Why this works even though the app has no backend of its own (other than
// the small Cloudflare Worker used for the AI features — see api.js): this
// uses Google's own OAuth 2.0 "token client" flow, which runs entirely in
// the browser. Clicking the button asks Google directly for a short-lived
// access token, and this file uses that token to ask Google's own userinfo
// endpoint for the name/email/photo. Nothing about sign-in touches our
// server. That also means it's a display-only identity, not verified
// server-side proof of who's using the app — perfectly fine for a personal
// profile on a recipe app, but not something to build real access control
// on without adding server-side token verification first.
//
// Setup (one-time): create a free OAuth Client ID in Google Cloud Console
// with "https://alexdraculas.github.io" as an Authorized JavaScript origin,
// then paste it below. See the setup guide for the exact steps.
var GOOGLE_CLIENT_ID = "366327042369-cteuf1qfou2h0ftvciu74d374f4hmuvu.apps.googleusercontent.com";

var googleTokenClient = null;
var googleInitRetries = 0;

function isGoogleConfigured(){
  return !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.indexOf("PASTE_YOUR") !== 0;
}

function initGoogleSignIn(){
  if(!isGoogleConfigured()) return; // button falls back to the honest local-only note below
  if(!window.google || !google.accounts || !google.accounts.oauth2){
    // The Google script loads async — on a slow connection it may not be
    // ready yet. Retry briefly instead of silently giving up.
    if(googleInitRetries++ < 20){ setTimeout(initGoogleSignIn, 250); }
    return;
  }
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "openid email profile",
    callback: function(resp){
      if(!resp || resp.error){ console.error("Google sign-in failed:", resp && resp.error); return; }
      fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: "Bearer " + resp.access_token }
      }).then(function(r){
        if(!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function(info){
        profile.googleName = info.name || "";
        profile.googleEmail = info.email || "";
        profile.googlePicture = info.picture || "";
        if(!profile.name) profile.name = info.name || ""; // only fill in, never overwrite a name they already chose
        saveProfile();
        renderOauthState();
      }).catch(function(err){ console.error("Fetching the Google profile failed:", err); });
    }
  });
}

function googleSignOut(){
  // Clears the Google identity saved on this device only. It does NOT revoke
  // the grant on Google's side — the user can do that anytime from
  // myaccount.google.com/permissions if they want to fully disconnect the app.
  delete profile.googleName;
  delete profile.googleEmail;
  delete profile.googlePicture;
  saveProfile();
  renderOauthState();
}

function renderOauthState(){
  var signedIn = !!(profile && profile.googleEmail);
  elOauthSignedIn.hidden = !signedIn;
  elGoogleBtn.hidden = signedIn;
  if(signedIn){
    elGoogleAvatarImg.src = profile.googlePicture || "";
    elGoogleName.textContent = profile.googleName || profile.googleEmail;
    elGoogleEmail.textContent = profile.googleEmail;
  }
}

elGoogleBtn.addEventListener("click", function(){
  if(googleTokenClient){ googleTokenClient.requestAccessToken({ prompt: "select_account" }); }
  else { showOauthNote(); } // not configured yet (or Google's script failed to load) — say so honestly
});
elGoogleSignOutBtn.addEventListener("click", googleSignOut);

initGoogleSignIn();
