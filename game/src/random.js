'use strict';
/* VICE CITY: Rise of Crime — random.js
 * VC.makeRng(seed): a mulberry32 PRNG with small helpers.
 * Deterministic per seed so the city builds the same way every run. */
window.VC = window.VC || {};

VC.makeRng = function (seed) {
  let a = (seed >>> 0) || 0x9e3779b9;

  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next: next,
    /* float in [a, b) */
    range: function (a, b) { return a + next() * (b - a); },
    /* integer in [a, b], both ends inclusive */
    int: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    chance: function (p) { return next() < p; }
  };
};
