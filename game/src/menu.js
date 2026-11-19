// VICE CITY: Rise of Crime — start menu, pause menu and save/load.
// The start menu floats over the live city (slow orbit camera) and locks
// gameplay input until dismissed; P / Esc pauses. Progress autosaves to
// localStorage every 25 s of play. Screenshot modes never see the menu.
window.VC = window.VC || {};

VC.createMenu = function (state) {
  var SAVE_KEY = 'vicecity-save-v1';
  var SPAWN = { x: -26, z: 40 };
  var isShot = /[?&]shot=/.test(window.location.search);

  var active = false;   // start menu visible
  var paused = false;
  var orbitAngle = 0.6;
  var orbitApplied = false;
  var autosaveT = 0;
  var prevPauseKey = false;

  var CSS = [
    '#vc-menu,#vc-pause{position:fixed;inset:0;z-index:60;display:none;',
    'align-items:center;justify-content:center;flex-direction:column;',
    'background:radial-gradient(ellipse at 50% 65%,rgba(20,8,32,.25),rgba(8,4,20,.78));',
    'font-family:"Segoe UI",Arial,sans-serif;color:#fff;text-align:center;}',
    '#vc-menu .ttl{font-size:74px;font-weight:900;letter-spacing:6px;line-height:.95;',
    'background:linear-gradient(180deg,#ffd93c 15%,#ff7ac0 55%,#b45cff);',
    '-webkit-background-clip:text;background-clip:text;color:transparent;',
    'text-shadow:0 4px 30px rgba(255,90,180,.25);}',
    '#vc-menu .sub{font-size:19px;font-weight:700;letter-spacing:9px;color:#7ce7f4;',
    'margin:6px 0 34px;}',
    '.vc-btn{display:block;min-width:260px;margin:7px auto;padding:13px 30px;',
    'font-size:18px;font-weight:800;letter-spacing:3px;color:#fff;cursor:pointer;',
    'background:linear-gradient(180deg,rgba(255,122,192,.28),rgba(120,40,180,.28));',
    'border:2px solid rgba(255,217,60,.75);border-radius:8px;}',
    '.vc-btn:hover{background:linear-gradient(180deg,rgba(255,217,60,.45),rgba(255,122,192,.4));',
    'box-shadow:0 0 22px rgba(255,150,200,.45);}',
    '#vc-menu .ctl{margin-top:30px;font-size:14px;line-height:1.75;color:#cfd6ff;',
    'letter-spacing:1px;}',
    '#vc-menu .ctl b{color:#ffd93c;}',
    '#vc-pause .ttl{font-size:44px;font-weight:900;letter-spacing:6px;color:#ffd93c;',
    'margin-bottom:22px;}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstChild;
  }

  var menuEl = el(
    '<div id="vc-menu">' +
      '<div class="ttl">VICE CITY</div>' +
      '<div class="sub">RISE OF CRIME</div>' +
      '<button class="vc-btn" id="vc-new">NEW GAME</button>' +
      '<button class="vc-btn" id="vc-continue">CONTINUE</button>' +
      '<div class="ctl">' +
        '<b>WASD</b> move &nbsp;·&nbsp; <b>DRAG</b> look &nbsp;·&nbsp; <b>E</b> enter / exit car &nbsp;·&nbsp; ' +
        '<b>Q</b> arm &nbsp;·&nbsp; <b>CLICK</b> shoot &nbsp;·&nbsp; <b>F</b> punch<br>' +
        '<b>R</b> reload &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>SHIFT</b> sprint &nbsp;·&nbsp; ' +
        '<b>SPACE</b> jump / handbrake' +
      '</div>' +
    '</div>');
  var pauseEl = el(
    '<div id="vc-pause">' +
      '<div class="ttl">PAUSED</div>' +
      '<button class="vc-btn" id="vc-resume">RESUME</button>' +
      '<button class="vc-btn" id="vc-save">SAVE GAME</button>' +
      '<button class="vc-btn" id="vc-new2">NEW GAME</button>' +
    '</div>');
  document.body.appendChild(menuEl);
  document.body.appendChild(pauseEl);

  function game() { return window.VC.game || null; }

  function readSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function hasSave() { return !!readSave(); }

  function writeSave() {
    var g = game();
    if (!g || !g.player) return;
    var pos = g.player.position;
    if (g.driving && g.vehicles && g.vehicles.playerCar) pos = g.vehicles.playerCar.group.position;
    var data = {
      cash: state.cash, health: state.health,
      ammo: state.ammo, reserveAmmo: state.reserveAmmo,
      x: Math.round(pos.x * 10) / 10, z: Math.round(pos.z * 10) / 10,
      tod: g.engine && g.engine.getTimeOfDay ? g.engine.getTimeOfDay() : 0.45
    };
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function orbitFn(camera) {
    camera.position.set(Math.cos(orbitAngle) * 58, 17, 10 + Math.sin(orbitAngle) * 58);
    camera.lookAt(0, 5, 0);
  }
  function applyOrbit() {
    var g = game();
    if (g && g.player && g.player.setCameraOverride) {
      g.player.setCameraOverride(orbitFn);
      orbitApplied = true;
    }
  }
  function clearOrbit() {
    var g = game();
    if (orbitApplied && g && g.player && g.player.setCameraOverride) {
      g.player.setCameraOverride(null);
    }
    orbitApplied = false;
  }

  function showStart() {
    active = true;
    paused = false;
    pauseEl.style.display = 'none';
    menuEl.querySelector('#vc-continue').style.display = hasSave() ? 'block' : 'none';
    menuEl.style.display = 'flex';
    var g = game();
    if (g) g.inputLocked = true;
    applyOrbit();
  }
  function dismiss() {
    active = false;
    paused = false;
    menuEl.style.display = 'none';
    pauseEl.style.display = 'none';
    clearOrbit();
    var g = game();
    if (g) g.inputLocked = false;
  }

  function startGame(load) {
    var g = game();
    if (!g || !g.player) return;
    if (g.driving && g.requestExitCar) g.requestExitCar();
    if (load) {
      var s = readSave();
      if (s) {
        state.cash = s.cash; state.health = s.health;
        state.ammo = s.ammo; state.reserveAmmo = s.reserveAmmo;
        state.wanted = 0;
        g.player.teleport(s.x, s.z);
        if (g.engine && typeof s.tod === 'number') g.engine.setTimeOfDay(s.tod);
      }
    } else {
      state.cash = 250; state.health = state.maxHealth; state.wanted = 0;
      state.ammo = 60; state.reserveAmmo = 240; state.kills = 0; state.crimes = 0;
      g.player.teleport(SPAWN.x, SPAWN.z);
    }
    if (g.audio) g.audio.blip();
    dismiss();
  }

  function setPaused(on) {
    if (active || isShot) return;
    paused = on;
    pauseEl.style.display = on ? 'flex' : 'none';
    var g = game();
    if (g) g.inputLocked = on;
  }

  menuEl.querySelector('#vc-new').addEventListener('click', function () { startGame(false); });
  menuEl.querySelector('#vc-continue').addEventListener('click', function () { startGame(true); });
  pauseEl.querySelector('#vc-resume').addEventListener('click', function () {
    var g = game(); if (g && g.audio) g.audio.blip();
    setPaused(false);
  });
  pauseEl.querySelector('#vc-save').addEventListener('click', function () {
    writeSave();
    var g = game();
    if (g && g.audio) g.audio.blip();
    if (g && g.hud) g.hud.banner('SAVED', 'Progress stored in this browser', 1800);
  });
  pauseEl.querySelector('#vc-new2').addEventListener('click', function () { startGame(false); });

  if (!isShot) showStart();

  function update(dt) {
    if (isShot) return;
    if (active) {
      orbitAngle += dt * 0.05;
      if (!orbitApplied) applyOrbit();
      var g0 = game();
      if (g0 && !g0.inputLocked) g0.inputLocked = true;
      return;
    }
    var g = game();
    if (!g || !g.input) return;

    var pNow = !!(g.input.keys.KeyP || g.input.keys.Escape);
    if (pNow && !prevPauseKey && (paused || !g.inputLocked)) {
      setPaused(!paused);
      if (g.audio) g.audio.blip();
    }
    prevPauseKey = pNow;

    if (!paused) {
      autosaveT += dt;
      if (autosaveT >= 25) {
        autosaveT = 0;
        writeSave();
      }
    }
  }

  var api = { update: update, save: writeSave };
  Object.defineProperty(api, 'active', { get: function () { return active || paused; } });
  return api;
};
