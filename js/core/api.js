"use strict";

// Small shared helpers for talking to the Anthropic API from the browser.

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
