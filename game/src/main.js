// VICE CITY: Rise of Crime — main.js
// Glue: builds every module, wires the VC.game registry, runs the loop.
// Handles input edges (E/Q/F/Esc), mouse fire, busted/wasted flows,
// autosave, and the ?shot= screenshot staging modes.
window.VC = window.VC || {};

(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var shotMode = params.get('shot');
  var isShot = !!shotMode;

  // VC.makeRng returns a helper object, but vehicles/npc call rng() as a
  // function — wrap it: callable, with the helper methods attached.
  var rngBase = VC.makeRng(20261119);
  var rng = function () { return rngBase.next(); };
  rng.next = rngBase.next;
  rng.range = rngBase.range;
  rng.int = rngBase.int;
  rng.pick = rngBase.pick;
  rng.chance = rngBase.chance;
  var engine = VC.createEngine(document.getElementById('app') || document.body);
  var city = VC.buildCity(engine.scene, rng, engine);
  var state = VC.createState();
  var input = VC.createInput(engine.renderer.domElement);
  var player = VC.createPlayer(engine.scene, city, input, engine);
  var vehicles = VC.createVehicles(engine.scene, city, rng, player);
  var npcs = VC.createNPCs(engine.scene, city, rng);
  var audio = VC.createAudio();
  var hud = VC.createHUD(state);
  var police = VC.createPolice(engine.scene, city, state, player);
  var combat = VC.createCombat(engine.scene, state, player, npcs, audio);
  var menu = VC.createMenu(state, audio);
  var missions = VC.createMissions(engine.scene, state, player, vehicles, hud, audio);

  window.VC.game = {
    state: state, input: input, player: player, vehicles: vehicles,
    npcs: npcs, police: police, combat: combat, mission: missions,
    audio: audio, engine: engine, driving: false
  };

  // --- restore save -------------------------------------------------------
  var save = menu.load();
  if (save) {
    if (typeof save.cash === 'number') state.cash = save.cash;
    if (typeof save.health === 'number') state.health = save.health;
    if (typeof save.x === 'number' && typeof save.z === 'number') {
      player.teleport(save.x, save.z);
    }
  }

  // --- consequences -------------------------------------------------------
  police.onBusted = function () {
    hud.showOverlay('busted');
    if (audio) audio.sting();
    missions.notifyBusted();
    state.wanted = 0;
    if (typeof state.heal === 'function') state.heal(Math.max(0, 50 - state.health));
    if (state.health < 50) state.health = 50;
    vehicles.requestExitCar();
    player.teleport(0, 156);
  };

  function wasted() {
    hud.showOverlay('wasted');
    if (audio) audio.sting();
    state.addCash(-Math.floor(state.cash * 0.1));
    state.health = 100;
    vehicles.requestExitCar();
    player.teleport(26, 26); // hospital corner
  }

  // --- input edges ----------------------------------------------------------
  var prevKeys = {};
  function edge(code) {
    var now = !!input.keys[code];
    var was = !!prevKeys[code];
    return now && !was;
  }

  engine.renderer.domElement.addEventListener('pointerdown', function () {
    if (!menu.visible) combat.fire();
  });

  // --- shot staging ---------------------------------------------------------
  if (isShot) {
    // The menu overlays are visible by default; hide them for staging.
    var overlays = document.querySelectorAll('.vc-overlay');
    for (var oi = 0; oi < overlays.length; oi++) overlays[oi].style.display = 'none';
    engine.setFrozen(true);
    engine.setTimeOfDay(0.36);
    if (shotMode === 'cover') {
      player.teleport(24, 120);
      player.setCameraOverride(function (camera) {
        var p = player.position;
        camera.position.set(p.x + 10, p.y + 6, p.z + 14);
        camera.lookAt(p.x, p.y + 2, p.z);
      });
    } else if (shotMode === 'drive') {
      vehicles.stageShotDrive();
    } else if (shotMode === 'chase') {
      police.stageShotChase();
    } else if (shotMode === 'mission') {
      missions.stageShotMission();
    }
  } else {
    menu.showStart();
  }

  // --- autosave ---------------------------------------------------------------
  var saveTimer = 0;

  // --- main loop ----------------------------------------------------------------
  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (dt <= 0) dt = 0.001;

    if (!menu.visible || isShot) {
      if (edge('KeyE')) vehicles.tryEnterExit();
      if (edge('KeyQ')) combat.toggleArmed();
      if (edge('KeyF')) combat.punch();
      if (edge('Escape')) menu.togglePause();

      engine.update(dt);
      if (!window.VC.game.driving) player.update(dt);
      vehicles.update(dt);
      npcs.update(dt);
      police.update(dt);
      combat.update(dt);
      missions.update(dt);
      hud.update(dt);

      if (state.health <= 0) wasted();

      saveTimer += dt;
      if (saveTimer >= 25) {
        saveTimer = 0;
        menu.save({
          cash: state.cash, health: state.health,
          x: player.position.x, z: player.position.z
        });
      }
    } else {
      engine.update(dt);
      if (edge('Escape')) menu.togglePause();
    }

    prevKeys = Object.assign({}, input.keys);
    engine.renderer.render(engine.scene, engine.camera);
  }
  requestAnimationFrame(frame);
})();
