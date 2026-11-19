// VICE CITY: Rise of Crime — VCPD: wanted levels, pursuit, bust & wasted.
// state.commitCrime only emits 'crime' events, so this module owns the
// wanted level: each crime adds half a star per crime level (cap 5), and
// one cop unit is fielded per whole star. Lose the heat by staying unseen.
window.VC = window.VC || {};

VC.createPolice = function (scene, city, rng, state, audio) {
  var FIRST = -234, PITCH = 52;               // road lines, as in city/npc
  var STATION = { x: -33.5, z: -18.5 };       // sidewalk corner, roads -26/-26
  var HOSPITAL = { x: 33.5, z: 18.5 };        // sidewalk corner, roads 26/26
  var MAX_UNITS = 5;

  var units = [];
  var timeAcc = 0;
  var lastCrimeT = -100;
  var decayT = 0;
  var bustT = 0;
  var seqT = 0;          // busted/wasted sequence time remaining
  var carHitCd = 0, footHitCd = 0;
  var prevTX = 0, prevTZ = 0, playerSpeed = 0, havePrev = false;

  // Crimes become stars here (commitCrime itself does not raise wanted).
  state.on('crime', function (e) {
    var lvl = (e && e.level) || 1;
    state.wanted = Math.min(5, state.wanted + lvl * 0.5);
    lastCrimeT = timeAcc;
  });

  // ---------------- cop car factory --------------------------------------
  function mat(color, basic) {
    return basic ? new THREE.MeshBasicMaterial({ color: color })
                 : new THREE.MeshLambertMaterial({ color: color });
  }
  function box(w, h, d, m, x, y, z) {
    var ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    ms.position.set(x, y, z);
    return ms;
  }

  function buildCopCar() {
    var g = new THREE.Group();
    var black = mat(0x14161c), white = mat(0xf2f4f6), glass = mat(0x10151f);
    g.add(box(1.9, 0.55, 4.3, black, 0, 0.55, 0));          // body
    g.add(box(1.94, 0.3, 1.1, white, 0, 0.62, 0.1));        // white door band
    g.add(box(1.7, 0.5, 2.0, glass, 0, 1.05, -0.1));        // cabin glass
    g.add(box(1.74, 0.09, 2.05, white, 0, 1.33, -0.1));     // white roof
    g.add(box(1.7, 0.1, 0.5, black, 0, 1.42, -0.1));        // light-bar base
    var redMat = mat(0xff2a2a, true), blueMat = mat(0x1a3a8f, true);
    var red = box(0.55, 0.16, 0.4, redMat, -0.42, 1.55, -0.1);
    var blue = box(0.55, 0.16, 0.4, blueMat, 0.42, 1.55, -0.1);
    g.add(red); g.add(blue);
    var hl = mat(0xfff6c9, true);
    g.add(box(0.4, 0.14, 0.06, hl, -0.6, 0.62, 2.16));      // headlights (+Z fwd)
    g.add(box(0.4, 0.14, 0.06, hl, 0.6, 0.62, 2.16));
    var tl = mat(0xb02020, true);
    g.add(box(0.4, 0.12, 0.06, tl, -0.6, 0.66, -2.16));
    g.add(box(0.4, 0.12, 0.06, tl, 0.6, 0.66, -2.16));
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10);
    var wheelMat = mat(0x0c0c0e);
    var wx = [-0.85, 0.85], wz = [1.35, -1.35];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx[i % 2], 0.36, wz[Math.floor(i / 2)]);
      g.add(w);
    }
    return { group: g, redMat: redMat, blueMat: blueMat };
  }

  // ---------------- spawning ---------------------------------------------
  function nearestLine(v) {
    var i = Math.round((v - FIRST) / PITCH);
    i = Math.max(0, Math.min(9, i));
    return FIRST + PITCH * i;
  }
  function insideCollider(x, z, pad) {
    for (var i = 0; i < city.colliders.length; i++) {
      var b = city.colliders[i];
      if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
    }
    return false;
  }
  function makeUnit() {
    var built = buildCopCar();
    built.group.isCop = true;
    scene.add(built.group);
    var u = { group: built.group, redMat: built.redMat, blueMat: built.blueMat,
              heading: 0, speed: 0, leaving: false, leaveT: 0 };
    u.group.userData.unit = u;
    units.push(u);
    return u;
  }
  function removeUnit(u) {
    scene.remove(u.group);
    var i = units.indexOf(u);
    if (i >= 0) units.splice(i, 1);
  }
  function spawnPosFor(tp) {
    for (var tries = 0; tries < 8; tries++) {
      var ang = rng.range(0, Math.PI * 2);
      var dist = rng.range(60, 95);
      var x = tp.x + Math.sin(ang) * dist;
      var z = tp.z + Math.cos(ang) * dist;
      x = Math.max(city.bounds.minX + 8, Math.min(city.bounds.maxX - 8, x));
      z = Math.max(city.bounds.minZ + 8, Math.min(city.bounds.maxZ - 8, z));
      if (Math.abs(x - nearestLine(x)) < Math.abs(z - nearestLine(z))) x = nearestLine(x);
      else z = nearestLine(z);
      if (!insideCollider(x, z, 2.2)) return { x: x, z: z };
    }
    return { x: nearestLine(tp.x) + 40, z: nearestLine(tp.z) };
  }
  function targetPos() {
    var g = window.VC.game;
    if (!g) return { x: 0, z: 0 };
    if (g.driving && g.vehicles && g.vehicles.playerCar) return g.vehicles.playerCar.group.position;
    return g.player.position;
  }

  // ---------------- sequences --------------------------------------------
  function endSequence() {
    seqT = 0;
    var g = window.VC.game;
    if (g && g.hud) g.hud.showOverlay(null);
    if (g) g.inputLocked = false;
  }
  function doBusted() {
    var g = window.VC.game;
    if (!g) return;
    seqT = 3;
    g.inputLocked = true;
    if (g.hud) g.hud.showOverlay('busted');
    audio.sting();
    audio.sirenSet(false);
    var fine = 100 + 50 * Math.ceil(state.wanted);
    state.addCash(-Math.min(fine, state.cash));
    state.wanted = 0;
    bustT = 0;
    g.player.teleport(STATION.x, STATION.z);
  }
  function doWasted() {
    var g = window.VC.game;
    if (!g) return;
    seqT = 3;
    g.inputLocked = true;
    if (g.hud) g.hud.showOverlay('wasted');
    audio.sting();
    audio.sirenSet(false);
    state.addCash(-Math.floor(state.cash * 0.10));
    state.heal(state.maxHealth);
    state.wanted = Math.max(0, state.wanted - 1);
    if (g.driving && g.requestExitCar) g.requestExitCar();
    g.player.teleport(HOSPITAL.x, HOSPITAL.z);
  }

  // ---------------- per-unit driving --------------------------------------
  function collideBuildings(u) {
    var p = u.group.position, r = 1.7;
    for (var i = 0; i < city.colliders.length; i++) {
      var b = city.colliders[i];
      var nx = Math.max(b.minX, Math.min(p.x, b.maxX));
      var nz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      var dx = p.x - nx, dz = p.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) { p.x = b.maxX + r; continue; }
        var d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.z = nz + (dz / d) * r;
        u.speed *= 0.45;
      }
    }
  }
  function steer(u, tx, tz, dt, topSpeed) {
    var p = u.group.position;
    var dx = tx - p.x, dz = tz - p.z;
    var dist = Math.hypot(dx, dz);
    var desired = Math.atan2(dx, dz);
    var diff = ((desired - u.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    var turn = 2.4 * dt;
    u.heading += Math.max(-turn, Math.min(turn, diff));
    var target = dist > 55 ? topSpeed * 1.15 : dist > 18 ? topSpeed : dist > 7 ? topSpeed * 0.55 : 5;
    if (u.holdSpeed) target = Math.min(target, u.holdSpeed); // staged for screenshots
    if (Math.abs(diff) > 2.2) target = Math.min(target, 4); // don't charge a wall
    var accel = target > u.speed ? 14 : 24;
    u.speed += Math.max(-accel * dt, Math.min(accel * dt, target - u.speed));
    p.x += Math.sin(u.heading) * u.speed * dt;
    p.z += Math.cos(u.heading) * u.speed * dt;
    p.x = Math.max(city.bounds.minX + 2, Math.min(city.bounds.maxX - 2, p.x));
    p.z = Math.max(city.bounds.minZ + 2, Math.min(city.bounds.maxZ - 2, p.z));
    u.group.rotation.y = u.heading;
    collideBuildings(u);
    return dist;
  }

  // ---------------- staging for the chase screenshot ----------------------
  function stageChase() {
    var g = window.VC.game;
    if (!g || !g.vehicles || !g.vehicles.playerCar) return;
    var pp = g.vehicles.playerCar.group.position;
    while (units.length < 3) makeUnit();
    var spots = [
      { x: pp.x + 14, z: pp.z, h: -Math.PI / 2 },
      { x: pp.x + 25, z: pp.z + 5.5, h: -Math.PI / 2 },
      { x: pp.x + 46, z: pp.z + 5.5, h: -Math.PI / 2 }
    ];
    for (var i = 0; i < 3; i++) {
      var u = units[i];
      u.group.position.set(spots[i].x, 0, spots[i].z);
      u.heading = spots[i].h;
      u.group.rotation.y = u.heading;
      u.speed = 9.5;
      u.holdSpeed = 10.5; // close slowly, never ram the shot
      u.leaving = false;
    }
  }

  // ---------------- main update -------------------------------------------
  function update(dt) {
    timeAcc += dt;
    if (carHitCd > 0) carHitCd -= dt;
    if (footHitCd > 0) footHitCd -= dt;
    var g = window.VC.game;
    if (!g || !g.player) return;
    var tp = targetPos();

    // player speed (bust checks + sequence logic)
    if (havePrev && dt > 0) {
      playerSpeed = Math.hypot(tp.x - prevTX, tp.z - prevTZ) / dt;
    }
    prevTX = tp.x; prevTZ = tp.z; havePrev = true;

    // light bars flash alternately
    var phase = Math.floor(timeAcc * 3) % 2 === 0;
    for (var li = 0; li < units.length; li++) {
      units[li].redMat.color.setHex(phase ? 0xff2a2a : 0x4d0d0d);
      units[li].blueMat.color.setHex(phase ? 0x1a3a8f : 0x2f7bff);
    }

    // sequence (busted / wasted) freezes the law until it plays out
    if (seqT > 0) {
      seqT -= dt;
      for (var si = 0; si < units.length; si++) {
        units[si].speed = Math.max(0, units[si].speed - 20 * dt);
        var sp = units[si].group.position;
        sp.x += Math.sin(units[si].heading) * units[si].speed * dt;
        sp.z += Math.cos(units[si].heading) * units[si].speed * dt;
      }
      if (seqT <= 0) endSequence();
      return;
    }

    if (state.health <= 0) { doWasted(); return; }

    // field one unit per whole star
    var desired = Math.min(MAX_UNITS, Math.round(state.wanted));
    while (units.length < desired) {
      var nu = makeUnit();
      var s = spawnPosFor(tp);
      nu.group.position.set(s.x, 0, s.z);
      nu.heading = Math.atan2(tp.x - s.x, tp.z - s.z);
      nu.group.rotation.y = nu.heading;
    }
    // surplus units leave when the heat drops
    for (var ui = units.length - 1; ui >= 0; ui--) {
      var un = units[ui];
      if (ui >= desired && !un.leaving) { un.leaving = true; un.leaveT = 0; }
      if (un.leaving) {
        un.leaveT += dt;
        var lp = un.group.position;
        var away = Math.atan2(lp.x - tp.x, lp.z - tp.z);
        steer(un, lp.x + Math.sin(away) * 30, lp.z + Math.cos(away) * 30, dt, 16);
        var ld = Math.hypot(lp.x - tp.x, lp.z - tp.z);
        if (ld > 115 || un.leaveT > 20) removeUnit(un);
      }
    }

    // pursuit
    var nearest = Infinity;
    var veh = g.vehicles;
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (u.leaving) continue;
      var d = steer(u, tp.x, tp.z, dt, 23);
      if (d < nearest) nearest = d;

      // soft push-apart vs traffic / parked cars
      if (veh && veh.cars) {
        for (var ci = 0; ci < veh.cars.length; ci++) {
          var oc = veh.cars[ci];
          if (veh.playerCar === oc) continue;
          var op = oc.group.position, upos = u.group.position;
          var odx = upos.x - op.x, odz = upos.z - op.z;
          var od2 = odx * odx + odz * odz;
          if (od2 < 3.2 * 3.2 && od2 > 1e-6) {
            var od = Math.sqrt(od2);
            upos.x = op.x + (odx / od) * 3.2;
            upos.z = op.z + (odz / od) * 3.2;
          }
        }
      }
    }

    // contact consequences
    if (g.driving && veh && veh.playerCar) {
      var pc = veh.playerCar;
      for (var hi = 0; hi < units.length; hi++) {
        var hu = units[hi];
        if (hu.leaving) continue;
        var hp = hu.group.position, pp2 = pc.group.position;
        if (Math.hypot(hp.x - pp2.x, hp.z - pp2.z) < 3.4) {
          if (carHitCd <= 0) {
            pc.speed *= 0.55;
            state.damage(2);
            carHitCd = 1;
          }
        }
      }
    } else if (state.wanted > 0) {
      // on foot: contact hurts, standing still near a cop gets you busted
      var footNear = false;
      for (var fi = 0; fi < units.length; fi++) {
        var fu = units[fi];
        if (fu.leaving) continue;
        var fp = fu.group.position;
        var fd = Math.hypot(fp.x - tp.x, fp.z - tp.z);
        if (fd < 7) footNear = true;
        if (fd < 2.2 && footHitCd <= 0) {
          state.damage(3);
          footHitCd = 1;
          var pushA = Math.atan2(tp.x - fp.x, tp.z - fp.z);
          g.player.teleport(tp.x + Math.sin(pushA) * 1.1, tp.z + Math.cos(pushA) * 1.1);
        }
      }
      if (footNear && playerSpeed < 1.5) {
        bustT += dt;
        if (bustT >= 2.5) { doBusted(); return; }
      } else {
        bustT = Math.max(0, bustT - dt * 1.5);
      }
    }

    // wanted decay: unseen and quiet for a while → stars bleed off
    if (state.wanted > 0) {
      if (nearest > 45 && timeAcc - lastCrimeT > 12) {
        decayT += dt;
        if (decayT >= 10) {
          decayT = 0;
          state.wanted = Math.max(0, state.wanted - 0.5);
        }
      } else {
        decayT = 0;
      }
    }

    audio.sirenSet(state.wanted > 0 && nearest < 55);
  }

  return { update: update, units: units, stageChase: stageChase };
};
