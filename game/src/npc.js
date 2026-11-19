// VICE CITY: Rise of Crime — pedestrians.
// ~26 low-poly walkers on the sidewalks: they stroll, turn or cross at
// intersections, panic and flee from danger, and go down when the player's
// car hits them (which reports a hit-and-run crime to the shared state).
window.VC = window.VC || {};

VC.createNPCs = function (scene, city, rng, state) {
  var ROAD_W = city.roads.roadW;         // 12
  var PITCH = city.roads.block;          // 52
  var N = city.roads.n;                  // 9 road lines per axis
  var SIDE = ROAD_W / 2 + 1.5;           // sidewalk offset from road centre
  var FIRST = -234;                      // first road line (avenues & streets)
  var BOUND = 250;                       // keep walkers inside the city

  var SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xff9ff3, 0x54a0ff, 0xff9f43,
                0x1dd1a1, 0x48dbfb, 0xf368e0, 0xee5253, 0x0abde3, 0xfed330];
  var PANTS = [0x2f3542, 0x57606f, 0x747d8c, 0x3b3b98, 0x82589f, 0x222f3e];
  var SKIN = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];

  var matCache = {};
  function mat(color) {
    if (!matCache[color]) matCache[color] = new THREE.MeshLambertMaterial({ color: color });
    return matCache[color];
  }
  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    return m;
  }

  // One walker figure ~1.75 units tall, pivoted at the feet.
  function buildFigure() {
    var g = new THREE.Group();
    var shirt = SHIRTS[rng.int(0, SHIRTS.length - 1)];
    var pants = PANTS[rng.int(0, PANTS.length - 1)];
    var skin = SKIN[rng.int(0, SKIN.length - 1)];

    var legL = box(0.16, 0.8, 0.18, pants, -0.11, 0.4, 0);
    var legR = box(0.16, 0.8, 0.18, pants, 0.11, 0.4, 0);
    legL.geometry.translate(0, -0.4, 0); legL.position.y = 0.8;
    legR.geometry.translate(0, -0.4, 0); legR.position.y = 0.8;
    var torso = box(0.46, 0.62, 0.24, shirt, 0, 1.11, 0);
    var armL = box(0.11, 0.58, 0.13, shirt, -0.3, 1.36, 0);
    var armR = box(0.11, 0.58, 0.13, shirt, 0.3, 1.36, 0);
    armL.geometry.translate(0, -0.24, 0);
    armR.geometry.translate(0, -0.24, 0);
    var head = box(0.26, 0.28, 0.26, skin, 0, 1.58, 0);
    g.add(legL); g.add(legR); g.add(torso); g.add(armL); g.add(armR); g.add(head);
    return { group: g, legL: legL, legR: legR, armL: armL, armR: armR };
  }

  function roadLine(i) { return FIRST + PITCH * i; }

  // Place a ped on a random sidewalk: axis 'z' = strolling along z on an
  // avenue sidewalk (fixed x), axis 'x' = along x on a street sidewalk.
  function placeOnSidewalk(p, nearX, nearZ) {
    var li = rng.int(0, N - 1);
    var off = (rng.next() < 0.5 ? -SIDE : SIDE);
    if (rng.next() < 0.5) {
      p.axis = 'z'; p.fixed = roadLine(li) + off;
      p.t = nearZ !== undefined ? nearZ + rng.range(-26, 26) : rng.range(-BOUND, BOUND);
    } else {
      p.axis = 'x'; p.fixed = roadLine(li) + off;
      p.t = nearX !== undefined ? nearX + rng.range(-26, 26) : rng.range(-BOUND, BOUND);
    }
    p.dir = rng.next() < 0.5 ? 1 : -1;
    p.mode = 'walk';
    p.timer = 0;
    syncTransform(p, 0);
  }

  function syncTransform(p, swing) {
    var g = p.fig.group;
    if (p.axis === 'z') g.position.set(p.fixed, 0, p.t);
    else g.position.set(p.t, 0, p.fixed);
    var hx = p.axis === 'x' ? p.dir : 0;
    var hz = p.axis === 'z' ? p.dir : 0;
    if (p.mode === 'flee') { hx = p.fleeX; hz = p.fleeZ; g.position.x = p.fx; g.position.z = p.fz; }
    g.rotation.y = Math.atan2(hx, hz);
    var s = swing || 0;
    p.fig.legL.rotation.x = s;
    p.fig.legR.rotation.x = -s;
    p.fig.armL.rotation.x = -s * 0.8;
    p.fig.armR.rotation.x = s * 0.8;
    g.position.y = Math.abs(Math.sin(p.phase)) * 0.045;
  }

  var peds = [];
  for (var i = 0; i < 26; i++) {
    var fig = buildFigure();
    scene.add(fig.group);
    var ped = {
      fig: fig, axis: 'z', fixed: 0, t: 0, dir: 1,
      speed: rng.range(1.1, 1.9), phase: rng.range(0, 6.28),
      mode: 'walk', timer: 0, fleeX: 0, fleeZ: 0, fx: 0, fz: 0,
      lastCross: -999
    };
    placeOnSidewalk(ped);
    peds.push(ped);
  }

  // Did the ped cross a road line (intersection) this step?
  function crossedLine(prev, now) {
    var a = Math.round((prev - FIRST) / PITCH);
    var b = Math.round((now - FIRST) / PITCH);
    if (a === b) return -1;
    var line = roadLine(now > prev ? b : a);
    // only count when actually passing the line position
    if ((prev - line) * (now - line) <= 0 && prev !== now) return line;
    return -1;
  }

  function atIntersection(p, line) {
    var roll = rng.next();
    if (roll < 0.30) {
      // turn onto the crossing road: walk along it on a corner sidewalk
      var alongHere = p.fixed; // coordinate we keep as our position on the new axis
      p.axis = p.axis === 'z' ? 'x' : 'z';
      p.fixed = line + (p.dir >= 0 ? SIDE : -SIDE);
      p.t = alongHere;
      if (rng.next() < 0.5) p.dir = -p.dir;
    } else if (roll < 0.45) {
      // cross the road to the opposite sidewalk of the same road
      var lineC = nearestLine(p.fixed);
      var s = Math.sign(p.fixed - lineC) || 1;
      p.fixed = lineC - s * SIDE;
    }
    // else: continue straight
  }

  function nearestLine(v) {
    var i = Math.round((v - FIRST) / PITCH);
    i = Math.max(0, Math.min(N - 1, i));
    return roadLine(i);
  }

  // Snap a ped (e.g. after fleeing) back onto the nearest sidewalk.
  function snapToSidewalk(p) {
    var gx = p.fig.group.position.x, gz = p.fig.group.position.z;
    var lx = nearestLine(gx), lz = nearestLine(gz);
    if (Math.abs(gx - lx) < Math.abs(gz - lz)) {
      p.axis = 'z';
      p.fixed = lx + (gx >= lx ? SIDE : -SIDE);
      p.t = Math.max(-BOUND, Math.min(BOUND, gz));
    } else {
      p.axis = 'x';
      p.fixed = lz + (gz >= lz ? SIDE : -SIDE);
      p.t = Math.max(-BOUND, Math.min(BOUND, gx));
    }
    p.mode = 'walk';
    syncTransform(p, 0);
  }

  function panicAt(x, z, radius) {
    var r2 = radius * radius;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.mode === 'down') continue;
      var gp = p.fig.group.position;
      var dx = gp.x - x, dz = gp.z - z;
      var d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      var d = Math.sqrt(d2) || 1;
      p.mode = 'flee';
      p.timer = rng.range(3, 5);
      p.fleeX = dx / d; p.fleeZ = dz / d;
      p.fx = gp.x; p.fz = gp.z;
    }
  }

  function update(dt) {
    var veh = VC.game && VC.game.vehicles;
    var car = veh && veh.playerCar;
    var carPos = car ? car.group.position : null;
    var carSpeed = car ? Math.abs(car.speed) : 0;

    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      var g = p.fig.group;

      if (p.mode === 'down') {
        p.timer -= dt;
        if (p.timer <= 0) {
          g.rotation.x = 0;
          // respawn far from the player
          var px = VC.game && VC.game.player ? VC.game.player.position.x : 0;
          var pz = VC.game && VC.game.player ? VC.game.player.position.z : 0;
          do { placeOnSidewalk(p); } while (Math.abs(g.position.x - px) < 60 && Math.abs(g.position.z - pz) < 60);
        }
        continue;
      }

      // player-car interactions: panic near fast car, hit = down + crime
      if (carPos) {
        var dx = g.position.x - carPos.x, dz = g.position.z - carPos.z;
        var d2 = dx * dx + dz * dz;
        if (carSpeed > 4 && d2 < 1.6 * 1.6) {
          p.mode = 'down';
          p.timer = 6;
          g.rotation.x = -Math.PI / 2;
          g.position.y = 0.25;
          if (state) state.commitCrime(2, 'hitrun');
          continue;
        }
        if (carSpeed > 10 && d2 < 25 && p.mode === 'walk') {
          panicAt(carPos.x, carPos.z, 8);
        }
      }

      if (p.mode === 'flee') {
        p.timer -= dt;
        var fs = 5.4;
        p.fx += p.fleeX * fs * dt;
        p.fz += p.fleeZ * fs * dt;
        p.phase += dt * fs * 2.4;
        if (p.timer <= 0) snapToSidewalk(p);
        else syncTransform(p, Math.sin(p.phase) * 0.65);
        continue;
      }

      // calm sidewalk stroll
      var prev = p.t;
      p.t += p.dir * p.speed * dt;
      p.phase += dt * p.speed * 2.3;
      if (p.t > BOUND || p.t < -BOUND) { p.dir = -p.dir; p.t = Math.max(-BOUND, Math.min(BOUND, p.t)); }
      var line = crossedLine(prev, p.t);
      if (line !== -1) atIntersection(p, line);
      syncTransform(p, Math.sin(p.phase) * 0.5);
    }
  }

  // Relocate the nearest `count` peds onto sidewalks around a point
  // (used by screenshot modes to guarantee a busy street).
  function scatterNear(x, z, count) {
    var sorted = peds.slice().sort(function (a, b) {
      var da = (a.fig.group.position.x - x) * (a.fig.group.position.x - x) + (a.fig.group.position.z - z) * (a.fig.group.position.z - z);
      var db = (b.fig.group.position.x - x) * (b.fig.group.position.x - x) + (b.fig.group.position.z - z) * (b.fig.group.position.z - z);
      return da - db;
    });
    for (var i = 0; i < Math.min(count, sorted.length); i++) placeOnSidewalk(sorted[i], x, z);
  }

  return { update: update, peds: peds, panicAt: panicAt, scatterNear: scatterNear };
};
