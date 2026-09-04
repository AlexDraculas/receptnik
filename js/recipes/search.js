"use strict";

// Web dish search (known recipe sites) and "add from link" import, both via the Anthropic API.

var lastSearchResults = [];

function setSearchStatus(text, kind){
  elSearchStatus.className = "rn-link-status" + (kind ? " is-"+kind : "") + " " + (kind ? "" : "");
  elSearchStatus.style.textAlign = "center";
  elSearchStatus.innerHTML = text;
}

function starsHtml(rating){
  var pct = Math.max(0, Math.min(5, rating || 0)) / 5 * 100;
  return '<span class="rn-stars" style="--pct:'+pct+'%">★★★★★</span>';
}

function renderSearchResults(results){
  elSearchResults.innerHTML = "";
  elSearchEmpty.hidden = results.length !== 0;
  results.forEach(function(res, i){
    var card = document.createElement("div");
    card.className = "rn-card";
    card.style.animationDelay = (i*0.05)+"s";
    var body = document.createElement("div");
    body.className = "rn-card-head";
    body.style.cursor = "default";
    body.style.flexWrap = "wrap";
    body.style.flex = "1";
    body.style.minWidth = "0";
    var ratingHtml = (typeof res.rating === "number")
      ? starsHtml(res.rating) + ' <span style="font-size:12px; font-weight:800; color:var(--muted);">'+res.rating.toFixed(1)+'</span>'
      : "";
    body.innerHTML =
      '<div class="rn-medallion" style="background:'+CARD_COLORS[i % CARD_COLORS.length]+'">🌐</div>' +
      '<div style="flex:1; min-width:0;">' +
        '<p class="rn-card-title" style="white-space:normal;">'+escapeHtml(res.title||"")+'</p>' +
        '<div class="rn-card-meta">'+escapeHtml(res.site||"")+'</div>' +
        '<div style="margin-top:6px;">'+ratingHtml+'</div>' +
      '</div>';
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "rn-3d c-mint rn-start-btn";
    addBtn.style.flex = "none";
    addBtn.textContent = t("searchAddBtn");
    addBtn.addEventListener("click", function(){
      addBtn.disabled = true;
      addBtn.textContent = "…";
      importRecipeFromUrl(res.url, res.title||"").then(function(){
        addBtn.disabled = false;
        addBtn.textContent = t("searchAddBtn");
        showView("add");
      }).catch(function(err){
        console.error(err);
        addBtn.disabled = false;
        addBtn.textContent = t("searchAddBtn");
        setSearchStatus(t("linkStatusError"), "error");
      });
    });
    card.appendChild(body);
    card.appendChild(addBtn);
    card.style.display = "flex";
    card.style.alignItems = "center";
    card.style.gap = "10px";
    card.style.padding = "4px 8px 4px 4px";
    elSearchResults.appendChild(card);
  });
}

function extractSearchResults(data){
  var raw = apiTextOf(data);
  raw = raw.replace(/```json/gi,"").replace(/```/g,"");
  try {
    var start = raw.indexOf("{");
    var end = raw.lastIndexOf("}");
    if(start > -1 && end > -1){
      var parsed = JSON.parse(raw.slice(start, end+1));
      if(Array.isArray(parsed.results)) return parsed.results;
    }
  } catch(e){ /* fall through to the scraper below — the JSON may be truncated */ }
  // Fallback: pull out individual {site,title,url,rating} objects even from
  // truncated/slightly malformed JSON, so a cut-off response still shows results.
  var results = [];
  var re = /\{\s*"site"\s*:\s*"([^"]*)"\s*,\s*"title"\s*:\s*"([^"]*)"\s*,\s*"url"\s*:\s*"([^"]*)"(?:\s*,\s*"rating"\s*:\s*([\d.]+))?/g;
  var m;
  while((m = re.exec(raw)) !== null){
    results.push({ site:m[1], title:m[2], url:m[3], rating: m[4] ? parseFloat(m[4]) : undefined });
  }
  return results;
}

function performDishSearch(query){
  setSearchStatus('<span class="rn-spin"></span>'+t("searchStatusLoading"), "loading");
  elSearchResults.innerHTML = "";
  elSearchEmpty.hidden = true;

  var prompt = "Search well-known recipe/cooking sites (AllRecipes, BBC Good Food, Food Network, Serious Eats, Epicurious, NYT Cooking, Tasty, Bon Appétit, etc.) for the dish: \"" + query + "\".\n" +
    "Find up to 4 real recipe pages for it, from different sites where possible. For each: site name, exact recipe title, its real URL, and its rating out of 5 as shown on the page (a number, e.g. 4.6) — omit \"rating\" entirely if you didn't actually see one, never guess it.\n" +
    "Sort by rating, highest first (unrated ones last). Keep title and site short.\n" +
    "Respond with ONLY this JSON, nothing else, no markdown fences, no explanation: {\"results\":[{\"site\":\"...\",\"title\":\"...\",\"url\":\"...\",\"rating\":4.6}]}";

  fetch("https://api.anthropic.com/v1/messages", {
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
    })
    .then(function(data){
      var results = extractSearchResults(data);
      results = results.filter(function(r){ return r && r.url && r.title; });
      lastSearchResults = results;
      if(results.length === 0){
        setSearchStatus("", "");
        elSearchEmpty.hidden = false;
        elSearchEmpty.querySelector(".rn-empty-emoji").textContent = "🔍";
        elSearchEmpty.querySelector("p").textContent = t("emptyTitle");
        elSearchEmpty.querySelector("div").textContent = t("emptyBody");
      } else {
        setSearchStatus("", "");
        renderSearchResults(results);
      }
    })
    .catch(function(err){
      console.error("Dish search failed:", err);
      setSearchStatus(t("linkStatusError") + (err && err.message ? ' <span style="opacity:.6;">('+escapeHtml(err.message)+')</span>' : ""), "error");
    });
}

