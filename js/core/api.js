"use strict";

// Small shared helpers for talking to the Anthropic API from the browser.
//
// IMPORTANT: the three AI-powered features (dish search, "add from link",
// cart cost estimate) do NOT call api.anthropic.com directly anymore — a
// browser can't do that safely (no way to hold a real API key without
// exposing it to every visitor, and the Anthropic API isn't meant to be
// called cross-origin like that outside Claude.ai's own artifact sandbox).
// Instead they call your own small server-side proxy, which holds the real
// key. See worker/anthropic-proxy.js for that proxy's code and deploy steps.
//
// After you deploy the worker (see worker/DEPLOY.md), paste its URL here:
var AI_PROXY_URL = "https://recipe-ai-proxy.alexcvetanovv.workers.dev/";
// This must exactly match the APP_TOKEN variable you set on the Worker — it
// already does, as long as you copy it from worker/DEPLOY.md and don't change it.
var AI_APP_TOKEN = "5efd620ed796863fda7c69ea8ec509fa";

function apiTextOf(data){
  if(data && data.type === "error"){
    throw new Error((data.error && data.error.message) || "API error");
  }
  return (data.content||[]).filter(function(b){return b.type==="text";}).map(function(b){return b.text;}).join("\n").trim();
}

function extractJsonFromResponse(data){
  var raw = apiTextOf(data);
  raw = raw.replace(/```json/gi,"").replace(/```/g,"").trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if(start === -1 || end === -1) throw new Error("no-json");
  return JSON.parse(raw.slice(start, end+1));
}
