// VICE CITY: Rise of Crime — menu.js
// VC.createMenu(state, audio)
// DOM overlays: a start menu (title, controls, CLICK TO PLAY) and a pause
// overlay (Resume / Restart). Also owns the localStorage save helpers.
window.VC = window.VC || {};

VC.createMenu = function (state, audio) {
  'use strict';

  var SAVE_KEY = 'vicecity-save-v1';
  var started = false;

  var style = document.createElement('style');
  style.textContent =
    '.vc-overlay{position:fixed;inset:0;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;z-index:40;color:#fff;' +
    'font-family:"Segoe UI",system-ui,sans-serif;text-align:center;}' +
    '.vc-start{background:linear-gradient(160deg,#0b1035 0%,#3d1158 45%,#c22a6d 100%);}' +
    '.vc-pause{background:rgba(5,5,20,0.72);}' +
    '.vc-title{font-size:84px;font-weight:900;letter-spacing:6px;margin:0;' +
    'background:linear-gradient(180deg,#ffd76a,#ff5e8a);' +
    '-webkit-background-clip:text;background-clip:text;color:transparent;' +
    'text-shadow:0 4px 30px rgba(255,94,138,0.25);}' +
    '.vc-sub{font-size:30px;font-weight:300;letter-spacing:10px;margin:4px 0 28px;}' +
    '.vc-controls{font-size:16px;line-height:1.9;color:#e8e4ff;' +
    'background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.25);' +
    'border-radius:10px;padding:14px 30px;margin-bottom:30px;}' +
    '.vc-controls b{color:#ffd76a;font-weight:700;}' +
    '.vc-btn{pointer-events:auto;cursor:pointer;font-size:22px;font-weight:800;' +
    'letter-spacing:3px;color:#14101f;background:linear-gradient(180deg,#ffd76a,#ff9d5c);' +
    'border:none;border-radius:8px;padding:14px 44px;margin:6px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,0.45);}' +
    '.vc-btn:hover{filter:brightness(1.1);}' +
    '.vc-hint{position:fixed;left:10px;bottom:8px;z-index:30;color:rgba(255,255,255,0.65);' +
    'font-family:"Segoe UI",system-ui,sans-serif;font-size:12px;pointer-events:none;}';
  document.head.appendChild(style);

  var hint = document.createElement('div');
  hint.className = 'vc-hint';
  hint.textContent = 'Click the game to capture the mouse · Esc pauses';
  document.body.appendChild(hint);

  var startEl = document.createElement('div');
  startEl.className = 'vc-overlay vc-start';
  startEl.innerHTML =
    '<h1 class="vc-title">VICE CITY</h1>' +
    '<div class="vc-sub">RISE OF CRIME</div>' +
    '<div class="vc-controls">' +
    '<b>WASD</b> move &nbsp;·&nbsp; <b>Shift</b> sprint &nbsp;·&nbsp; <b>Space</b> jump<br>' +
    '<b>E</b> enter / exit car &nbsp;·&nbsp; <b>Q</b> draw weapon &nbsp;·&nbsp; <b>Mouse</b> fire<br>' +
    '<b>F</b> punch &nbsp;·&nbsp; <b>R</b> reload &nbsp;·&nbsp; <b>Esc</b> pause' +
    '</div>' +
    '<button class="vc-btn" id="vc-play">CLICK TO PLAY</button>';
  document.body.appendChild(startEl);

  var pauseEl = document.createElement('div');
  pauseEl.className = 'vc-overlay vc-pause';
  pauseEl.style.display = 'none';
  pauseEl.innerHTML =
    '<div class="vc-sub" style="font-size:44px;">PAUSED</div>' +
    '<button class="vc-btn" id="vc-resume">RESUME</button>' +
    '<button class="vc-btn" id="vc-restart">RESTART</button>';
  document.body.appendChild(pauseEl);

  var menu = {
    onStart: null,

    showStart: function () {
      startEl.style.display = 'flex';
      pauseEl.style.display = 'none';
    },

    togglePause: function () {
      if (!started) return;
      var showing = pauseEl.style.display !== 'none';
      pauseEl.style.display = showing ? 'none' : 'flex';
    },

    save: function (data) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
    },

    load: function () {
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }
  };

  Object.defineProperty(menu, 'visible', {
    get: function () {
      return startEl.style.display !== 'none' || pauseEl.style.display !== 'none';
    }
  });

  startEl.querySelector('#vc-play').addEventListener('click', function () {
    started = true;
    startEl.style.display = 'none';
    if (audio && typeof audio.resume === 'function') audio.resume();
    if (typeof menu.onStart === 'function') menu.onStart();
  });
  pauseEl.querySelector('#vc-resume').addEventListener('click', function () {
    pauseEl.style.display = 'none';
  });
  pauseEl.querySelector('#vc-restart').addEventListener('click', function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });

  return menu;
};
