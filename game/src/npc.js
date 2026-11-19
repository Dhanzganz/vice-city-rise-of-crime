'use strict';
/* VICE CITY: Rise of Crime — pedestrians (chunk C1).
   VC.createNPCs(scene, city, rng): 26 low-poly walkers strolling the
   sidewalk lines (block edges). They panic and flee from trouble, can be
   put down (mode 'down', timer counts to a far-away respawn), and a fast
   player car that overlaps one causes a hit-and-run crime. */
(function () {
  window.VC = window.VC || {};

  var CENTRELINES = [];
  for (var ci = 0; ci < 9; ci++) CENTRELINES.push(-234 + 52 * ci);
  var SIDE = 8.5; // sidewalk offset from a road centreline

  var SHIRTS = [0xd94f4f, 0x4f7fd9, 0x53b06a, 0xe8c93c, 0xe6e3da, 0x9b59b6,
                0xe67e22, 0x4fb3b0, 0xec7fa5, 0x95a5a6, 0x2e6e5e, 0xc0c6cc];
  var PANTS = [0x2c3e50, 0x57432a, 0x3a3f47, 0x6e2f35, 0x274435, 0x715f8f];
  var SKIN = [0xf2c79b, 0xc98d5e, 0x8a5a33, 0x6e4426, 0xffdbac];

  function createNPCs(scene, city, rng) {
    var peds = [];

    function makeFigure() {
      var g = new THREE.Group();
      var shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)] });
      var pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)] });
      var skin = new THREE.MeshLambertMaterial({ color: SKIN[Math.floor(rng() * SKIN.length)] });

      var legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.18);
      var legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.11, 0.25, 0); g.add(legL);
      var legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.11, 0.25, 0); g.add(legR);

      var torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.26), shirt);
      torso.position.y = 0.81;
      torso.castShadow = true;
      g.add(torso);

      var armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.15);
      var armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.34, 0.82, 0); g.add(armL);
      var armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.34, 0.82, 0); g.add(armR);

      var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
      head.position.y = 1.28;
      g.add(head);

      scene.add(g);
      return { group: g, armL: armL, armR: armR };
    }

    /* Sidewalk lines: for each road centreline, a line on each side. */
    function randomLine() {
      var c = CENTRELINES[Math.floor(rng() * CENTRELINES.length)];
      return c + (rng() < 0.5 ? -SIDE : SIDE);
    }

    function pickTarget(ped) {
      // Walk to a random corner-ish point along the current line, or turn.
      var along = ped.axis === 'v' ? ped.z : ped.x;
      var roll = rng();
      if (roll < 0.35) {
        // Turn onto a crossing sidewalk line.
        var cross = CENTRELINES[Math.floor(rng() * CENTRELINES.length)] + (rng() < 0.5 ? -SIDE : SIDE);
        if (ped.axis === 'v') { ped.targetX = ped.x; ped.targetZ = cross; ped.turnTo = 'h'; }
        else { ped.targetX = cross; ped.targetZ = ped.z; ped.turnTo = 'v'; }
      } else {
        var dest = Math.max(-248, Math.min(248, along + (rng() * 160 - 80)));
        if (ped.axis === 'v') { ped.targetX = ped.x; ped.targetZ = dest; }
        else { ped.targetX = dest; ped.targetZ = ped.z; }
        ped.turnTo = null;
      }
    }

    function placeOnSidewalk(ped, farFrom) {
      ped.axis = rng() < 0.5 ? 'v' : 'h';
      var tries = 0;
      do {
        if (ped.axis === 'v') { ped.x = randomLine(); ped.z = -248 + rng() * 496; }
        else { ped.z = randomLine(); ped.x = -248 + rng() * 496; }
        tries++;
      } while (farFrom && tries < 12 &&
               Math.abs(ped.x - farFrom.x) < 80 && Math.abs(ped.z - farFrom.z) < 80);
      ped.group.position.set(ped.x, 0, ped.z);
      pickTarget(ped);
    }

    for (var i = 0; i < 26; i++) {
      var fig = makeFigure();
      var ped = {
        group: fig.group, armL: fig.armL, armR: fig.armR,
        mode: 'walk', timer: 0,
        speed: 1.6 + rng() * 0.8,
        x: 0, z: 0, targetX: 0, targetZ: 0, turnTo: null,
        axis: 'v', fleeX: 0, fleeZ: 0, phase: rng() * Math.PI * 2
      };
      placeOnSidewalk(ped, null);
      peds.push(ped);
    }

    function panicAt(x, z, radius) {
      for (var i = 0; i < peds.length; i++) {
        var ped = peds[i];
        if (ped.mode !== 'walk') continue;
        var dx = ped.x - x, dz = ped.z - z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d <= radius) {
          ped.mode = 'panic';
          ped.timer = 3 + rng() * 2;
          if (d < 0.01) { dx = rng() - 0.5; dz = rng() - 0.5; d = 1; }
          ped.fleeX = dx / d; ped.fleeZ = dz / d;
          ped.armL.rotation.x = Math.PI;
          ped.armR.rotation.x = Math.PI;
        }
      }
    }

    function putDown(ped) {
      ped.mode = 'down';
      ped.timer = 6;
      ped.group.rotation.x = -Math.PI / 2;
      ped.group.position.y = 0.25;
      ped.armL.rotation.x = 0;
      ped.armR.rotation.x = 0;
    }

    function playerPosition() {
      var G = window.VC.game;
      if (G && G.player) {
        if (G.player.position) return G.player.position;
        if (G.player.group) return G.player.group.position;
      }
      return null;
    }

    function update(dt) {
      var G = window.VC.game || null;
      var driving = !!(G && G.driving && G.vehicles && G.vehicles.playerCar);
      var car = driving ? G.vehicles.playerCar : null;
      var carPos = car ? car.group.position : null;
      var carSpeed = car ? Math.abs(car.speed) : 0;

      for (var i = 0; i < peds.length; i++) {
        var ped = peds[i];

        if (ped.mode === 'down') {
          ped.timer -= dt;
          if (ped.timer <= 0) {
            ped.group.rotation.x = 0;
            ped.group.position.y = 0;
            ped.mode = 'walk';
            placeOnSidewalk(ped, playerPosition());
          }
          continue;
        }

        if (ped.mode === 'panic') {
          ped.timer -= dt;
          var ps = 5 + (ped.speed - 1.6);
          ped.x += ped.fleeX * ps * dt;
          ped.z += ped.fleeZ * ps * dt;
          var B = city.bounds;
          ped.x = Math.max(B.minX + 2, Math.min(B.maxX - 2, ped.x));
          ped.z = Math.max(B.minZ + 2, Math.min(B.maxZ - 2, ped.z));
          ped.group.position.set(ped.x, Math.abs(Math.sin(ped.phase += dt * 10)) * 0.06, ped.z);
          ped.group.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
          if (ped.timer <= 0) {
            ped.mode = 'walk';
            ped.armL.rotation.x = 0;
            ped.armR.rotation.x = 0;
            // Resume strolling: snap onto the nearest sidewalk line.
            if (Math.abs(ped.x) < Math.abs(ped.z)) { /* keep it simple: retarget from here */ }
            ped.targetX = ped.x; ped.targetZ = ped.z;
            pickTarget(ped);
          }
        } else {
          // walk toward target
          var dx = ped.targetX - ped.x;
          var dz = ped.targetZ - ped.z;
          var dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.4) {
            if (ped.turnTo) { ped.axis = ped.turnTo; ped.turnTo = null; }
            pickTarget(ped);
          } else {
            var vx = dx / dist, vz = dz / dist;
            ped.x += vx * ped.speed * dt;
            ped.z += vz * ped.speed * dt;
            ped.group.position.set(ped.x, Math.abs(Math.sin(ped.phase += dt * 6)) * 0.04, ped.z);
            ped.group.rotation.y = Math.atan2(vx, vz);
          }
        }

        // Hit-and-run: a fast player car overlapping this ped puts it down.
        if (carPos && carSpeed > 8 && ped.mode !== 'down') {
          var hx = ped.x - carPos.x, hz = ped.z - carPos.z;
          if (hx * hx + hz * hz < 1.7 * 1.7) {
            putDown(ped);
            if (G && G.state && G.state.commitCrime) G.state.commitCrime(2, 'hitrun');
            panicAt(carPos.x, carPos.z, 11);
          }
        }
      }
    }

    return {
      update: update,
      peds: peds,
      panicAt: panicAt
    };
  }

  window.VC.createNPCs = createNPCs;
})();
