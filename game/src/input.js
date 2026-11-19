'use strict';
/* VICE CITY: Rise of Crime — input.js
 * VC.createInput(canvas): keyboard levels + pointer-lock mouse look.
 * `keys`/`pressed` are the same live object keyed by e.code; the main loop
 * reads levels and edge-detects itself. Mouse deltas accumulate until
 * takeLook() consumes them; wheel deltas until takeWheel(). */
window.VC = window.VC || {};

VC.createInput = function (canvas) {
  const keys = {};
  let lookDX = 0, lookDY = 0, wheelDelta = 0;

  const PREVENT = { Space: true, ArrowUp: true, ArrowDown: true, ArrowLeft: true, ArrowRight: true };

  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (PREVENT[e.code]) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
    if (PREVENT[e.code]) e.preventDefault();
  });
  window.addEventListener('blur', function () {
    for (const k in keys) keys[k] = false;
  });

  canvas.addEventListener('click', function () {
    if (document.pointerLockElement !== canvas) {
      const p = canvas.requestPointerLock && canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () { /* headless / denied: ignore */ });
    }
  });
  document.addEventListener('mousemove', function (e) {
    if (document.pointerLockElement === canvas) {
      lookDX += e.movementX || 0;
      lookDY += e.movementY || 0;
    }
  });
  canvas.addEventListener('wheel', function (e) {
    wheelDelta += e.deltaY || 0;
    e.preventDefault();
  }, { passive: false });

  return {
    keys: keys,
    pressed: keys,
    isDown: function (code) { return !!keys[code]; },
    takeLook: function () {
      const r = { dx: lookDX, dy: lookDY };
      lookDX = 0; lookDY = 0;
      return r;
    },
    takeWheel: function () {
      const w = wheelDelta;
      wheelDelta = 0;
      return w;
    }
  };
};
