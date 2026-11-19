// VICE CITY: Rise of Crime — vehicles: car factory, parked fleet, grid traffic
// AI, and player driving (enter/exit with E, arcade physics, chase camera).
// Later chunks read VC.game.vehicles / VC.game.driving (playerCar + speed).
window.VC = window.VC || {};

VC.createVehicles = function (scene, city, rng, player) {
  var colliders = city.colliders || [];
  var PITCH = city.roads.block;          // 52
  var ROADW = city.roads.roadW;          // 12
  var N = city.roads.n;                  // 9
  var HALF = (PITCH * N) / 2;            // 234
  var LANE = ROADW / 4;                  // 3 — lane offset from road centre
  var PARK_OFF = ROADW / 2 - 1.0;        // 5 — parked cars hug the kerb

  function lineAt(k) { return -HALF + k * PITCH; }  // road centre lines, k=0..N

  // ---------------- shared assets ----------------
  var glassMat = new THREE.MeshStandardMaterial({ color: 0x16232e, metalness: 0.85, roughness: 0.16 });
  var tireMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.92 });
  var hubMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c7, metalness: 0.7, roughness: 0.35 });
  var headMat = new THREE.MeshStandardMaterial({ color: 0x555540, emissive: 0xffedb5, emissiveIntensity: 0.8 });
  var tailMat = new THREE.MeshStandardMaterial({ color: 0x330d0d, emissive: 0xff2a22, emissiveIntensity: 0.7 });
  var bodyGeo = new THREE.BoxGeometry(1.8, 0.55, 4.3);
  var cabinGeo = new THREE.BoxGeometry(1.62, 0.52, 2.05);
  var roofGeo = new THREE.BoxGeometry(1.68, 0.07, 1.45);
  var wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.32, 14);
  wheelGeo.rotateZ(Math.PI / 2); // axle along x
  var hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.34, 10);
  hubGeo.rotateZ(Math.PI / 2);
  var lightGeo = new THREE.BoxGeometry(0.3, 0.13, 0.07);

  var PALETTE = [0xff6f61, 0x2ec4b6, 0xf4f1de, 0xffd23f, 0xef7aa5, 0xf7f7f7, 0x5bc0eb, 0xf2a65a];

  function buildCar(colorHex) {
    var group = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.35, roughness: 0.38 });
    var body = new THREE.Mesh(bodyGeo, paint);
    body.position.y = 0.58; body.castShadow = true;
    group.add(body);
    var cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.1, -0.25); cabin.castShadow = true;
    group.add(cabin);
    var roof = new THREE.Mesh(roofGeo, paint);
    roof.position.set(0, 1.4, -0.25);
    group.add(roof);
    var wheels = [], pivots = [];
    [[-0.86, 1.42, 1], [0.86, 1.42, 1], [-0.86, -1.42, 0], [0.86, -1.42, 0]].forEach(function (w) {
      var pivot = new THREE.Group();
      pivot.position.set(w[0], 0.37, w[1]);
      var tyre = new THREE.Mesh(wheelGeo, tireMat);
      var hub = new THREE.Mesh(hubGeo, hubMat);
      pivot.add(tyre); pivot.add(hub);
      group.add(pivot);
      wheels.push(tyre); wheels.push(hub);
      if (w[2]) pivots.push(pivot);
    });
    [-0.62, 0.62].forEach(function (x) {
      var h = new THREE.Mesh(lightGeo, headMat); h.position.set(x, 0.66, 2.16); group.add(h);
      var t = new THREE.Mesh(lightGeo, tailMat); t.position.set(x, 0.7, -2.16); group.add(t);
    });
    scene.add(group);
    return {
      group: group, wheels: wheels, pivots: pivots,
      heading: 0, speed: 0, spin: 0, steerVis: 0,
      mode: 'parked', cruise: 10, axis: 'z', road: 0, dir: 1,
      nextCross: 0, stuck: 0, auto: false
    };
  }

  // ---------------- fleet ----------------
  var cars = [];
  var i, car;
  for (i = 0; i < 12; i++) { // parked
    car = buildCar(PALETTE[i % PALETTE.length]);
    var vertical = rng.next() < 0.5;
    var line = lineAt(rng.int(0, N));
    var along = rng.range(-HALF + 16, HALF - 16);
    var snap = Math.round((along + HALF) / PITCH) * PITCH - HALF;
    if (Math.abs(along - snap) < 9) along += (along > snap ? 11 : -11); // keep crossings clear
    var side = rng.next() < 0.5 ? -PARK_OFF : PARK_OFF;
    if (vertical) {
      car.group.position.set(line + side, 0, along);
      car.heading = side < 0 ? 0 : Math.PI; // nose along the kerb direction
    } else {
      car.group.position.set(along, 0, line + side);
      car.heading = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.group.rotation.y = car.heading;
    car.mode = 'parked';
    cars.push(car);
  }

  function laneCoord(c) { // lateral lane centre for the car's current leg
    if (c.axis === 'z') return c.road + (c.dir > 0 ? -LANE : LANE);
    return c.road + (c.dir > 0 ? LANE : -LANE);
  }
  function headingFor(c) {
    if (c.axis === 'z') return c.dir > 0 ? 0 : Math.PI;
    return c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  function computeNextCross(c) {
    var pos = c.axis === 'z' ? c.group.position.z : c.group.position.x;
    var best = null;
    for (var k = 0; k <= N; k++) {
      var L = lineAt(k);
      if (c.dir > 0 ? (L > pos + 1 && (best === null || L < best)) : (L < pos - 1 && (best === null || L > best))) best = L;
    }
    c.nextCross = best === null ? (c.dir > 0 ? HALF + PITCH : -HALF - PITCH) : best;
  }
  function respawnTraffic(c, farFrom) {
    c.axis = rng.next() < 0.5 ? 'z' : 'x';
    c.dir = rng.next() < 0.5 ? 1 : -1;
    c.road = lineAt(rng.int(0, N));
    var along = rng.range(-HALF + 10, HALF - 10);
    if (farFrom && Math.abs(along - farFrom) < 70) along = along > 0 ? along - 120 : along + 120;
    if (c.axis === 'z') c.group.position.set(laneCoord(c), 0, along);
    else c.group.position.set(along, 0, laneCoord(c));
    c.heading = headingFor(c);
    c.group.rotation.y = c.heading;
    c.speed = c.cruise * 0.7;
    c.stuck = 0;
    computeNextCross(c);
  }
  for (i = 0; i < 10; i++) { // traffic
    car = buildCar(PALETTE[(i + 3) % PALETTE.length]);
    car.mode = 'traffic';
    car.cruise = rng.range(8, 14);
    respawnTraffic(car, null);
    cars.push(car);
  }

  // ---------------- headlight spotlight (player car only) ----------------
  var nightF = 0, dayWired = false;
  var spot = new THREE.SpotLight(0xffe6b0, 0, 55, 0.52, 0.5, 1.1);
  spot.position.set(0, 1.1, 1.6);
  var spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, 16);
  spot.target = spotTarget;

  // ---------------- helpers ----------------
  function angWrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function fwd(c) { return { x: Math.sin(c.heading), z: Math.cos(c.heading) }; }

  function collideBuildings(c, radius) {
    var p = c.group.position;
    for (var j = 0; j < colliders.length; j++) {
      var b = colliders[j];
      var nx = Math.max(b.minX, Math.min(p.x, b.maxX));
      var nz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      var dx = p.x - nx, dz = p.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 1e-6) { p.x = b.maxX + radius; continue; }
        var d = Math.sqrt(d2);
        p.x = nx + (dx / d) * radius;
        p.z = nz + (dz / d) * radius;
        c.speed *= 0.2;
      }
    }
  }

  // oriented-box overlap between two cars (checked in b's frame, then a's)
  function obbOverlap(a, b) {
    function inFrame(o, frame) {
      var dx = o.group.position.x - frame.group.position.x;
      var dz = o.group.position.z - frame.group.position.z;
      var s = Math.sin(frame.heading), co = Math.cos(frame.heading);
      var lx = dx * co - dz * s;   // lateral
      var lz = dx * s + dz * co;   // longitudinal
      return Math.abs(lx) < 1.8 && Math.abs(lz) < 4.1;
    }
    return inFrame(a, b) || inFrame(b, a);
  }
  function pushApart(a, b, movableB) {
    var dx = a.group.position.x - b.group.position.x;
    var dz = a.group.position.z - b.group.position.z;
    var d = Math.sqrt(dx * dx + dz * dz) || 0.01;
    var push = 0.35;
    a.group.position.x += (dx / d) * push;
    a.group.position.z += (dz / d) * push;
    if (movableB) {
      b.group.position.x -= (dx / d) * push * 0.5;
      b.group.position.z -= (dz / d) * push * 0.5;
    }
  }

  function spinWheels(c, dt) {
    c.spin += (c.speed * dt) / 0.37;
    for (var j = 0; j < c.wheels.length; j++) c.wheels[j].rotation.x = c.spin;
  }

  // ---------------- traffic update ----------------
  function updateTraffic(c, dt) {
    var p = c.group.position;
    var f = fwd(c);
    // obstacle scan: two look-ahead points
    var brake = false;
    var ax = p.x + f.x * 7.5, az = p.z + f.z * 7.5;
    var bx = p.x + f.x * 4.0, bz = p.z + f.z * 4.0;
    for (var j = 0; j < cars.length; j++) {
      var o = cars[j];
      if (o === c) continue;
      var op = o.group.position;
      var ddx = op.x - ax, ddz = op.z - az;
      var rr = o.mode === 'parked' ? 1.5 : 3.3;
      if (ddx * ddx + ddz * ddz < rr * rr) { brake = true; break; }
      ddx = op.x - bx; ddz = op.z - bz;
      if (ddx * ddx + ddz * ddz < 2.6 * 2.6) { brake = true; break; }
    }
    if (!api.playerCar) { // player on foot blocks traffic too
      var pp = player.position;
      var pdx = pp.x - ax, pdz = pp.z - az;
      if (pdx * pdx + pdz * pdz < 3.2 * 3.2) brake = true;
    }
    var targetYaw = headingFor(c);
    var turning = Math.abs(angWrap(targetYaw - c.heading)) > 0.45;
    var want = brake ? 0 : (turning ? c.cruise * 0.55 : c.cruise);
    if (c.speed < want) c.speed = Math.min(want, c.speed + 6 * dt);
    else c.speed = Math.max(want, c.speed - 20 * dt);

    c.heading += angWrap(targetYaw - c.heading) * Math.min(1, dt * 2.4);
    f = fwd(c);
    p.x += f.x * c.speed * dt;
    p.z += f.z * c.speed * dt;
    // gentle pull toward the lane centre of the current leg
    var lc = laneCoord(c);
    if (c.axis === 'z') p.x += (lc - p.x) * Math.min(1, dt * 1.9);
    else p.z += (lc - p.z) * Math.min(1, dt * 1.9);
    c.group.rotation.y = c.heading;

    // intersection decision
    var along = c.axis === 'z' ? p.z : p.x;
    if ((c.dir > 0 && along >= c.nextCross) || (c.dir < 0 && along <= c.nextCross)) {
      var cross = c.nextCross;
      if (rng.next() < 0.38) { // turn onto the crossing road
        c.axis = c.axis === 'z' ? 'x' : 'z';
        c.road = cross;
        c.dir = rng.next() < 0.5 ? 1 : -1;
      }
      computeNextCross(c);
    }
    // stuck / out of bounds
    if (Math.abs(c.speed) < 0.4) c.stuck += dt; else c.stuck = 0;
    if (c.stuck > 6 || Math.abs(p.x) > HALF + 26 || Math.abs(p.z) > HALF + 26) {
      respawnTraffic(c, player.position ? (c.axis === 'z' ? player.position.z : player.position.x) : null);
      return;
    }
    // soft car-car resolution
    for (var m = 0; m < cars.length; m++) {
      var oc = cars[m];
      if (oc === c || oc.mode === 'parked') continue;
      if (obbOverlap(c, oc)) { pushApart(c, oc, oc.mode === 'traffic'); c.speed *= 0.7; }
    }
    spinWheels(c, dt);
  }

  // ---------------- player driving ----------------
  var api = { playerCar: null, cars: cars };
  var prevE = false;

  function enterCar(c) {
    c.mode = 'player';
    c.auto = false;
    api.playerCar = c;
    player.group.visible = false;
    c.group.add(spot); c.group.add(spotTarget);
    spot.intensity = nightF * 2.4;
    if (window.VC.game) VC.game.driving = c;
  }
  function exitCar() {
    var c = api.playerCar;
    if (!c) return;
    c.group.remove(spot); c.group.remove(spotTarget);
    var r = { x: Math.cos(c.heading), z: -Math.sin(c.heading) };
    player.teleport(c.group.position.x + r.x * 2.3, c.group.position.z + r.z * 2.3);
    player.group.visible = true;
    c.mode = 'traffic'; // released car rejoins traffic from where it sits
    c.axis = Math.abs(Math.sin(c.heading)) > Math.abs(Math.cos(c.heading)) ? 'x' : 'z';
    c.dir = 1; c.road = c.axis === 'z' ? Math.round((c.group.position.x + HALF) / PITCH) * PITCH - HALF
                                      : Math.round((c.group.position.z + HALF) / PITCH) * PITCH - HALF;
    c.cruise = 9;
    computeNextCross(c);
    api.playerCar = null;
    if (window.VC.game) VC.game.driving = null;
  }
  api.forceEnter = function (c) { enterCar(c); };
  api.setAutoDrive = function (on) { if (api.playerCar) api.playerCar.auto = !!on; };
  api.stageShotDrive = function () {
    // player car: westbound on the z=-26 street at golden hour, into the sunset
    var pc = null, best = 1e9;
    for (var j = 0; j < cars.length; j++) {
      var cc = cars[j];
      var d = Math.abs(cc.group.position.x - 60) + Math.abs(cc.group.position.z + 26);
      if (d < best) { best = d; pc = cc; }
    }
    pc.group.position.set(60, 0, -29);
    pc.heading = -Math.PI / 2; pc.group.rotation.y = pc.heading;
    pc.speed = 8;
    enterCar(pc);
    pc.auto = true;
    // supporting traffic: two ahead westbound, one oncoming
    var staged = 0;
    for (var k = 0; k < cars.length && staged < 3; k++) {
      var t = cars[k];
      if (t === pc || t.mode !== 'traffic') continue;
      if (staged === 0) { t.group.position.set(18, 0, -29); t.axis = 'x'; t.road = -26; t.dir = -1; t.heading = -Math.PI / 2; }
      if (staged === 1) { t.group.position.set(-24, 0, -29); t.axis = 'x'; t.road = -26; t.dir = -1; t.heading = -Math.PI / 2; }
      if (staged === 2) { t.group.position.set(-52, 0, -23); t.axis = 'x'; t.road = -26; t.dir = 1; t.heading = Math.PI / 2; }
      t.group.rotation.y = t.heading; t.speed = t.cruise * 0.8;
      computeNextCross(t);
      staged++;
    }
    player.teleport(62, -24); // beside the car before "entering" (hidden while driving)
    return pc;
  };

  function updatePlayerCar(c, dt, input) {
    var keys = input ? input.keys : {};
    var up = keys.KeyW || keys.ArrowUp, down = keys.KeyS || keys.ArrowDown;
    var left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
    var hand = !!keys.Space;
    if (c.auto) { up = c.speed < 9; down = false; left = right = false; hand = false; }

    if (up) c.speed = Math.min(26, c.speed + 16 * dt);
    else if (down) {
      if (c.speed > 0.5) c.speed = Math.max(0, c.speed - 26 * dt);
      else c.speed = Math.max(-8, c.speed - 10 * dt);
    } else {
      c.speed -= c.speed * 0.55 * dt; // drag
      if (c.speed > 0) c.speed = Math.max(0, c.speed - 2.2 * dt);
      else if (c.speed < 0) c.speed = Math.min(0, c.speed + 2.2 * dt);
    }
    if (hand) {
      if (c.speed > 0) c.speed = Math.max(0, c.speed - 30 * dt);
      else if (c.speed < 0) c.speed = Math.min(0, c.speed + 30 * dt);
    }
    var steer = (left ? 1 : 0) - (right ? 1 : 0);
    var sf = Math.min(1, Math.abs(c.speed) / 7);
    if (steer !== 0 && Math.abs(c.speed) > 0.05) {
      c.heading += steer * 1.7 * sf * (hand ? 1.45 : 1) * (c.speed >= 0 ? 1 : -1) * dt;
    }
    c.steerVis += ((steer * 0.45) - c.steerVis) * Math.min(1, dt * 10);
    for (var j = 0; j < c.pivots.length; j++) c.pivots[j].rotation.y = c.steerVis;

    var f = fwd(c);
    c.group.position.x += f.x * c.speed * dt;
    c.group.position.z += f.z * c.speed * dt;
    c.group.position.x = Math.max(-HALF - 14, Math.min(HALF + 14, c.group.position.x));
    c.group.position.z = Math.max(-HALF - 14, Math.min(HALF + 14, c.group.position.z));
    c.group.rotation.y = c.heading;

    collideBuildings(c, 1.7);
    for (var m = 0; m < cars.length; m++) {
      var oc = cars[m];
      if (oc === c) continue;
      if (obbOverlap(c, oc)) { pushApart(c, oc, oc.mode === 'traffic'); c.speed *= 0.6; }
    }
    spinWheels(c, dt);

    // chase camera
    var game = window.VC.game;
    if (game && game.engine && game.engine.camera) {
      var cam = game.engine.camera;
      var p = c.group.position;
      var want = { x: p.x - f.x * 9.5, y: 3.6, z: p.z - f.z * 9.5 };
      var k = 1 - Math.exp(-4.5 * dt);
      cam.position.x += (want.x - cam.position.x) * k;
      cam.position.y += (want.y - cam.position.y) * k;
      cam.position.z += (want.z - cam.position.z) * k;
      cam.lookAt(p.x + f.x * 7, 1.3, p.z + f.z * 7);
    }
  }

  // ---------------- main update ----------------
  api.update = function (dt, input) {
    if (!dayWired && window.VC.game && VC.game.engine) {
      dayWired = true;
      VC.game.engine.onDay(function (nf) {
        nightF = nf;
        headMat.emissiveIntensity = 0.7 + nf * 1.4;
        tailMat.emissiveIntensity = 0.6 + nf * 1.2;
        if (api.playerCar) spot.intensity = nf * 2.4;
      });
    }
    // E key rising edge (input.pressed is level-triggered, so edge-detect here)
    var eNow = !!(input && input.keys && input.keys.KeyE);
    if (eNow && !prevE) {
      if (api.playerCar) exitCar();
      else if (input) {
        var pp = player.position, near = null, nd = 3.4;
        for (var j = 0; j < cars.length; j++) {
          var cp = cars[j].group.position;
          var dd = Math.sqrt((cp.x - pp.x) * (cp.x - pp.x) + (cp.z - pp.z) * (cp.z - pp.z));
          if (dd < nd) { nd = dd; near = cars[j]; }
        }
        if (near) enterCar(near);
      }
    }
    prevE = eNow;

    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.mode === 'traffic') updateTraffic(c, dt);
      else if (c.mode === 'player') updatePlayerCar(c, dt, input);
    }
  };

  return api;
};
