// Focused unit tests for the cooking-streak logic (js/core/storage.js) and
// the timer's time-formatting / ring-percentage math (js/timer/timer.js).
//
// Unlike tests/integration-test/run.mjs (which boots the entire real app
// against the real index.html), this loads only the real source files these
// functions live in, against a minimal fake DOM containing just the handful
// of elements their top-level code touches (see the id list in
// js/core/state.js and the two addEventListener calls in js/timer/timer.js).
// Faster than a full app boot, while still exercising the real, unmodified
// source rather than a re-implementation of the logic.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const html = `<!doctype html><html><body>
  <div id="rnRingWrap"></div>
  <svg><circle id="rnRingFg"></circle></svg>
  <div id="rnRingTime"></div>
  <button id="rnTimerBtn"></button>
  <button id="rnTimerResetBtn"></button>
</body></html>`;

const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/" });
const { window } = dom;
window.addEventListener("error", (e) => { console.error("WINDOW ERROR:", (e.error && e.error.stack) || e.message); });

function loadScript(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  const scriptEl = window.document.createElement("script");
  scriptEl.textContent = code;
  window.document.body.appendChild(scriptEl);
}

// Load just enough of the real app, in the real load order, for these
// functions to run: state.js (DOM refs, RING_CIRC, `stats`), storage-shim.js
// (backs window.storage with localStorage so saveStats() has something to
// call), storage.js (recordCookCompletion/isStreakFrozen), timer.js
// (fmtTime/updateRing).
loadScript("js/core/state.js");
loadScript("js/core/storage-shim.js");
loadScript("js/core/storage.js");
loadScript("js/timer/timer.js");

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); failures++; }
  else console.log("ok:", msg);
}

// ---------- fmtTime ----------
assert(window.fmtTime(0) === "00:00", "fmtTime(0) -> 00:00");
assert(window.fmtTime(5) === "00:05", "fmtTime(5) -> 00:05");
assert(window.fmtTime(65) === "01:05", "fmtTime(65) -> 01:05");
assert(window.fmtTime(600) === "10:00", "fmtTime(600) -> 10:00");
assert(window.fmtTime(3661) === "61:01", "fmtTime(3661) -> 61:01 (minutes aren't capped at 59)");
assert(window.fmtTime(-5) === "00:00", "fmtTime clamps negative input to 00:00");
assert(window.fmtTime(5.7) === "00:06", "fmtTime rounds fractional seconds");

// ---------- updateRing (percentage -> stroke-dashoffset, + the "urgent" class) ----------
function ringOffset() { return parseFloat(window.document.getElementById("rnRingFg").style.strokeDashoffset); }
function ringIsUrgent() { return window.document.getElementById("rnRingWrap").classList.contains("is-urgent"); }

window.updateRing(30, 60);
assert(window.document.getElementById("rnRingTime").textContent === "00:30", "updateRing sets the countdown text");
assert(Math.abs(ringOffset() - window.RING_CIRC * 0.5) < 0.001, "updateRing offsets the ring by half the circumference at 50% remaining");
assert(ringIsUrgent() === false, "ring isn't 'urgent' with 30s left");

window.updateRing(60, 60);
assert(Math.abs(ringOffset()) < 0.001, "updateRing's offset is 0 (full ring drawn) at 100% remaining");

window.updateRing(0, 60);
assert(Math.abs(ringOffset() - window.RING_CIRC) < 0.001, "updateRing's offset is the full circumference (ring empty) at 0% remaining");
assert(ringIsUrgent() === false, "ring is not 'urgent' at exactly 0s (done, not still counting down)");

window.updateRing(10, 60);
assert(ringIsUrgent() === true, "ring is 'urgent' at exactly 10s left");
window.updateRing(11, 60);
assert(ringIsUrgent() === false, "ring is not 'urgent' at 11s left");

window.updateRing(0, 0);
assert(window.document.getElementById("rnRingTime").textContent === "00:00", "updateRing handles a zero-length timer without dividing by zero");

// ---------- streak: recordCookCompletion / isStreakFrozen (TikTok-style: credited at most once/day, continues within 24h) ----------
function resetStats() { window.stats = { streak: 0, lastCookAt: null, streakCreditDate: null, totalCooked: 0 }; }

resetStats();
window.recordCookCompletion();
assert(window.stats.streak === 1, "first completion ever starts a streak of 1");
assert(window.stats.totalCooked === 1, "totalCooked increments on completion");

window.recordCookCompletion(); // same day, again
assert(window.stats.streak === 1, "a second completion the same day does not double-count the streak");
assert(window.stats.totalCooked === 2, "...but totalCooked still counts every completion");

resetStats();
window.stats.streak = 4;
window.stats.lastCookAt = Date.now() - 20 * 60 * 60 * 1000; // 20h ago
window.stats.streakCreditDate = "1999-01-01"; // a different calendar day than "today"
window.recordCookCompletion();
assert(window.stats.streak === 5, "cooking within 24h, on a new calendar day, continues the streak");

resetStats();
window.stats.streak = 7;
window.stats.lastCookAt = Date.now() - 30 * 60 * 60 * 1000; // 30h ago -- streak should have lapsed
window.stats.streakCreditDate = "1999-01-01";
window.recordCookCompletion();
assert(window.stats.streak === 1, "cooking more than 24h after the last completion resets the streak to 1");

resetStats();
window.stats.streak = 3;
window.stats.lastCookAt = Date.now() - 25 * 60 * 60 * 1000;
assert(window.isStreakFrozen() === true, "streak is frozen more than 24h after the last completion");

resetStats();
window.stats.streak = 3;
window.stats.lastCookAt = Date.now() - 2 * 60 * 60 * 1000;
assert(window.isStreakFrozen() === false, "streak is not frozen within 24h of the last completion");

resetStats();
assert(window.isStreakFrozen() === false, "a streak of 0 (never cooked) is never reported as frozen");

console.log(failures === 0 ? "\nALL FRONTEND UNIT TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
