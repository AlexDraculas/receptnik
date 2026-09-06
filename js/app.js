"use strict";

// App entry point: view switching / bottom-nav wiring, then boots everything on load.

var currentView = "library";
var VIEW_SECTIONS = { library:elViewLibrary, add:elViewAdd, search:elViewSearch, cart:elViewCart, stats:elViewStats };
var VIEW_NAV_BTNS = { library:$("rnNavLibrary"), search:$("rnNavSearch"), add:$("rnNavAdd"), cart:$("rnNavCart"), stats:$("rnNavStats") };
function refreshCurrentView(){
  if(currentView === "library") renderLibrary();
  else if(currentView === "cart") renderCart();
  else if(currentView === "stats") renderStats();
}
function showView(name){
  currentView = name;
  Object.keys(VIEW_SECTIONS).forEach(function(k){ VIEW_SECTIONS[k].hidden = (k !== name); });
  Object.keys(VIEW_NAV_BTNS).forEach(function(k){ VIEW_NAV_BTNS[k].classList.toggle("is-active", k === name); });
  if(name === "add"){ switchTab("manual"); resetForm(); }
  refreshCurrentView();
}
function showLibrary(){ showView("library"); }
$("rnNavLibrary").addEventListener("click", function(){ showView("library"); });
$("rnNavSearch").addEventListener("click", function(){ showView("search"); elSearchInput.focus(); });
$("rnNavAdd").addEventListener("click", function(){ showView("add"); });
$("rnNavCart").addEventListener("click", function(){ showView("cart"); });
$("rnNavStats").addEventListener("click", function(){ showView("stats"); });
$("rnCancelAdd").addEventListener("click", showLibrary);

function switchTab(which){
  var manual = which === "manual";
  elTabManual.classList.toggle("is-active", manual);
  elTabLink.classList.toggle("is-active", !manual);
  elManualPane.hidden = !manual;
  elLinkPane.hidden = manual;
}
elTabManual.addEventListener("click", function(){ switchTab("manual"); });
elTabLink.addEventListener("click", function(){ switchTab("link"); });

elLoading.hidden = false;
Promise.all([loadLang(), loadTheme(), loadStats(), loadProfile(), loadAuth()]).then(function(){
  applyI18n();
  return loadRecipes();
}).then(function(){
  elLoading.hidden = true;
  applyI18n();
  updateStreakBadge();
  showLibrary();
  renderAccountState();
  maybeOpenSharedRecipeFromUrl();
  return authToken ? syncPull() : Promise.resolve();
}).then(function(){
  syncBootDone = true;
});

setInterval(function(){
  updateStreakBadge();
  if(currentView === "stats") renderStats();
}, 60000);
