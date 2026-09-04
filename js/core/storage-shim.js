"use strict";

// window.storage is a Claude.ai-artifact-only API. When this file runs on its
// own (e.g. GitHub Pages), it won't exist — so we back it with localStorage
// instead, using the exact same async get/set/delete/list shape, so nothing
// else in this project has to know or care which one it's talking to.
var HAS_NATIVE_STORAGE = !!(window.storage && window.storage.get && window.storage.set);
var STANDALONE_MODE = !HAS_NATIVE_STORAGE;

if (STANDALONE_MODE) {
  (function () {
    var PREFIX = "recipebook:";
    window.storage = {
      get: function (key) {
        return new Promise(function (resolve, reject) {
          try {
            var raw = window.localStorage.getItem(PREFIX + key);
            if (raw === null) { reject(new Error("not found")); return; }
            resolve({ key: key, value: raw });
          } catch (e) { reject(e); }
        });
      },
      set: function (key, value) {
        return new Promise(function (resolve, reject) {
          try { window.localStorage.setItem(PREFIX + key, value); resolve({ key: key, value: value }); }
          catch (e) { reject(e); }
        });
      },
      delete: function (key) {
        return new Promise(function (resolve) {
          try { window.localStorage.removeItem(PREFIX + key); } catch (e) {}
          resolve({ key: key, deleted: true });
        });
      },
      list: function (prefix) {
        return new Promise(function (resolve) {
          var keys = [];
          try {
            for (var i = 0; i < window.localStorage.length; i++) {
              var k = window.localStorage.key(i);
              if (k && k.indexOf(PREFIX) === 0) {
                var stripped = k.slice(PREFIX.length);
                if (!prefix || stripped.indexOf(prefix) === 0) keys.push(stripped);
              }
            }
          } catch (e) {}
          resolve({ keys: keys, prefix: prefix });
        });
      }
    };
  })();
}
