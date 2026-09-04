"use strict";

// The 5 timer categories (bake/fry/freeze/rest/proof) and the pause/resume/notify state machine.

// Timer is only ever shown on steps tied to one of these five categories.
var TIMER_TYPES = [
  {value:"bake",   labelKey:"timerBakeLabel",   msgKey:"timerBakeMessage"},
  {value:"fry",    labelKey:"timerFryLabel",    msgKey:"timerFryMessage"},
  {value:"freeze", labelKey:"timerFreezeLabel", msgKey:"timerFreezeMessage"},
  {value:"rest",   labelKey:"timerRestLabel",   msgKey:"timerRestMessage"},
  {value:"proof",  labelKey:"timerProofLabel",  msgKey:"timerProofMessage"}
];
var VALID_TIMER_TYPES = TIMER_TYPES.map(function(x){ return x.value; });
function timerTypeMeta(value){
  return TIMER_TYPES.filter(function(x){ return x.value === value; })[0] || TIMER_TYPES[0];
}
function fillTimerTypeSelect(el){
  var prevVal = el.value;
  el.innerHTML = "";
  TIMER_TYPES.forEach(function(x){
    var opt = document.createElement("option");
    opt.value = x.value; opt.textContent = t(x.labelKey);
    el.appendChild(opt);
  });
  if(TIMER_TYPES.some(function(x){return x.value===prevVal;})) el.value = prevVal;
}

function fmtTime(sec){
  sec = Math.max(0, Math.round(sec));
  var m = Math.floor(sec/60), s = sec%60;
  return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
}
function updateRing(remaining, total){
  elRingTime.textContent = fmtTime(remaining);
  var frac = total > 0 ? (remaining/total) : 0;
  elRingFg.style.strokeDashoffset = RING_CIRC * (1 - frac);
  elRingWrap.classList.toggle("is-urgent", remaining <= 10 && remaining > 0);
}

elTimerBtn.addEventListener("click", function(){
  if(!timerState || timerState.status === "done") return;
  if(timerState.status === "idle"){
    maybeAskNotifPermission();
    timerState.status = "running";
    timerState.endAt = Date.now() + timerState.remaining*1000;
    elTimerBtn.textContent = t("timerPause");
    elTimerResetBtn.classList.add("is-visible");
    tickTimer();
    timerTickHandle = setInterval(tickTimer, 250);
  } else if(timerState.status === "running"){
    stopTimerInterval();
    timerState.remaining = Math.max(0, (timerState.endAt - Date.now())/1000);
    timerState.status = "paused";
    elTimerBtn.textContent = t("timerResume");
  } else if(timerState.status === "paused"){
    timerState.status = "running";
    timerState.endAt = Date.now() + timerState.remaining*1000;
    elTimerBtn.textContent = t("timerPause");
    tickTimer();
    timerTickHandle = setInterval(tickTimer, 250);
  }
});

elTimerResetBtn.addEventListener("click", function(){
  if(!timerState) return;
  stopTimerInterval();
  timerState.status = "idle";
  timerState.remaining = timerState.seconds;
  elTimerBtn.disabled = false;
  elTimerBtn.textContent = t("timerStart");
  elTimerResetBtn.classList.remove("is-visible");
  elTimerDoneMsg.hidden = true;
  elRingWrap.classList.remove("is-urgent");
  updateRing(timerState.seconds, timerState.seconds);
});

function tickTimer(){
  if(!timerState) return;
  var remaining = (timerState.endAt - Date.now())/1000;
  if(remaining <= 0){
    updateRing(0, timerState.seconds);
    stopTimerInterval();
    timerState.status = "done";
    timerState.remaining = 0;
    timerDone();
    return;
  }
  timerState.remaining = remaining;
  updateRing(remaining, timerState.seconds);
}
function stopTimerInterval(){ if(timerTickHandle){ clearInterval(timerTickHandle); timerTickHandle = null; } }

function timerDone(){
  playBeep();
  elTimerDoneMsg.hidden = false;
  elTimerDoneMsg.textContent = "🎉 " + timerState.message;
  elTimerBtn.textContent = t("timerDone");
  elTimerBtn.disabled = true;
  if("Notification" in window && Notification.permission === "granted" && document.hidden){
    try{ new Notification(t("brandTitle"), { body: timerState.message }); }catch(e){}
  }
}
function maybeAskNotifPermission(){
  if(notifAsked) return;
  notifAsked = true;
  if("Notification" in window && Notification.permission === "default"){
    try{ Notification.requestPermission(); }catch(e){}
  }
}
function playBeep(){
  try{
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx();
    [0, 0.25, 0.5].forEach(function(t){
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.22);
    });
  }catch(e){}
}
