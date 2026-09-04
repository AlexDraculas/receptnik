"use strict";

// Shopping cart tab: ingredient checklist, cached cost estimate, and substitutes.

function ingredientsHash(ingredients){ return hashStr(JSON.stringify(ingredients||[])); }

function buildCartDropIn(dropIn, r){
  if(!Array.isArray(r.shoppingChecked) || r.shoppingChecked.length !== r.ingredients.length){
    r.shoppingChecked = r.ingredients.map(function(_, i){ return !!(r.shoppingChecked && r.shoppingChecked[i]); });
  }
  var list = document.createElement("div");
  list.className = "rn-cart-ingredients";
  r.ingredients.forEach(function(ing, idx){
    var row = document.createElement("div");
    row.className = "rn-cart-item";
    var checked = !!r.shoppingChecked[idx];
    row.innerHTML =
      '<span class="rn-cart-check'+(checked?' is-checked':'')+'"></span>' +
      '<span class="rn-cart-item-text'+(checked?' is-checked':'')+'">'+escapeHtml(ing)+'</span>';
    row.addEventListener("click", function(e){
      e.stopPropagation();
      var nowChecked = !r.shoppingChecked[idx];
      r.shoppingChecked[idx] = nowChecked;
      row.querySelector(".rn-cart-check").classList.toggle("is-checked", nowChecked);
      row.querySelector(".rn-cart-item-text").classList.toggle("is-checked", nowChecked);
      saveRecipes();
    });
    list.appendChild(row);
  });
  dropIn.appendChild(list);

  var divider = document.createElement("div");
  divider.className = "rn-cart-divider";
  dropIn.appendChild(divider);

  var costBox = document.createElement("div");
  costBox.className = "rn-cart-cost";
  dropIn.appendChild(costBox);

  ensureCostEstimate(r, costBox);
}

function renderCostBlock(containerEl, cache){
  var subsHtml = "";
  if(cache.substitutes && cache.substitutes.length){
    subsHtml = '<div class="rn-cart-subs-title">'+t("substitutesTitle")+'</div>' +
      cache.substitutes.map(function(s){
        return '<div class="rn-sub-row">🔄 <b>'+escapeHtml(s.original)+'</b> → '+escapeHtml(s.alternative)+'</div>';
      }).join("");
  }
  containerEl.innerHTML =
    '<div class="rn-cart-total">'+t("totalCostLabel")+': <b>'+cache.totalEur.toFixed(2)+' €</b></div>' +
    subsHtml +
    '<div class="rn-cart-cost-note">'+t("costNote")+'</div>';
}

function ensureCostEstimate(recipe, containerEl){
  var hash = ingredientsHash(recipe.ingredients);
  if(recipe.costCache && recipe.costCache.hash === hash){
    renderCostBlock(containerEl, recipe.costCache);
    return;
  }
  containerEl.innerHTML = '<span class="rn-spin"></span>'+t("costLoading");
  fetchCostEstimate(recipe.ingredients).then(function(data){
    recipe.costCache = {
      hash: hash,
      totalEur: (typeof data.totalEur === "number") ? data.totalEur : 0,
      substitutes: Array.isArray(data.substitutes) ? data.substitutes : [],
      fetchedAt: Date.now()
    };
    saveRecipes();
    renderCostBlock(containerEl, recipe.costCache);
  }).catch(function(err){
    console.error("Cost estimate failed:", err);
    containerEl.innerHTML = '<span style="color:var(--coral-d); font-weight:700; font-size:13px;">'+t("costError")+'</span>';
  });
}

function fetchCostEstimate(ingredients){
  var contentLang = LANG === "en" ? "English" : "Bulgarian";
  var prompt = "Here is a recipe's ingredient list:\n" + ingredients.map(function(i){return "- "+i;}).join("\n") + "\n\n" +
    "Estimate the combined total cost in EUR to buy all of these at a Bulgarian supermarket (Billa, Kaufland or Lidl), using realistic current prices. " +
    "Also pick up to 3 ingredients from the list that are the most likely to be out of stock or hard to find in one of these chains, and suggest a reasonable substitute for each, in " + contentLang + ".\n" +
    "Return ONLY this JSON, nothing else: {\"totalEur\":11.40,\"substitutes\":[{\"original\":\"...\",\"alternative\":\"...\"}]}";

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }]
    })
  }).then(function(res){
    if(!res.ok){ throw new Error("HTTP " + res.status); }
    return res.json();
  }).then(function(data){
    return extractJsonFromResponse(data);
  });
}

function renderCart(){
  renderSortToggle(elSortCart, renderCart);
  renderCardsInto(elCartList, sortRecipeList(recipes), elCartEmpty, "cart");
}
