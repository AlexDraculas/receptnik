"use strict";

// The manual "add a recipe" form: ingredient/step rows and saving a new recipe.

function addIngredientRow(value){
  var row = document.createElement("div");
  row.className = "rn-ing-row";
  row.innerHTML =
    '<input type="text" placeholder="'+escapeHtml(t("ingredientPlaceholder"))+'" value="'+escapeHtml(value||"")+'" class="rn-ing-input">' +
    '<button type="button" class="rn-remove-btn">✕</button>';
  row.querySelector(".rn-remove-btn").addEventListener("click", function(){ row.remove(); });
  elIngList.appendChild(row);
}

function addStepRow(prefill){
  var idx = elStepList.children.length + 1;
  var row = document.createElement("div");
  row.className = "rn-step-row";
  row.innerHTML =
    '<div class="rn-step-row-head"><span class="rn-step-num">'+t("stepNumLabel")+' '+idx+'</span><button type="button" class="rn-remove-btn">✕</button></div>' +
    '<textarea class="rn-step-text" placeholder="'+escapeHtml(t("stepTextPlaceholder"))+'" rows="2"></textarea>' +
    '<label class="rn-timer-toggle"><input type="checkbox" class="rn-step-hastimer"> '+t("timerCheckboxLabel")+'</label>' +
    '<div class="rn-timer-fields">' +
      '<div class="rn-field"><label>'+t("timerTypeLabel")+'</label><select class="rn-step-type"></select></div>' +
      '<div class="rn-field"><label>'+t("timerMinutesLabel")+'</label><input type="number" min="1" class="rn-step-minutes" value="10"></div>' +
      '<div class="rn-field full"><label>'+t("timerMessageLabel")+'</label><input type="text" class="rn-step-message" placeholder="'+escapeHtml(t("timerBakeMessage"))+'"></div>' +
    '</div>';
  var cb = row.querySelector(".rn-step-hastimer");
  var fields = row.querySelector(".rn-timer-fields");
  var typeSel = row.querySelector(".rn-step-type");
  fillTimerTypeSelect(typeSel);
  cb.addEventListener("change", function(){ fields.classList.toggle("is-visible", cb.checked); });
  row.querySelector(".rn-remove-btn").addEventListener("click", function(){ row.remove(); renumberSteps(); });

  if(prefill){
    row.querySelector(".rn-step-text").value = prefill.text || "";
    if(prefill.timer){
      cb.checked = true;
      fields.classList.add("is-visible");
      typeSel.value = prefill.timer.type || "bake";
      row.querySelector(".rn-step-minutes").value = Math.max(1, Math.round(prefill.timer.seconds/60));
      row.querySelector(".rn-step-message").value = prefill.timer.message || "";
    }
  }
  elStepList.appendChild(row);
}

function renumberSteps(){
  elStepList.querySelectorAll(".rn-step-row").forEach(function(row, i){
    row.querySelector(".rn-step-num").textContent = t("stepNumLabel") + " " + (i+1);
  });
}

$("rnAddIng").addEventListener("click", function(){ addIngredientRow(""); });
$("rnAddStep").addEventListener("click", function(){ addStepRow(); });

function resetForm(){
  elForm.reset();
  elIngList.innerHTML = ""; elStepList.innerHTML = "";
  addIngredientRow(""); addIngredientRow("");
  addStepRow(); addStepRow();
  elCuisineOtherWrap.style.display = "none";
  elStyleOtherWrap.style.display = "none";
  elLinkUrl.value = "";
  elLinkStatus.className = "rn-link-status";
  elLinkStatus.textContent = "";
}

fillSelectTranslated(elCuisineSel, CUISINES, cuisineLabel);
fillSelectTranslated(elStyleSel, STYLES, styleLabel);
elCuisineSel.addEventListener("change", function(){
  elCuisineOtherWrap.style.display = (elCuisineSel.value === "Друга") ? "block" : "none";
});
elStyleSel.addEventListener("change", function(){
  elStyleOtherWrap.style.display = (elStyleSel.value === "Друго") ? "block" : "none";
});

elForm.addEventListener("submit", function(e){
  e.preventDefault();
  var name = $("rnName").value.trim();
  if(!name) return;

  var cuisine = elCuisineSel.value === "Друга" ? (elCuisineOther.value.trim() || "Друга") : elCuisineSel.value;
  var style = elStyleSel.value === "Друго" ? (elStyleOther.value.trim() || "Друго") : elStyleSel.value;

  var ingredients = Array.prototype.map.call(elIngList.querySelectorAll(".rn-ing-input"), function(i){ return i.value.trim(); })
    .filter(function(v){ return v; });

  var steps = [];
  elStepList.querySelectorAll(".rn-step-row").forEach(function(row){
    var text = row.querySelector(".rn-step-text").value.trim();
    if(!text) return;
    var hasTimer = row.querySelector(".rn-step-hastimer").checked;
    var timer = null;
    if(hasTimer){
      var minutesRaw = parseFloat(row.querySelector(".rn-step-minutes").value);
      var minutes = (minutesRaw > 0) ? minutesRaw : 0;
      if(minutes > 0){
        var customMsg = row.querySelector(".rn-step-message").value.trim();
        var typeVal = row.querySelector(".rn-step-type").value;
        var meta = timerTypeMeta(typeVal);
        timer = { seconds: Math.round(minutes*60), type: meta.value, label: t(meta.labelKey), message: customMsg || t(meta.msgKey) };
      }
    }
    steps.push({text:text, timer:timer});
  });
  if(steps.length === 0) return;

  var recipe = {
    id: "r-" + Date.now() + "-" + Math.random().toString(36).slice(2,8),
    name: name, cuisine: cuisine, style: style,
    description: $("rnDesc").value.trim(), time: $("rnTime").value.trim(),
    dateAdded: Date.now(), ingredients: ingredients, steps: steps,
    favorite: false, myRating: 0
  };
  recipes.push(recipe);
  saveRecipes().then(function(){ showLibrary(); });
});
