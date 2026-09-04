"use strict";

// Step-by-step cooking mode: navigation, stickers, exit-confirm, and the finish/confetti screen.

function startCooking(recipe){
  activeRecipe = recipe;
  stepIndex = 0;
  buildSegbar();
  elExitConfirm.classList.remove("is-open");
  elCook.classList.add("is-open");
  renderStep();
}

function buildSegbar(){
  elSegbar.innerHTML = "";
  activeRecipe.steps.forEach(function(){
    var seg = document.createElement("div");
    seg.className = "rn-seg";
    seg.innerHTML = '<div class="rn-seg-fill"></div>';
    elSegbar.appendChild(seg);
  });
}
function updateSegbar(){
  var segs = elSegbar.querySelectorAll(".rn-seg-fill");
  segs.forEach(function(fill, i){ fill.style.width = (i <= stepIndex) ? "100%" : "0%"; });
}

function renderStep(){
  stopTimerInterval();
  var steps = activeRecipe.steps;
  var step = steps[stepIndex];
  elCookLabel.textContent = t("stepNumLabel") + " " + (stepIndex+1) + " " + t("cookStepOf") + " " + steps.length;
  updateSegbar();
  elStepText.textContent = step.text;
  elNextLabel.textContent = (stepIndex === steps.length - 1) ? t("finishBtn") : t("nextBtn");
  elBackBtn.hidden = (stepIndex === 0);

  var oldSticker = elStepCard.querySelector(".rn-sticker");
  if(oldSticker) oldSticker.remove();
  var stickerEmoji = pickSticker(step.text);
  if(stickerEmoji){
    var sticker = document.createElement("div");
    sticker.className = "rn-sticker";
    var corner = STICKER_CORNERS[Math.floor(Math.random()*STICKER_CORNERS.length)];
    var rot = (Math.random()*16 - 8).toFixed(1);
    sticker.setAttribute("style", corner + " --rot:"+rot+"deg;");
    sticker.textContent = stickerEmoji;
    elStepCard.appendChild(sticker);
  }

  elTimerDoneMsg.hidden = true;
  elTimerDoneMsg.textContent = "";
  elRingWrap.classList.remove("is-urgent");

  if(step.timer && step.timer.seconds > 0){
    elTimerBox.hidden = false;
    timerState = { seconds: step.timer.seconds, remaining: step.timer.seconds, status:"idle", endAt:null,
                   message: step.timer.message, label: step.timer.label };
    elTimerLabel.textContent = step.timer.label;
    elTimerBtn.textContent = t("timerStart");
    elTimerBtn.disabled = false;
    elTimerResetBtn.classList.remove("is-visible");
    updateRing(step.timer.seconds, step.timer.seconds);
  } else {
    elTimerBox.hidden = true;
    timerState = null;
  }
}

elNextBtn.addEventListener("click", function(){
  var steps = activeRecipe.steps;
  if(stepIndex < steps.length - 1){ stepIndex++; renderStep(); }
  else{ finishCooking(); }
});
elBackBtn.addEventListener("click", function(){
  if(stepIndex > 0){ stepIndex--; renderStep(); }
});

var elExitConfirm = $("rnExitConfirm");
elCookClose.addEventListener("click", function(){ elExitConfirm.classList.add("is-open"); });
$("rnExitCancelBtn").addEventListener("click", function(){ elExitConfirm.classList.remove("is-open"); });
$("rnExitConfirmBtn").addEventListener("click", function(){
  elExitConfirm.classList.remove("is-open");
  closeCooking();
});
function closeCooking(){
  stopTimerInterval(); timerState = null;
  elCook.classList.remove("is-open"); activeRecipe = null;
}

function spawnConfetti(){
  var colors = ["#FFC93C","#FF6B6B","#3DDC97","#4D96FF","#9D5CFF","#fff"];
  for(var i=0;i<28;i++){
    var el = document.createElement("div");
    el.className = "rn-confetti";
    el.style.left = (Math.random()*100)+"%";
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.animationDuration = (1.6 + Math.random()*1.2)+"s";
    el.style.animationDelay = (Math.random()*0.6)+"s";
    el.style.transform = "rotate("+Math.floor(Math.random()*360)+"deg)";
    elFinish.appendChild(el);
  }
}

function finishCooking(){
  stopTimerInterval();
  elCook.classList.remove("is-open");
  recordCookCompletion();
  updateStreakBadge();
  var pick = BON_APPETIT[Math.floor(Math.random()*BON_APPETIT.length)];
  elFinishMsg.textContent = pick.msg;
  var langName = LANG === "en" ? pick.langEn : pick.langBg;
  var intro = t("langWordIntro");
  if(pick.translation){
    var transText = LANG === "en" ? pick.translation.en : pick.translation.bg;
    elFinishLang.textContent = transText + " · " + intro + " " + langName;
  } else {
    elFinishLang.textContent = intro + " " + langName;
  }
  elFinish.querySelectorAll(".rn-confetti").forEach(function(c){ c.remove(); });
  spawnConfetti();
  elFinish.classList.add("is-open");
}

elFinishClose.addEventListener("click", function(){
  elFinish.classList.remove("is-open");
  activeRecipe = null;
  showLibrary();
});
