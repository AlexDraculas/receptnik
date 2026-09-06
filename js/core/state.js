"use strict";

// Shared DOM references and core in-memory state, used by every other file.

var recipes = [];
var stats = { streak:0, lastCookAt:null, streakCreditDate:null, totalCooked:0 };
var profile = { name:"", avatar:"🧑‍🍳" };
var filters = { cuisine:"all", style:"all", favoritesOnly:false, query:"" };
var openCardId = null;
var activeRecipe = null;
var stepIndex = 0;
var timerState = null;
var timerTickHandle = null;
var notifAsked = false;

var $ = function(id){ return document.getElementById(id); };
var elList = $("rnList"), elEmpty = $("rnEmpty"), elCount = $("rnCount"), elLoading = $("rnLoading");
var elHomeGreeting = $("rnHomeGreeting"), elHeroSection = $("rnHeroSection"), elHeroRow = $("rnHeroRow"), elHeroSeeAll = $("rnHeroSeeAll"), elProgressRow = $("rnProgressRow");
var elLibrarySearch = $("rnLibrarySearch");
var elEmptyTitle = $("rnEmptyTitle"), elEmptyBody = $("rnEmptyBody");
var elFavToggle = $("rnFavToggle"), elFavToggleIcon = $("rnFavToggleIcon"), elFavToggleLabel = $("rnFavToggleLabel");
var elChipsCuisine = $("rnChipsCuisine"), elChipsStyle = $("rnChipsStyle"), elSortLibrary = $("rnSortLibrary");
var elViewLibrary = $("rnViewLibrary"), elViewAdd = $("rnViewAdd"), elViewSearch = $("rnViewSearch"), elViewStats = $("rnViewStats"), elViewCart = $("rnViewCart");
var elSearchForm = $("rnSearchForm"), elSearchInput = $("rnSearchInput"), elSearchResults = $("rnSearchResults"), elSearchEmpty = $("rnSearchEmpty"), elSearchStatus = $("rnSearchStatus");
var elCartList = $("rnCartList"), elCartEmpty = $("rnCartEmpty"), elSortCart = $("rnSortCart");
var elAvatarBtn = $("rnAvatarBtn"), elProfileName = $("rnProfileName");
var elGoogleBtn = $("rnGoogleBtn"), elAppleBtn = $("rnAppleBtn"), elOauthNote = $("rnOauthNote");
var elOauthSignedIn = $("rnOauthSignedIn"), elGoogleAvatarImg = $("rnGoogleAvatarImg"), elGoogleName = $("rnGoogleName"), elGoogleEmail = $("rnGoogleEmail"), elGoogleSignOutBtn = $("rnGoogleSignOutBtn");
var elAccountLoggedOut = $("rnAccountLoggedOut"), elAccountSignedIn = $("rnAccountSignedIn"), elAccountEmail = $("rnAccountEmail"), elAccountSyncStatus = $("rnAccountSyncStatus"), elAccountLogoutBtn = $("rnAccountLogoutBtn");
var elAccountTabLogin = $("rnAccountTabLogin"), elAccountTabRegister = $("rnAccountTabRegister");
var elLoginForm = $("rnLoginForm"), elLoginEmail = $("rnLoginEmail"), elLoginPassword = $("rnLoginPassword"), elLoginSubmitBtn = $("rnLoginSubmitBtn");
var elRegisterForm = $("rnRegisterForm"), elRegisterEmail = $("rnRegisterEmail"), elRegisterPassword = $("rnRegisterPassword"), elRegisterPasswordConfirm = $("rnRegisterPasswordConfirm"), elRegisterSubmitBtn = $("rnRegisterSubmitBtn");
var elForgotPasswordLink = $("rnForgotPasswordLink"), elForgotForm = $("rnForgotForm"), elForgotEmail = $("rnForgotEmail"), elForgotSendBtn = $("rnForgotSendBtn"), elForgotBackLink1 = $("rnForgotBackLink1");
var elResetForm = $("rnResetForm"), elResetCode = $("rnResetCode"), elResetPassword = $("rnResetPassword"), elResetSubmitBtn = $("rnResetSubmitBtn"), elForgotBackLink2 = $("rnForgotBackLink2");
var elAccountStatus = $("rnAccountStatus");
var elLangBg = $("rnLangBg"), elLangEn = $("rnLangEn");
var elThemeBtn = $("rnThemeBtn");
var elForm = $("rnForm");
var elIngList = $("rnIngList"), elStepList = $("rnStepList");
var elCuisineSel = $("rnCuisine"), elStyleSel = $("rnStyle");
var elCuisineOtherWrap = $("rnCuisineOtherWrap"), elStyleOtherWrap = $("rnStyleOtherWrap");
var elCuisineOther = $("rnCuisineOther"), elStyleOther = $("rnStyleOther");

var elTabManual = $("rnTabManual"), elTabLink = $("rnTabLink");
var elManualPane = $("rnManualPane"), elLinkPane = $("rnLinkPane");
var elLinkUrl = $("rnLinkUrl"), elLinkExtractBtn = $("rnLinkExtractBtn"), elLinkStatus = $("rnLinkStatus");

var elCook = $("rnCook"), elSegbar = $("rnSegbar"), elCookLabel = $("rnCookLabel");
var elStepText = $("rnStepText"), elCookClose = $("rnCookClose"), elStepCard = $("rnStepCard");
var elTimerBox = $("rnTimerBox"), elRingWrap = $("rnRingWrap"), elRingFg = $("rnRingFg"), elRingTime = $("rnRingTime");
var elTimerLabel = $("rnTimerLabel"), elTimerBtn = $("rnTimerBtn"), elTimerResetBtn = $("rnTimerResetBtn"), elTimerDoneMsg = $("rnTimerDoneMsg");
var elNextBtn = $("rnNextBtn"), elNextLabel = $("rnNextLabel"), elBackBtn = $("rnBackBtn");

var elFinish = $("rnFinish"), elFinishMsg = $("rnFinishMsg"), elFinishLang = $("rnFinishLang"), elFinishClose = $("rnFinishClose");

var RING_CIRC = 2 * Math.PI * 64;

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function hashStr(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return Math.abs(h); }
function cuisineEmoji(c){ return CUISINE_EMOJI[c] || "🍽️"; }
function cuisineColor(c){ return CARD_COLORS[hashStr(c||"x") % CARD_COLORS.length]; }
function countLabel(n){
  if(LANG === "en"){ return n + (n===1 ? " recipe" : " recipes"); }
  return n + (n===1 ? " рецепта" : " рецепти");
}
function stepsLabel(n){
  if(LANG === "en"){ return n + (n===1 ? " step" : " steps"); }
  return n + (n===1 ? " стъпка" : " стъпки");
}
function streakLabelFor(n){
  if(LANG === "en"){ return n===1 ? "day streak" : "day streak"; }
  return n===1 ? "ден поред" : "дни поред";
}
