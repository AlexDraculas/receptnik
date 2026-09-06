"use strict";

// Recipe sharing: create a public link for one of your recipes (POST /share
// on the same Cloudflare Worker as the AI features/accounts — see
// js/core/api.js for AI_PROXY_URL), and view/import a recipe someone shared
// with you via a "?share=<id>" URL parameter. Fully independent of
// accounts/sync — sharing works whether or not you're signed in, since the
// route itself is unauthenticated (just rate-limited — see the worker).

function shareableRecipePayload(r){
  return {
    name: r.name, description: r.description || "", cuisine: r.cuisine || "",
    style: r.style || "", difficulty: r.difficulty || "", time: r.time || "",
    ingredients: r.ingredients || [],
    steps: (r.steps || []).map(function(s){ return { text: s.text, timer: s.timer || null }; }),
  };
}

// ---------- creating a share link from a recipe card ----------

function shareRecipeFromCard(r, statusEl, btnEl){
  statusEl.className = "rn-link-status rn-share-card-status is-loading";
  statusEl.textContent = t("shareCreating");
  btnEl.disabled = true;
  fetch(AI_PROXY_URL + "share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shareableRecipePayload(r)),
  }).then(function(res){
    return res.json().catch(function(){ return {}; }).then(function(data){
      if(!res.ok) throw new Error(data.error || "generic");
      return data;
    });
  }).then(function(data){
    var url = location.origin + location.pathname + "?share=" + encodeURIComponent(data.id);
    var copied = false;
    if(navigator.clipboard && navigator.clipboard.writeText){
      copied = true;
      navigator.clipboard.writeText(url).catch(function(){ copied = false; });
    }
    statusEl.className = "rn-link-status rn-share-card-status is-success";
    statusEl.textContent = copied ? t("shareCopied") : (t("shareLinkReady") + " " + url);
  }).catch(function(e){
    statusEl.className = "rn-link-status rn-share-card-status is-error";
    statusEl.textContent = (e.message === "rate-limited") ? t("shareErrRateLimited") : t("shareErrGeneric");
  }).then(function(){
    btnEl.disabled = false;
  });
}

// ---------- viewing / importing a recipe someone shared with you ----------

var sharedRecipeData = null; // the payload fetched from /share/:id, or null when the view is closed/empty

function renderSharedIngredients(list){
  elShareIngList.innerHTML = "";
  (list || []).forEach(function(ing){
    var li = document.createElement("li");
    li.textContent = ing;
    elShareIngList.appendChild(li);
  });
}
function renderSharedSteps(list){
  elShareStepList.innerHTML = "";
  (list || []).forEach(function(step){
    var li = document.createElement("li");
    li.textContent = step.text;
    elShareStepList.appendChild(li);
  });
}

function showShareStatus(text, kind){
  elShareStatus.hidden = !text;
  elShareStatus.textContent = text || "";
  elShareStatus.className = "rn-link-status rn-share-view-status" + (kind ? " is-" + kind : "");
  elShareRecipe.hidden = !!text;
}

function renderSharedRecipe(data){
  sharedRecipeData = data;
  showShareStatus("");
  elShareMedallion.style.background = cuisineColor(data.cuisine);
  elShareMedallion.textContent = cuisineEmoji(data.cuisine);
  elShareName.textContent = data.name;
  var metaBits = [];
  if(data.cuisine) metaBits.push(cuisineLabel(data.cuisine));
  if(data.style) metaBits.push(styleLabel(data.style));
  if(data.difficulty) metaBits.push(difficultyLabel(data.difficulty));
  if(data.time) metaBits.push("⏱ " + data.time);
  elShareMeta.textContent = metaBits.join(" · ");
  elShareDesc.textContent = data.description || "";
  elShareDesc.hidden = !data.description;
  renderSharedIngredients(data.ingredients);
  renderSharedSteps(data.steps);
  elShareAddBtn.disabled = false;
  elShareAddBtn.textContent = t("shareViewAddBtn");
}

function openShareView(){
  elShareView.classList.add("is-open");
}
function closeShareView(){
  elShareView.classList.remove("is-open");
  sharedRecipeData = null;
  // Drop the ?share=... param so a refresh (or going back) doesn't reopen it.
  if(window.history && window.history.replaceState){
    var url = new URL(location.href);
    url.searchParams.delete("share");
    var qs = url.searchParams.toString();
    window.history.replaceState({}, "", url.pathname + (qs ? "?" + qs : "") + url.hash);
  }
}

function fetchSharedRecipe(id){
  showShareStatus(t("shareViewLoading"), "loading");
  openShareView();
  return fetch(AI_PROXY_URL + "share/" + encodeURIComponent(id))
    .then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(!res.ok) throw new Error(data.error || "generic");
        return data;
      });
    })
    .then(renderSharedRecipe)
    .catch(function(e){
      var msg = (e.message === "not-found") ? t("shareViewNotFound")
        : (e.message === "rate-limited") ? t("shareErrRateLimited")
        : t("shareViewErrGeneric");
      showShareStatus(msg, "error");
    });
}

function maybeOpenSharedRecipeFromUrl(){
  var params = new URLSearchParams(location.search);
  var id = params.get("share");
  if(id) fetchSharedRecipe(id);
}

if(elShareCloseBtn) elShareCloseBtn.addEventListener("click", closeShareView);
if(elShareAddBtn) elShareAddBtn.addEventListener("click", function(){
  if(!sharedRecipeData) return;
  var recipe = {
    id: "r-" + Date.now() + "-" + Math.random().toString(36).slice(2,8),
    name: sharedRecipeData.name, cuisine: sharedRecipeData.cuisine || "", style: sharedRecipeData.style || "",
    difficulty: sharedRecipeData.difficulty || "Средна",
    description: sharedRecipeData.description || "", time: sharedRecipeData.time || "",
    dateAdded: Date.now(), ingredients: sharedRecipeData.ingredients || [], steps: sharedRecipeData.steps || [],
    favorite: false, myRating: 0,
  };
  recipes.push(recipe);
  saveRecipes().then(function(){
    elShareAddBtn.disabled = true;
    elShareAddBtn.textContent = t("shareViewAdded");
  });
});
