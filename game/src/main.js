// VICE CITY: Rise of Crime — boot + main loop + screenshot modes.
// Wires engine, city, player and input together and registers VC.game.
window.VC = window.VC || {};

(function boot() {
  var canvas = document.getElementById('game');
  var engine = VC.createEngine(canvas);
  var rng = VC.makeRng(20261119);
  var city = VC.buildCity(engine.scene, rng);
  var input = VC.createInput(canvas);
  var player = VC.createPlayer(engine.scene, city.colliders, engine.camera);
  var vehicles = VC.createVehicles(engine.scene, city, rng, player);
  var state = VC.createState();
  var npcs = VC.createNPCs(engine.scene, city, rng, state);
  var audio = VC.createAudio();
  var hud = VC.createHUD(state);
  var combat = VC.createCombat(engine.scene, state, npcs, audio);
  var police = VC.createPolice(engine.scene, city, rng, state, audio);
  var menu = VC.createMenu(state);
  var missions = VC.createMissions(engine.scene, state, hud, audio);

  VC.game = { engine: engine, city: city, player: player, input: input, vehicles: vehicles, driving: null, state: state, npcs: npcs, audio: audio, hud: hud, combat: combat, police: police, menu: menu, missions: missions, mission: missions, inputLocked: false };

  // Lets police/menu end a drive without a physical E press: one synthetic
  // rising edge through the vehicles module's own E handling.
  VC.game.requestExitCar = function () {
    if (vehicles.playerCar) {
      vehicles.update(0.0001, { keys: { KeyE: true }, lookDX: 0, lookDY: 0, wheel: 0, pressed: function () { return false; } });
    }
  };
  if (menu.active) VC.game.inputLocked = true;

  // Browsers unlock audio on the first real gesture.
  var resumeAudio = function () { audio.resume(); };
  window.addEventListener('pointerdown', resumeAudio);
  window.addEventListener('keydown', resumeAudio);

  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  VC.game.shot = shot;
  var frozen = false;

  if (shot === 'vista') {
    frozen = true;
    engine.setTimeOfDay(18.7 / 24); // golden hour
    player.teleport(40, -26);       // on the east-west avenue, downtown
    player.setCameraOverride(function (camera) {
      camera.position.set(53, 2.3, -18.5);
      camera.lookAt(-70, 7, -31);   // down the avenue, into the sunset
    });
  } else if (shot === 'beach') {
    frozen = true;
    engine.setTimeOfDay(0.5); // noon
    player.teleport(6, 268);
    player.setCameraOverride(function (camera) {
      camera.position.set(0, 24, 445);
      camera.lookAt(0, 10, -60);    // over the beach, facing the skyline
    });
  } else if (shot === 'drive') {
    frozen = true;
    engine.setTimeOfDay(0.79); // golden hour
    vehicles.stageShotDrive(); // player car westbound into the sunset, traffic around
  } else if (shot === 'street') {
    frozen = true;
    engine.setTimeOfDay(0.62); // late afternoon
    state.wanted = 2;          // show two wanted stars in the HUD
    player.teleport(-18.5, 40); // downtown sidewalk by the avenue
    npcs.scatterNear(-18.5, 40, 11); // guarantee a busy street
    player.setCameraOverride(function (camera) {
      camera.position.set(-6.5, 3.4, 54);
      camera.lookAt(-21, 1.1, 34); // across the street: player, peds, facades
    });
  } else if (shot === 'chase') {
    frozen = true;
    engine.setTimeOfDay(0.86); // dusk sliding into night
    state.wanted = 3;          // three stars: three units fielded
    vehicles.stageShotDrive(); // player car westbound, auto-driving
    police.stageChase();       // three units staged on its tail, lights flashing
  } else if (shot === 'mission') {
    frozen = true;
    engine.setTimeOfDay(0.66); // late afternoon
    player.teleport(174, 226); // on foot, just short of the docks pickup
    missions.startShot();      // M1 pickup phase, Marco's banner held up
    player.setCameraOverride(function (camera) {
      camera.position.set(162, 3.2, 213);
      camera.lookAt(188, 3.5, 240); // player, gold beacon, water behind
    });
  } else {
    engine.setTimeOfDay(0.45);
    player.teleport(-26, 40);
  }

  var IDLE_INPUT = { keys: {}, lookDX: 0, lookDY: 0, wheel: 0, pressed: function () { return false; } };
  var clock = new THREE.Clock();
  var booted = false;
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!frozen) engine.update(dt);
    if (city.update) city.update(dt);
    if (VC.game.inputLocked) {
      // menus / busted / wasted: the world idles, nobody takes input
      if (vehicles.playerCar) vehicles.update(dt, IDLE_INPUT);
      else { player.update(dt, IDLE_INPUT); vehicles.update(dt, null); }
    } else if (vehicles.playerCar) {
      vehicles.update(dt, input); // driving: vehicles owns physics + chase camera
    } else {
      player.update(dt, input);
      vehicles.update(dt, null);  // traffic only while on foot
    }
    combat.update(dt, input);
    police.update(dt);
    npcs.update(dt);
    missions.update(dt);
    hud.update(dt);
    menu.update(dt);
    var spd = vehicles.playerCar ? Math.min(1, Math.abs(vehicles.playerCar.speed) / 26) : 0;
    audio.engineSet(spd, !!vehicles.playerCar);
    engine.renderer.render(engine.scene, engine.camera);
    if (!booted) { booted = true; window.__booted = true; }
  }
  loop();
})();
