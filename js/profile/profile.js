"use strict";

// Profile screen: avatar/name, the honest Google/Apple sign-in note, and streak/stat rendering.

var AVATAR_OPTIONS = ["🧑‍🍳","👩‍🍳","👨‍🍳","🐱","🐶","🦊","🐼","🍓","🌶️","🥑","😺","🧁"];
function renderProfile(){
  elAvatarBtn.textContent = profile.avatar || "🧑‍🍳";
  elProfileName.value = profile.name || "";
}
elAvatarBtn.addEventListener("click", function(){
  var idx = AVATAR_OPTIONS.indexOf(profile.avatar);
  profile.avatar = AVATAR_OPTIONS[(idx + 1) % AVATAR_OPTIONS.length];
  elAvatarBtn.textContent = profile.avatar;
  saveProfile();
});
elProfileName.addEventListener("change", function(){
  profile.name = elProfileName.value.trim();
  saveProfile();
});
function showOauthNote(){
  elOauthNote.hidden = false;
  elProfileName.focus();
}
elGoogleBtn.addEventListener("click", showOauthNote);
elAppleBtn.addEventListener("click", showOauthNote);

function topCuisine(){
  if(recipes.length === 0) return "—";
  var counts = {};
  recipes.forEach(function(r){ counts[r.cuisine] = (counts[r.cuisine]||0) + 1; });
  var best = null, bestN = 0;
  Object.keys(counts).forEach(function(c){ if(counts[c] > bestN){ best = c; bestN = counts[c]; } });
  return best ? cuisineLabel(best) : "—";
}
function renderStats(){
  renderProfile();
  var frozen = isStreakFrozen();
  $("rnStreakNum").textContent = stats.streak || 0;
  $("rnStreakNum").classList.toggle("is-frozen", frozen);
  $("rnStreakFlame").classList.toggle("is-frozen", frozen);
  $("rnStreakLabel").textContent = frozen ? t("streakFrozenLabel") : streakLabelFor(stats.streak || 0);
  var hintEl = $("rnStreakHint");
  hintEl.hidden = !frozen;
  hintEl.textContent = frozen ? t("streakFrozenHint") : "";
  $("rnStatTotalRecipes").textContent = recipes.length;
  $("rnStatCooked").textContent = stats.totalCooked || 0;
  $("rnStatFavorites").textContent = recipes.filter(function(r){ return r.favorite; }).length;
  $("rnStatTopCuisine").textContent = topCuisine();
  updateStreakBadge();
}
function updateStreakBadge(){
  var badge = $("rnNavStreakBadge");
  if(stats.streak > 0){
    badge.hidden = false; badge.textContent = stats.streak;
    badge.classList.toggle("is-frozen", isStreakFrozen());
  } else { badge.hidden = true; }
}
