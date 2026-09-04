"use strict";

// Library view: cuisine/style chips, the favorites toggle, sorting, and the shared recipe-card renderer.

function renderChips(container, options, activeVal, allLabel, onPick, labelFn){
  container.innerHTML = "";
  var all = ["all"].concat(options);
  all.forEach(function(v){
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "rn-chip" + (activeVal === v ? " is-active" : "");
    chip.textContent = v === "all" ? allLabel : ((CUISINE_EMOJI[v] ? CUISINE_EMOJI[v]+" " : "") + labelFn(v));
    chip.addEventListener("click", function(){ onPick(v); });
    container.appendChild(chip);
  });
}
function renderFilterChips(){
  renderChips(elChipsCuisine, CUISINES, filters.cuisine, t("chipAllCuisines"), function(v){ filters.cuisine = v; renderLibrary(); }, cuisineLabel);
  renderChips(elChipsStyle, STYLES, filters.style, t("chipAllStyles"), function(v){ filters.style = v; renderLibrary(); }, styleLabel);
}

var sortMode = "recent"; // "recent" | "rating"
function sortRecipeList(list){
  var sorted = list.slice();
  if(sortMode === "rating"){
    sorted.sort(function(a,b){
      var d = (b.myRating||0) - (a.myRating||0);
      return d !== 0 ? d : (b.dateAdded - a.dateAdded);
    });
  } else {
    sorted.sort(function(a,b){ return b.dateAdded - a.dateAdded; });
  }
  return sorted;
}
function renderSortToggle(container, onChange){
  container.innerHTML = "";
  [["recent", t("sortRecent")], ["rating", t("sortRating")]].forEach(function(pair){
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "rn-chip" + (sortMode === pair[0] ? " is-active" : "");
    chip.textContent = pair[1];
    chip.addEventListener("click", function(){ sortMode = pair[0]; onChange(); });
    container.appendChild(chip);
  });
}

function toggleFavorite(id){
  var r = recipes.filter(function(x){ return x.id === id; })[0];
  if(!r) return;
  r.favorite = !r.favorite;
  saveRecipes().then(refreshCurrentView);
}
function setMyRating(id, val){
  var r = recipes.filter(function(x){ return x.id === id; })[0];
  if(!r) return;
  r.myRating = (r.myRating === val) ? 0 : val; // tap same star again to clear
  saveRecipes().then(refreshCurrentView);
}

function renderCardsInto(container, list, emptyEl, mode){
  mode = mode || "normal";
  container.innerHTML = "";
  if(emptyEl) emptyEl.hidden = list.length !== 0;

  list.forEach(function(r, i){
    var card = document.createElement("div");
    card.className = "rn-card" + (openCardId === r.id ? " is-open" : "") + (mode === "cart" ? " is-cart" : "");
    card.style.animationDelay = (i*0.04)+"s";

    var head = document.createElement("div");
    head.className = "rn-card-head";
    head.innerHTML =
      '<div class="rn-medallion" style="background:'+cuisineColor(r.cuisine)+'">'+cuisineEmoji(r.cuisine)+'</div>' +
      '<div><p class="rn-card-title">'+escapeHtml(r.name)+'</p>' +
      '<div class="rn-card-meta">'+escapeHtml(cuisineLabel(r.cuisine))+' · '+escapeHtml(styleLabel(r.style))+'</div></div>' +
      '<button type="button" class="rn-fav-btn'+(r.favorite?' is-fav':'')+'">'+(r.favorite?'❤️':'🤍')+'</button>' +
      '<div class="rn-card-chevron">▶</div>';
    head.querySelector(".rn-fav-btn").addEventListener("click", function(e){
      e.stopPropagation(); toggleFavorite(r.id);
    });
    head.addEventListener("click", function(){
      openCardId = (openCardId === r.id) ? null : r.id;
      refreshCurrentView();
    });

    var drop = document.createElement("div");
    drop.className = "rn-card-drop";
    var dropIn = document.createElement("div");
    dropIn.className = "rn-card-drop-in";

    if(mode === "cart"){
      buildCartDropIn(dropIn, r);
    } else {
      dropIn.innerHTML =
        '<p class="rn-card-desc">'+escapeHtml(r.description || "—")+'</p>' +
        '<div class="rn-card-time">⏱ '+escapeHtml(r.time || "—")+' · '+stepsLabel(r.steps.length)+'</div>';
      var ratingRow = document.createElement("div");
      ratingRow.className = "rn-my-rating";
      var ratingLabel = document.createElement("span");
      ratingLabel.className = "rn-my-rating-label";
      ratingLabel.textContent = t("myRatingLabel");
      ratingRow.appendChild(ratingLabel);
      var myRating = r.myRating || 0;
      for(var s=1; s<=5; s++){
        (function(starVal){
          var starBtn = document.createElement("button");
          starBtn.type = "button";
          starBtn.className = "rn-star-btn";
          starBtn.textContent = starVal <= myRating ? "★" : "☆";
          starBtn.addEventListener("click", function(e){ e.stopPropagation(); setMyRating(r.id, starVal); });
          ratingRow.appendChild(starBtn);
        })(s);
      }
      dropIn.appendChild(ratingRow);
      var startBtn = document.createElement("button");
      startBtn.className = "rn-3d c-coral rn-start-btn";
      startBtn.type = "button";
      startBtn.textContent = t("startBtn");
      startBtn.addEventListener("click", function(e){ e.stopPropagation(); startCooking(r); });
      dropIn.appendChild(startBtn);
    }
    drop.appendChild(dropIn);

    card.appendChild(head);
    card.appendChild(drop);
    container.appendChild(card);
  });
}

function renderLibrary(){
  renderFilterChips();
  renderSortToggle(elSortLibrary, renderLibrary);

  var favCount = recipes.filter(function(r){ return r.favorite; }).length;
  elFavToggle.classList.toggle("is-active", filters.favoritesOnly);
  elFavToggleIcon.textContent = filters.favoritesOnly ? "❤️" : "🤍";
  elFavToggleLabel.textContent = t("favToggleLabel") + (favCount > 0 ? " · " + favCount : "");

  var filtered = recipes.filter(function(r){
    if(filters.favoritesOnly && !r.favorite) return false;
    if(filters.cuisine !== "all" && r.cuisine !== filters.cuisine) return false;
    if(filters.style !== "all" && r.style !== filters.style) return false;
    return true;
  });
  elCount.textContent = recipes.length ? countLabel(recipes.length) : "";

  if(filtered.length === 0 && filters.favoritesOnly){
    elEmpty.querySelector(".rn-empty-emoji").textContent = "💜";
    elEmptyTitle.textContent = t("favEmptyTitle");
    elEmptyBody.textContent = t("favEmptyBody");
  } else {
    elEmpty.querySelector(".rn-empty-emoji").textContent = "🔍";
    elEmptyTitle.textContent = t("emptyTitle");
    elEmptyBody.textContent = t("emptyBody");
  }
  renderCardsInto(elList, sortRecipeList(filtered), elEmpty);
}
elFavToggle.addEventListener("click", function(){
  filters.favoritesOnly = !filters.favoritesOnly;
  renderLibrary();
});
