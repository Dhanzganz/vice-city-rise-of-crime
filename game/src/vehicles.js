'use strict';
/* VICE CITY: Rise of Crime — vehicles (chunk B, rebuilt).
   VC.createVehicles(scene, city, rng, player):
   car factory, 12 parked cars, 10 traffic cars driving the road grid,
   E enter/exit (main edge-detects E and calls tryEnterExit), arcade
   driving physics with a chase camera while the player drives. */
(function () {
  window.VC = window.VC || {};

  var CENTRELINES = [];
  for (var ci = 0; ci < 9; ci++) CENTRELINES.push(-234 + 52 * ci);
  var LANE = 3;
  var PALETTE = [0xd64541, 0x3f7fbf, 0xe8b93c, 0x53a06a, 0xe6e3da, 0x35383e,
                 0x8e5ea2, 0xd97b29, 0x4fb3b0, 0xb03a5b, 0x7a8894, 0x2e5e4e];

  function createVehicles(scene, city, rng, player) {
    var cars = [];
    var playerCar = null;
    var shotHold = null;

    /* ---------------- car factory ---------------- */

    function makeCar(color) {
      var group = new THREE.Group();
      var paint = new THREE.MeshLambertMaterial({ color: color });
      var dark = new THREE.MeshLambertMaterial({ color: 0x1c1e24 });
      var glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x1a2e38 });

      var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.6), paint);
      body.position.y = 0.55;
      body.castShadow = true;
      group.add(body);

      var nose = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.3, 0.5), paint);
      nose.position.set(0, 0.42, 1.85);
      group.add(nose);

      var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, 1.8), glass);
      cabin.position.set(0, 1.05, -0.2);
      cabin.castShadow = true;
      group.add(cabin);

      var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
      var wheelPos = [[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]];
      var wheels = [];
      for (var i = 0; i < 4; i++) {
        var w = new THREE.Mesh(wheelGeo, dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(wheelPos[i][0], 0.34, wheelPos[i][1]);
        group.add(w);
        wheels.push(w);
      }

      var hlGeo = new THREE.BoxGeometry(0.42, 0.16, 0.06);
      var hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
      var tlMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
      [-0.6, 0.6].forEach(function (x) {
        var hl = new THREE.Mesh(hlGeo, hlMat);
        hl.position.set(x, 0.58, 2.11);
        group.add(hl);
        var tl = new THREE.Mesh(hlGeo, tlMat);
        tl.position.set(x, 0.58, -1.83);
        group.add(tl);
      });

      scene.add(group);
      return {
        group: group, wheels: wheels, heading: 0, speed: 0,
        color: color, isPlayer: false, traffic: false, parked: false
      };
    }

    function placeCar(car, x, z, heading) {
      car.group.position.set(x, 0, z);
      car.heading = heading;
      car.group.rotation.y = heading;
    }

    /* ---------------- parked cars ---------------- */

    for (var p = 0; p < 12; p++) {
      var pc = makeCar(PALETTE[Math.floor(rng() * PALETTE.length)]);
      pc.parked = true;
      var road = CENTRELINES[Math.floor(rng() * CENTRELINES.length)];
      var along = -240 + rng() * 480;
      var side = rng() < 0.5 ? -1 : 1;
      if (p % 2 === 0) {
        placeCar(pc, road + side * 7.6, along, side > 0 ? Math.PI : 0);
      } else {
        placeCar(pc, along, road + side * 7.6, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      cars.push(pc);
    }

    /* ---------------- traffic cars ---------------- */

    function nextCross(along, dirSign) {
      var best = null;
      for (var i = 0; i < CENTRELINES.length; i++) {
        var c = CENTRELINES[i];
        if (dirSign > 0 && c > along + 0.5 && (best === null || c < best)) best = c;
        if (dirSign < 0 && c < along - 0.5 && (best === null || c > best)) best = c;
      }
      return best;
    }

    function trafficPos(car) {
      if (car.axis === 'v') {
        return { x: car.roadCoord - car.dirSign * LANE, z: car.along };
      }
      return { x: car.along, z: car.roadCoord + car.dirSign * LANE };
    }

    function trafficHeading(car) {
      if (car.axis === 'v') return car.dirSign > 0 ? 0 : Math.PI;
      return car.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    for (var t = 0; t < 10; t++) {
      var tc = makeCar(PALETTE[Math.floor(rng() * PALETTE.length)]);
      tc.traffic = true;
      tc.axis = rng() < 0.5 ? 'v' : 'h';
      tc.roadCoord = CENTRELINES[Math.floor(rng() * CENTRELINES.length)];
      tc.dirSign = rng() < 0.5 ? -1 : 1;
      tc.along = -240 + rng() * 480;
      tc.cruise = 9 + rng() * 4;
      tc.speed = tc.cruise;
      tc.cross = nextCross(tc.along, tc.dirSign);
      var tp = trafficPos(tc);
      tc.smoothX = tp.x; tc.smoothZ = tp.z;
      placeCar(tc, tp.x, tp.z, trafficHeading(tc));
      cars.push(tc);
    }

    function turnTraffic(car) {
      // Direction vectors in xz for the current leg.
      var d = car.axis === 'v' ? { x: 0, z: car.dirSign } : { x: car.dirSign, z: 0 };
      var roll = rng();
      var nd = d;
      if (roll >= 0.45) {
        var left = roll < 0.725;
        nd = left ? { x: d.z, z: -d.x } : { x: -d.z, z: d.x };
      }
      if (nd === d) { car.cross = nextCross(car.along, car.dirSign); return; }
      var pos = trafficPos(car);
      var crossed = car.cross;
      if (car.axis === 'v') {
        car.axis = 'h';
        car.roadCoord = crossed;
        car.dirSign = nd.x;
        car.along = pos.x;
      } else {
        car.axis = 'v';
        car.roadCoord = crossed;
        car.dirSign = nd.z;
        car.along = pos.z;
      }
      car.cross = nextCross(car.along, car.dirSign);
    }

    function updateTraffic(car, dt) {
      if (car === shotHold) return;
      var desired = car.cruise;
      for (var i = 0; i < cars.length; i++) {
        var o = cars[i];
        if (o === car || !o.traffic) continue;
        if (o.axis === car.axis && o.roadCoord === car.roadCoord && o.dirSign === car.dirSign) {
          var gap = (o.along - car.along) * car.dirSign;
          if (gap > 0 && gap < 10) {
            desired = Math.min(desired, o.speed * (gap / 10));
            if (gap < 4.5) desired = 0;
          }
        }
      }
      car.speed += (desired - car.speed) * Math.min(1, 3 * dt);
      car.along += car.dirSign * car.speed * dt;

      if (car.along > 252) { car.along = -252; car.cross = nextCross(car.along, car.dirSign); car.smoothX = null; }
      if (car.along < -252) { car.along = 252; car.cross = nextCross(car.along, car.dirSign); car.smoothX = null; }

      if (car.cross !== null && car.cross !== undefined) {
        var passed = car.dirSign > 0 ? car.along >= car.cross : car.along <= car.cross;
        if (passed) turnTraffic(car);
      }

      var pos = trafficPos(car);
      if (car.smoothX === null || car.smoothX === undefined) { car.smoothX = pos.x; car.smoothZ = pos.z; }
      var k = 1 - Math.exp(-8 * dt);
      car.smoothX += (pos.x - car.smoothX) * k;
      car.smoothZ += (pos.z - car.smoothZ) * k;
      car.group.position.set(car.smoothX, 0, car.smoothZ);
      car.heading = trafficHeading(car);
      car.group.rotation.y = car.heading;
      spinWheels(car, dt);
    }

    function spinWheels(car, dt) {
      var w = car.speed * dt / 0.34;
      for (var i = 0; i < car.wheels.length; i++) car.wheels[i].rotation.x += w;
    }

    /* ---------------- player enter / exit ---------------- */

    function game() { return window.VC.game || null; }

    function playerPos() {
      if (player.position) return player.position;
      return player.group.position;
    }

    function setDriving(on) {
      var G = game();
      if (G) G.driving = on;
    }

    function exitCar() {
      if (!playerCar) return;
      var car = playerCar;
      playerCar = null;
      car.isPlayer = false;
      var hx = Math.sin(car.heading), hz = Math.cos(car.heading);
      var rx = hz, rz = -hx; // right of heading
      var nx = car.group.position.x + rx * 2.4;
      var nz = car.group.position.z + rz * 2.4;
      if (player.teleport) player.teleport(nx, nz);
      player.group.position.set(nx, player.group.position.y, nz);
      player.group.visible = true;
      if (player.setCameraOverride) player.setCameraOverride(null);
      setDriving(false);
    }

    function tryEnterExit() {
      if (playerCar) { exitCar(); return; }
      var pp = playerPos();
      var best = null, bestD = 4.5;
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        var dx = c.group.position.x - pp.x;
        var dz = c.group.position.z - pp.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (!best) return;
      if (best.traffic) { best.traffic = false; } // hijacked: leaves the traffic flow
      playerCar = best;
      best.isPlayer = true;
      best.speed = 0;
      player.group.visible = false;
      setDriving(true);
      if (player.setCameraOverride) player.setCameraOverride(chaseCam);
    }

    function requestExitCar() { exitCar(); }

    /* ---------------- driving ---------------- */

    function keyDown(code, alt) {
      var G = game();
      var keys = G && G.input && G.input.keys;
      if (!keys) return false;
      return !!(keys[code] || (alt && keys[alt]));
    }

    function collide(pos, radius) {
      var cols = city.colliders || [];
      for (var i = 0; i < cols.length; i++) {
        var b = cols[i];
        var minX = b.minX !== undefined ? b.minX : (b.min ? b.min.x : 0);
        var maxX = b.maxX !== undefined ? b.maxX : (b.max ? b.max.x : 0);
        var minZ = b.minZ !== undefined ? b.minZ : (b.min ? b.min.z : 0);
        var maxZ = b.maxZ !== undefined ? b.maxZ : (b.max ? b.max.z : 0);
        var nx = Math.max(minX, Math.min(pos.x, maxX));
        var nz = Math.max(minZ, Math.min(pos.z, maxZ));
        var dx = pos.x - nx, dz = pos.z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.0001) {
            var d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.z = nz + (dz / d) * radius;
          } else {
            // centre inside the box: push out along the smallest penetration
            var pl = pos.x - minX, pr = maxX - pos.x, pt = pos.z - minZ, pb = maxZ - pos.z;
            var m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = minX - radius;
            else if (m === pr) pos.x = maxX + radius;
            else if (m === pt) pos.z = minZ - radius;
            else pos.z = maxZ + radius;
          }
          return true;
        }
      }
      return false;
    }

    var camPos = new THREE.Vector3();
    var camInit = false;

    function chaseCam(camera, dt) {
      if (!playerCar || !camera) return;
      var cp = playerCar.group.position;
      var hx = Math.sin(playerCar.heading), hz = Math.cos(playerCar.heading);
      var tx = cp.x - hx * 9.5;
      var tz = cp.z - hz * 9.5;
      var ty = cp.y + 3.6;
      if (!camInit) { camPos.set(tx, ty, tz); camInit = true; }
      var k = 1 - Math.exp(-6 * (dt || 0.016));
      camPos.x += (tx - camPos.x) * k;
      camPos.y += (ty - camPos.y) * k;
      camPos.z += (tz - camPos.z) * k;
      camera.position.copy(camPos);
      camera.lookAt(cp.x + hx * 6, cp.y + 1.2, cp.z + hz * 6);
    }

    function updateDriving(dt) {
      var car = playerCar;
      var fwd = keyDown('KeyW', 'w');
      var back = keyDown('KeyS', 's');
      var left = keyDown('KeyA', 'a');
      var right = keyDown('KeyD', 'd');

      if (fwd) car.speed += 22 * dt;
      else if (back) {
        if (car.speed > 0.5) car.speed -= 34 * dt;
        else car.speed -= 12 * dt;
      } else {
        car.speed -= car.speed * Math.min(1, 0.9 * dt);
        if (Math.abs(car.speed) < 0.05) car.speed = 0;
      }
      if (car.speed > 34) car.speed = 34;
      if (car.speed < -10) car.speed = -10;

      var steer = (left ? 1 : 0) - (right ? 1 : 0);
      if (steer !== 0 && car.speed !== 0) {
        var sf = Math.max(-1, Math.min(1, car.speed / 12));
        car.heading += steer * 1.9 * dt * sf;
      }

      var pos = car.group.position;
      pos.x += Math.sin(car.heading) * car.speed * dt;
      pos.z += Math.cos(car.heading) * car.speed * dt;

      if (collide(pos, 1.5)) {
        car.speed *= -0.25;
        if (Math.abs(car.speed) < 0.4) car.speed = 0;
      }
      var B = city.bounds;
      if (pos.x < B.minX + 2) pos.x = B.minX + 2;
      if (pos.x > B.maxX - 2) pos.x = B.maxX - 2;
      if (pos.z < B.minZ + 2) pos.z = B.minZ + 2;
      if (pos.z > B.maxZ - 2) pos.z = B.maxZ - 2;

      car.group.rotation.y = car.heading;
      spinWheels(car, dt);

      // Belt and braces: if an engine camera is reachable, drive it too.
      var G = game();
      if (G && G.engine && G.engine.camera) chaseCam(G.engine.camera, dt);
    }

    /* ---------------- screenshots ---------------- */

    function stageShotDrive() {
      var car = null;
      for (var i = 0; i < cars.length; i++) if (cars[i].traffic) { car = cars[i]; break; }
      if (!car) car = cars[0];
      shotHold = car;
      car.speed = 0;
      // Mid-road downtown on the x=26 centreline, heading +z in the right lane.
      placeCar(car, 26 - LANE, -12, 0);
      car.smoothX = car.group.position.x;
      car.smoothZ = car.group.position.z;
      camInit = false;
      if (player.setCameraOverride) {
        var cp = car.group.position;
        player.setCameraOverride(function (camera) {
          if (!camera) return;
          camera.position.set(cp.x - 7.5, 3.4, cp.z - 10.5);
          camera.lookAt(cp.x + 1.5, 1, cp.z + 6);
        });
      }
    }

    /* ---------------- update ---------------- */

    function update(dt) {
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        if (c === playerCar) continue;
        if (c.traffic) updateTraffic(c, dt);
      }
      if (playerCar) updateDriving(dt);
    }

    var api = {
      update: update,
      cars: cars,
      tryEnterExit: tryEnterExit,
      requestExitCar: requestExitCar,
      stageShotDrive: stageShotDrive
    };
    Object.defineProperty(api, 'playerCar', {
      get: function () { return playerCar; }
    });
    return api;
  }

  window.VC.createVehicles = createVehicles;
})();