elSearchForm.addEventListener("submit", function(e){
  e.preventDefault();
  var q = elSearchInput.value.trim();
  if(!q) return;
  performDishSearch(q);
});

function setLinkStatus(text, kind){
  elLinkStatus.className = "rn-link-status" + (kind ? " is-"+kind : "");
  elLinkStatus.innerHTML = text;
}

function timerFromApiStep(s){
  if(!s || !s.timerMinutes) return null;
  var mins = parseFloat(s.timerMinutes) || 0;
  if(mins <= 0) return null;
  var meta = timerTypeMeta(s.timerType);
  return { seconds: Math.round(mins*60), type: meta.value, label: t(meta.labelKey), message: t(meta.msgKey) };
}

function populateFormFromImported(data){
  $("rnName").value = data.name || "";
  $("rnDesc").value = data.description || "";
  $("rnTime").value = data.time || "";

  if(CUISINES.indexOf(data.cuisine) > -1){
    elCuisineSel.value = data.cuisine; elCuisineOtherWrap.style.display = "none";
  } else {
    elCuisineSel.value = "Друга"; elCuisineOtherWrap.style.display = "block"; elCuisineOther.value = data.cuisine || "";
  }
  if(STYLES.indexOf(data.style) > -1){
    elStyleSel.value = data.style; elStyleOtherWrap.style.display = "none";
  } else {
    elStyleSel.value = "Друго"; elStyleOtherWrap.style.display = "block"; elStyleOther.value = data.style || "";
  }

  elIngList.innerHTML = "";
  (data.ingredients || []).forEach(function(ing){ addIngredientRow(ing); });
  if(elIngList.children.length === 0) addIngredientRow("");

  elStepList.innerHTML = "";
  (data.steps || []).forEach(function(s){ addStepRow({ text: s.text || "", timer: timerFromApiStep(s) }); });
  if(elStepList.children.length === 0) addStepRow();
}

// Shared extraction call used by both "add from link" and "add from a search result".
// hintTitle (optional) is the recipe title already known from a search result, to anchor the lookup.
function importRecipeFromUrl(url, hintTitle){
  var contentLang = LANG === "en" ? "English" : "Bulgarian";
  var hintLine = hintTitle ? ("The recipe is titled \"" + hintTitle + "\" — use that to confirm you found the right page.\n") : "";
  var prompt = "Here is a link to a recipe page or video: " + url + "\n" + hintLine +
    "Search the web and read this recipe (dish, ingredients, quantities, steps). If you can't access this exact page, make your best-informed guess from the URL/title and similar well-known recipes for this dish.\n" +
    "Return ONLY valid JSON, no markdown, no explanation, in this exact shape:\n" +
    '{"name":"...","cuisine":"one of: '+CUISINES.join(", ")+'","style":"one of: '+STYLES.join(", ")+'","description":"short, under 20 words","time":"total time, e.g. \'35 min\'","ingredients":["..."],"steps":[{"text":"short imperative instruction","timerMinutes":null,"timerType":null}]}\n' +
    "IMPORTANT — every field must be filled in, never leave anything blank or null except timerMinutes/timerType: pick the closest matching \"cuisine\" and \"style\" even if you have to guess, write a real \"description\" and a realistic \"time\" estimate, and include actual quantities in each ingredient. Never write placeholders like 'unknown' or 'N/A' — always give your best concrete answer instead.\n" +
    "Write name/description/ingredients/steps in " + contentLang + ". The \"cuisine\" and \"style\" values themselves must stay exactly one of the listed options (fixed category names, do not translate them). No more than 12 ingredients and 8 steps. Set timerMinutes and timerType ONLY on steps that involve baking, frying, freezing, resting/setting, or proofing dough — timerType must then be exactly one of \"bake\", \"fry\", \"freeze\", \"rest\", \"proof\". On every other step both must be null.";

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
    })
    .then(function(data){
      var parsed = extractJsonFromResponse(data);
      populateFormFromImported(parsed);
      switchTab("manual");
      return parsed;
    });
}

elLinkExtractBtn.addEventListener("click", function(){
  var url = elLinkUrl.value.trim();
  if(!url){ setLinkStatus(t("linkStatusEmpty"), "error"); return; }

  elLinkExtractBtn.disabled = true;
  setLinkStatus('<span class="rn-spin"></span>'+t("linkStatusLoading"), "loading");

  importRecipeFromUrl(url).then(function(){
    setLinkStatus(t("linkStatusSuccess"), "");
  }).catch(function(err){
    console.error("Link import failed:", err);
    setLinkStatus(t("linkStatusError") + (err && err.message ? ' <span style="opacity:.6;">('+escapeHtml(err.message)+')</span>' : ""), "error");
  }).finally(function(){ elLinkExtractBtn.disabled = false; });
});
