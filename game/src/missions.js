// VICE CITY: Rise of Crime — story missions: Marco's three-job chain.
// A fixer named MARCO feeds the player jobs through HUD banners. A gold
// beacon pillar + crate marks the current target; the same target feeds
// the HUD minimap through api.marker ({x, z} or null).
window.VC = window.VC || {};

VC.createMissions = function (scene, state, hud, audio) {
  function game() { return window.VC.game || {}; }

  // ---- world anchors (road corners / beach, from the city grid) ----
  var DOCKS = { x: 182, z: 234 };   // south-east corner, down by the water
  var GARAGE = { x: 26, z: -26 };   // Marco's garage, downtown corner
  var CAR_SPOT = { x: 71, z: 73 };  // gold convertible parked off Palm Ave
  var PIER = { x: 0, z: 244 };      // beach pier, south edge centre
  var REACH = 5;

  var INTRO_LINE = 'Got a package waiting at the docks. Bring it to my garage.';

  // ---- beacon: gold pillar of light + ground ring + target crate ----
  var beacon = new THREE.Group();
  var beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd93c, transparent: true, opacity: 0.3,
    depthWrite: false, side: THREE.DoubleSide
  });
  var beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 36, 20, 1, true), beamMat);
  beam.position.y = 18;
  beacon.add(beam);
  var ring = new THREE.Mesh(
    new THREE.RingGeometry(2.7, 3.6, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffd93c, transparent: true, opacity: 0.75,
      depthWrite: false, side: THREE.DoubleSide
    }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  beacon.add(ring);
  var crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xc9922e, roughness: 0.6, metalness: 0.25 }));
  crate.position.y = 0.55;
  beacon.add(crate);
  beacon.visible = false;
  scene.add(beacon);

  // ---- the gold convertible (decorative M2 target; the vehicles module
  // exposes no spawn API, so the "take" is reaching the car) ----
  var goldCar = (function buildGoldCar() {
    var grp = new THREE.Group();
    var gold = new THREE.MeshStandardMaterial({
      color: 0xd4af37, metalness: 0.85, roughness: 0.32
    });
    var dark = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.72, 2.0), gold);
    body.position.y = 0.58;
    grp.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.8), gold);
    nose.position.set(2.4, 0.48, 0);
    grp.add(nose);
    var seatL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.7), dark);
    seatL.position.set(-0.4, 0.95, -0.45);
    grp.add(seatL);
    var seatR = seatL.clone();
    seatR.position.z = 0.45;
    grp.add(seatR);
    var shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.55, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.4 }));
    shield.position.set(0.75, 1.05, 0);
    shield.rotation.z = -0.35;
    grp.add(shield);
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
    var spots = [[1.55, 1.0], [1.55, -1.0], [-1.55, 1.0], [-1.55, -1.0]];
    for (var i = 0; i < spots.length; i++) {
      var w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(spots[i][0], 0.38, spots[i][1]);
      grp.add(w);
    }
    grp.position.set(CAR_SPOT.x, 0, CAR_SPOT.z);
    grp.rotation.y = Math.PI / 2; // parked facing north along the kerb
    grp.visible = false;
    scene.add(grp);
    return grp;
  })();

  // ---- banner queue (hud.banner is fire-and-forget; sequence here) ----
  var queue = [];
  var showing = 0;
  function say(title, sub, ms) { queue.push({ t: title, s: sub, ms: ms || 3800 }); }
  function pumpQueue(dt) {
    if (showing > 0) { showing -= dt; return; }
    if (!queue.length) return;
    var it = queue.shift();
    hud.banner(it.t, it.s, it.ms);
    showing = it.ms / 1000;
  }

  // ---- chain state ----
  var started = false;
  var index = 0;              // 0,1,2 = mission; 3 = chain complete
  var phase = 'idle';         // idle|to-pickup|to-garage|breather|to-car|deliver|m3-pickup|escape|done
  var breatherT = 0;
  var doneT = 0;
  var freeRoamSaid = false;
  var menuFree = 0;
  var elapsed = 0;
  var prevPos = null;         // M3 teleport watch
  var holdT = -1;             // >= 0 in the mission shot: re-show the intro

  var TARGETS = {
    'to-pickup': DOCKS,
    'to-garage': GARAGE,
    'to-car': CAR_SPOT,
    'deliver': GARAGE,
    'm3-pickup': GARAGE,
    'escape': PIER
  };
  var NAMES = ['First Run', 'Hot Wheels', 'The Last Job'];

  function target() { return TARGETS[phase] || null; }

  function playerPos() {
    var g = game();
    if (g.vehicles && g.vehicles.playerCar && g.vehicles.playerCar.group) {
      return g.vehicles.playerCar.group.position;
    }
    return g.player ? g.player.position : null;
  }
  function distTo(p, t) {
    var dx = p.x - t.x, dz = p.z - t.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function beginChain() {
    started = true;
    index = 0;
    phase = 'to-pickup';
    say('MARCO', INTRO_LINE, 4400);
    if (audio && audio.blip) audio.blip();
  }

  function completeMission(cash, line) {
    state.addCash(cash);
    if (audio && audio.blip) audio.blip();
    say('MARCO', line, 3600);
    phase = 'breather';
    breatherT = 6;
  }

  function startNext() {
    if (index === 1) {
      phase = 'to-car';
      goldCar.visible = true;
      say('MARCO', 'One more thing — a gold convertible, parked up on Palm Avenue. Take it, bring it to my garage.', 4800);
    } else if (index === 2) {
      phase = 'm3-pickup';
      say('MARCO', 'Last job. Pick up the package at my garage, then run it to the pier. The heat will come — lose them at the beach.', 5000);
    }
  }

  function failEscape() {
    phase = 'm3-pickup';
    prevPos = null;
    say('VICE CITY', "The job's blown — head back to the garage to retry.", 4200);
    if (audio && audio.sting) audio.sting();
  }

  function finishEscape() {
    state.addCash(1200);
    if (audio && audio.blip) audio.blip();
    say('MARCO', "You made it. Vice City is yours. +$1,200", 4200);
    say('VICE CITY', 'STORY COMPLETE', 4200);
    index = 3;
    phase = 'done';
    doneT = 10;
  }

  function update(dt) {
    elapsed += dt;
    pumpQueue(dt);

    // shot mode: keep Marco's intro banner on screen for the capture
    if (holdT >= 0) {
      holdT -= dt;
      if (holdT <= 0) { hud.banner('MARCO', INTRO_LINE, 2800); holdT = 2.6; }
    }

    // ---- start detection: fire once the menu first lets go ----
    if (!started) {
      var g0 = game();
      if (g0.shot && g0.shot !== 'mission') return; // stay quiet in other shots
      var menu = g0.menu;
      if (!menu || !menu.active) {
        menuFree += dt;
        if (menuFree > 1.2) beginChain();
      } else {
        menuFree = 0;
      }
      return;
    }

    // ---- beacon follows the current target ----
    var t = target();
    if (t) {
      beacon.visible = true;
      beacon.position.set(t.x, 0, t.z);
      beamMat.opacity = 0.24 + 0.1 * Math.sin(elapsed * 3);
      ring.rotation.z = elapsed * 0.7;
    } else {
      beacon.visible = false;
    }

    if (phase === 'breather') {
      breatherT -= dt;
      if (breatherT <= 0) startNext();
      return;
    }
    if (phase === 'done') {
      if (!freeRoamSaid) {
        doneT -= dt;
        if (doneT <= 0) {
          freeRoamSaid = true;
          say('VICE CITY', 'Free roam — the city is open.', 4000);
        }
      }
      return;
    }
    if (!t) return;

    var p = playerPos();
    if (!p) return;

    // ---- M3 escape: a sudden teleport = busted/wasted = job blown ----
    if (phase === 'escape') {
      if (prevPos) {
        var jx = p.x - prevPos.x, jz = p.z - prevPos.z;
        if (jx * jx + jz * jz > 3600) { failEscape(); prevPos = null; return; }
      }
      prevPos = { x: p.x, z: p.z };
    }

    if (distTo(p, t) > REACH) return;

    // ---- arrivals ----
    if (phase === 'to-pickup') {
      if (audio && audio.pickup) audio.pickup();
      say('VICE CITY', "Package secured — get it to Marco's garage.", 3600);
      phase = 'to-garage';
    } else if (phase === 'to-garage') {
      index = 1;
      completeMission(400, 'Clean work. +$400');
    } else if (phase === 'to-car') {
      goldCar.visible = false; // taken
      if (audio && audio.pickup) audio.pickup();
      state.wanted = Math.max(state.wanted, 2);
      say('VICE CITY', "This is the one — get it to Marco's garage.", 3600);
      phase = 'deliver';
    } else if (phase === 'deliver') {
      index = 2;
      completeMission(750, 'Beautiful. +$750');
    } else if (phase === 'm3-pickup') {
      if (audio && audio.pickup) audio.pickup();
      state.wanted = 3;
      say('VICE CITY', 'Package aboard — RUN. Get to the pier.', 3600);
      phase = 'escape';
      prevPos = { x: p.x, z: p.z };
    } else if (phase === 'escape') {
      finishEscape();
    }
  }

  var api = {
    update: update,
    startShot: function () {
      started = true;
      index = 0;
      phase = 'to-pickup';
      queue.length = 0;
      hud.banner('MARCO', INTRO_LINE, 2800);
      holdT = 2.6;
    }
  };
  Object.defineProperty(api, 'marker', {
    get: function () {
      var t = started ? target() : null;
      return t ? { x: t.x, z: t.z } : null;
    }
  });
  Object.defineProperty(api, 'active', {
    get: function () {
      if (!started || index >= 3) return null;
      return { index: index, name: NAMES[index], phase: phase };
    }
  });
  Object.defineProperty(api, 'index', {
    get: function () { return index; }
  });
  return api;
};
