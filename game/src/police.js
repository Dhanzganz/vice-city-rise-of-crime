// VICE CITY: Rise of Crime — police.js
// VC.createPolice(scene, city, state, player)
// Four patrol units with a wanted-level system. The police module owns
// state.wanted: 'crime' events raise it, quiet time decays it. Units pursue
// the player (on foot or in a car); on foot, sustained close contact busts.
window.VC = window.VC || {};

VC.createPolice = function (scene, city, state, player) {
  'use strict';

  var MAX_SPEED = 26;
  var BUST_RANGE = 7;
  var BUST_TIME = 2.5;
  var DECAY_DELAY = 12;
  var DECAY_RATE = 0.05;

  var sinceCrime = 0;
  var bustTimer = 0;
  var sirenOn = false;
  var lightPhase = 0;

  // --- simple cop-car factory -------------------------------------------
  function buildCopCar() {
    var g = new THREE.Group();
    var black = new THREE.MeshLambertMaterial({ color: 0x14161c });
    var white = new THREE.MeshLambertMaterial({ color: 0xf2f3f5 });
    var glass = new THREE.MeshLambertMaterial({ color: 0x1b2a3a });

    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.4), black);
    body.position.y = 0.55;
    g.add(body);
    var doors = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.5, 2.2), white);
    doors.position.set(0, 0.62, 0.1);
    g.add(doors);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.0), glass);
    cabin.position.set(0, 1.05, -0.1);
    g.add(cabin);

    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
    var wx = [-0.95, 0.95], wz = [-1.45, 1.45];
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 2; j++) {
        var w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx[i], 0.36, wz[j]);
        g.add(w);
      }
    }

    // Light bar: red left, blue right, both emissive; flashed in update().
    var barBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barBase.position.set(0, 1.36, -0.1);
    g.add(barBase);
    var redMat = new THREE.MeshLambertMaterial({ color: 0x550000, emissive: 0xff2020 });
    var blueMat = new THREE.MeshLambertMaterial({ color: 0x000055, emissive: 0x2040ff });
    var red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.34), redMat);
    red.position.set(-0.38, 1.48, -0.1);
    g.add(red);
    var blue = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.34), blueMat);
    blue.position.set(0.38, 1.48, -0.1);
    g.add(blue);

    return { group: g, redMat: redMat, blueMat: blueMat };
  }

  // Depots: quiet corners where inactive units sit hidden.
  var depots = [
    { x: -234, z: -234 }, { x: 234, z: -234 },
    { x: -234, z: 234 }, { x: 234, z: 234 }
  ];

  var units = [];
  for (var u = 0; u < 4; u++) {
    var built = buildCopCar();
    built.group.position.set(depots[u].x, 0, depots[u].z);
    built.group.visible = false;
    scene.add(built.group);
    units.push({
      group: built.group,
      redMat: built.redMat,
      blueMat: built.blueMat,
      speed: 0,
      heading: 0,
      active: false
    });
  }

  // Wanted rises with crime; this module owns the value.
  if (state && typeof state.on === 'function') {
    state.on('crime', function (ev) {
      var level = ev && typeof ev.level === 'number' ? ev.level : 1;
      state.wanted = Math.min(5, (state.wanted || 0) + 0.5 * level);
      sinceCrime = 0;
    });
  }

  function activeCount() {
    var w = state.wanted || 0;
    if (w < 1) return 0;
    return Math.min(units.length, Math.ceil(w));
  }

  function targetPos() {
    var game = window.VC.game;
    if (game && game.driving && game.vehicles && game.vehicles.playerCar) {
      return game.vehicles.playerCar.group.position;
    }
    return player.position;
  }

  function spawnNear(unit, tp) {
    // Pick a road point roughly 70 u from the player: try lane offsets along
    // the two nearest centrelines, fall back to a straight offset.
    var offs = [
      { x: 70, z: 0 }, { x: -70, z: 0 }, { x: 0, z: 70 }, { x: 0, z: -70 },
      { x: 50, z: 50 }, { x: -50, z: -50 }, { x: 50, z: -50 }, { x: -50, z: 50 }
    ];
    var o = offs[Math.floor(Math.random() * offs.length)];
    var x = tp.x + o.x, z = tp.z + o.z;
    x = Math.max(city.bounds.minX, Math.min(city.bounds.maxX, x));
    z = Math.max(city.bounds.minZ, Math.min(city.bounds.maxZ, z));
    unit.group.position.set(x, 0, z);
    unit.heading = Math.atan2(tp.x - x, tp.z - z);
    unit.group.rotation.y = unit.heading;
    unit.speed = 0;
  }

  // Circle-vs-AABB slide, mirroring the city collider shape {minX,...}.
  function collide(pos, radius) {
    var cols = city.colliders || [];
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var nx = Math.max(c.minX, Math.min(c.maxX, pos.x));
      var nz = Math.max(c.minZ, Math.min(c.maxZ, pos.z));
      var dx = pos.x - nx, dz = pos.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          var d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          pos.x = c.maxX + radius;
        }
      }
    }
    pos.x = Math.max(city.bounds.minX, Math.min(city.bounds.maxX, pos.x));
    pos.z = Math.max(city.bounds.minZ, Math.min(city.bounds.maxZ, pos.z));
  }

  function setSiren(on) {
    if (on === sirenOn) return;
    sirenOn = on;
    var game = window.VC.game;
    if (game && game.audio && typeof game.audio.sirenSet === 'function') {
      game.audio.sirenSet(on);
    }
  }

  var police = {
    units: units,
    onBusted: null,

    update: function (dt) {
      sinceCrime += dt;
      if (sinceCrime > DECAY_DELAY && state.wanted > 0) {
        state.wanted = Math.max(0, state.wanted - DECAY_RATE * dt);
        if (state.wanted < 1 && state.wanted > 0) state.wanted = 0;
      }

      var want = activeCount();
      var tp = targetPos();
      var game = window.VC.game;
      var driving = !!(game && game.driving);
      var anyClose = false;
      lightPhase += dt * 6;

      for (var i = 0; i < units.length; i++) {
        var unit = units[i];
        var shouldBeActive = i < want;
        if (shouldBeActive && !unit.active) {
          unit.active = true;
          unit.group.visible = true;
          spawnNear(unit, tp);
        } else if (!shouldBeActive && unit.active) {
          unit.active = false;
          unit.group.visible = false;
          unit.speed = 0;
          unit.group.position.set(depots[i].x, 0, depots[i].z);
        }
        if (!unit.active) continue;

        // Flash the light bar.
        var phase = (Math.sin(lightPhase + i) > 0);
        unit.redMat.emissive.setHex(phase ? 0xff2020 : 0x330000);
        unit.blueMat.emissive.setHex(phase ? 0x330000 : 0x2040ff);

        var pos = unit.group.position;
        var dx = tp.x - pos.x, dz = tp.z - pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        var desired = Math.atan2(dx, dz);
        var diff = desired - unit.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        unit.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        unit.group.rotation.y = unit.heading;

        var targetSpeed = MAX_SPEED;
        if (dist < 10) targetSpeed = MAX_SPEED * (dist / 10) + 4;
        if (dist < 3.2) targetSpeed = 0; // nose to nose: hold
        if (unit.speed < targetSpeed) unit.speed = Math.min(targetSpeed, unit.speed + 18 * dt);
        else unit.speed = Math.max(targetSpeed, unit.speed - 30 * dt);

        pos.x += Math.sin(unit.heading) * unit.speed * dt;
        pos.z += Math.cos(unit.heading) * unit.speed * dt;
        collide(pos, 1.6);

        if (!driving && dist < BUST_RANGE) anyClose = true;
      }

      setSiren(want > 0);

      // Bust logic: only on foot, sustained close contact.
      if (!driving && want > 0 && anyClose) {
        bustTimer += dt;
        if (bustTimer >= BUST_TIME) {
          bustTimer = 0;
          for (var k = 0; k < units.length; k++) {
            units[k].active = false;
            units[k].group.visible = false;
            units[k].speed = 0;
          }
          setSiren(false);
          if (typeof police.onBusted === 'function') police.onBusted();
        }
      } else {
        bustTimer = Math.max(0, bustTimer - dt * 1.5);
      }
    },

    stageShotChase: function () {
      state.wanted = 3;
      var game = window.VC.game;
      var carPos = null;
      if (game && game.vehicles && typeof game.vehicles.stageShotDrive === 'function') {
        game.vehicles.stageShotDrive();
        if (game.vehicles.playerCar) carPos = game.vehicles.playerCar.group.position;
      }
      if (!carPos) carPos = player.position;
      for (var i = 0; i < units.length; i++) {
        var unit = units[i];
        if (i < 2) {
          unit.active = true;
          unit.group.visible = true;
          unit.group.position.set(carPos.x - 4 + i * 8, 0, carPos.z + 11 + i * 3);
          unit.heading = Math.PI;
          unit.group.rotation.y = Math.PI;
          unit.speed = 18;
          unit.redMat.emissive.setHex(0xff2020);
          unit.blueMat.emissive.setHex(0x2040ff);
        } else {
          unit.active = false;
          unit.group.visible = false;
        }
      }
    }
  };

  return police;
};
