"use strict";

// window.storage load/save helpers for recipes, stats, profile, plus data migrations.

function loadLang(){
  return window.storage.get("app-lang", false).then(function(res){
    if(res && (res.value === "bg" || res.value === "en")) LANG = res.value;
  }).catch(function(){});
}
function loadTheme(){
  return window.storage.get("app-theme", false).then(function(res){
    if(res && (res.value === "light" || res.value === "dark")) THEME = res.value;
  }).catch(function(){});
}
var DAY_MS = 24*60*60*1000;
function loadStats(){
  return window.storage.get("app-stats", false).then(function(res){
    var data = JSON.parse(res.value);
    if(data && typeof data === "object"){
      if(data.lastCookAt === undefined && data.lastCookDate){
        // migrate from the old calendar-date-only shape to a real timestamp
        var parts = String(data.lastCookDate).split("-");
        var approx = new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10), 12, 0, 0).getTime();
        data.lastCookAt = isNaN(approx) ? null : approx;
        data.streakCreditDate = data.lastCookDate;
      }
      stats = { streak: data.streak||0, lastCookAt: data.lastCookAt||null, streakCreditDate: data.streakCreditDate||null, totalCooked: data.totalCooked||0 };
    }
  }).catch(function(){ stats = { streak:0, lastCookAt:null, streakCreditDate:null, totalCooked:0 }; });
}
function saveStats(){
  return window.storage.set("app-stats", JSON.stringify(stats), false).catch(function(){});
}
function loadProfile(){
  return window.storage.get("app-profile", false).then(function(res){
    var data = JSON.parse(res.value);
    if(data && typeof data === "object"){ profile = data; }
  }).catch(function(){});
}
function saveProfile(){
  return window.storage.set("app-profile", JSON.stringify(profile), false).catch(function(){});
}
function todayKey(){
  var d = new Date();
  return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
}
// TikTok-style streak: a new completion continues the streak if it happens within
// 24h of the last one, but the count can only go up once per calendar day even if
// you cook several recipes in a row today.
function recordCookCompletion(){
  var now = Date.now();
  var today = todayKey();
  if(stats.streakCreditDate !== today){
    var withinWindow = stats.lastCookAt && (now - stats.lastCookAt <= DAY_MS);
    stats.streak = withinWindow ? (stats.streak||0) + 1 : 1;
    stats.streakCreditDate = today;
  }
  stats.lastCookAt = now;
  stats.totalCooked = (stats.totalCooked||0) + 1;
  saveStats();
}
function isStreakFrozen(){
  return (stats.streak||0) > 0 && !!stats.lastCookAt && (Date.now() - stats.lastCookAt > DAY_MS);
}
function loadRecipes(){
  return window.storage.get("recipes-library", false).then(function(res){
    var data = JSON.parse(res.value);
    if(!Array.isArray(data) || data.length === 0) throw new Error("empty");
    recipes = migrateTimers(migrateFavorites(data));
    return saveRecipes();
  }).catch(function(){
    recipes = migrateTimers(migrateFavorites([SEED_RECIPE]));
    return saveRecipes();
  });
}
function saveRecipes(){
  return window.storage.set("recipes-library", JSON.stringify(recipes), false).catch(function(err){
    console.error("Save failed:", err);
  });
}
// keep timers only on baking steps with a real duration — everything else stays plain
function migrateTimers(list){
  return list.map(function(r){
    r.steps = (r.steps||[]).map(function(s){
      if(s.timer && (VALID_TIMER_TYPES.indexOf(s.timer.type) === -1 || !(s.timer.seconds > 0))){ s.timer = null; }
      return s;
    });
    return r;
  });
}
function migrateFavorites(list){
  return list.map(function(r){
    if(typeof r.favorite !== "boolean") r.favorite = false;
    if(typeof r.myRating !== "number") r.myRating = 0;
    return r;
  });
}
