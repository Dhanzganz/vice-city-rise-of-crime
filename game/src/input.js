// VICE CITY: Rise of Crime — keyboard + mouse input.
// Keys are tracked by KeyboardEvent.code; mouse drag deltas accumulate until the
// player consumes them each frame; wheel accumulates the same way.
window.VC = window.VC || {};

VC.createInput = function (canvas) {
  var input = {
    keys: {},
    lookDX: 0,
    lookDY: 0,
    wheel: 0,
    dragging: false,
    pressed: function (code) { return !!input.keys[code]; }
  };

  window.addEventListener('keydown', function (e) {
    input.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });
  window.addEventListener('blur', function () { input.keys = {}; });

  canvas.addEventListener('pointerdown', function (e) {
    input.dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!input.dragging) return;
    input.lookDX += e.movementX || 0;
    input.lookDY += e.movementY || 0;
  });
  function endDrag(e) { input.dragging = false; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', function (e) {
    input.wheel += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  return input;
};
