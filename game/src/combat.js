// VICE CITY: Rise of Crime — on-foot combat: hitscan pistol + melee.
// Q arms/disarms, mouse click fires (or punches when unarmed), F punches,
// R reloads from the reserve. Shots panic crowds and feed the crime stream;
// the police module turns crimes into wanted stars.
window.VC = window.VC || {};

VC.createCombat = function (scene, state, npcs, audio) {
  var MAX_AMMO = 60;
  var RANGE = 45;

  var armed = true;
  var fireCd = 0;      // seconds until the next allowed shot
  var reloadT = 0;     // reload lockout remaining
  var flashT = 0;      // muzzle-flash light decay
  var tracerT = 0;     // tracer fade
  var prevQ = false, prevR = false, prevF = false;

  // --- effects: one reusable point light + one tracer line ---------------
  var flash = new THREE.PointLight(0xffb45e, 0, 22, 2);
  flash.position.set(0, -10, 0);
  scene.add(flash);

  var tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  var tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  var tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);

  var _dir = new THREE.Vector3();
  var _rel = new THREE.Vector3();

  function game() { return window.VC.game || null; }
  function busy() {
    var g = game();
    return !g || !!g.driving || !!g.inputLocked;
  }

  // 2D segment vs AABB (slab test) on the XZ plane: true if the segment
  // touches the box before fraction `tMax` of its length.
  function segBlocked(x1, z1, x2, z2, b, tMax) {
    var dx = x2 - x1, dz = z2 - z1;
    var t0 = 0, t1 = tMax;
    if (Math.abs(dx) < 1e-8) { if (x1 < b.minX || x1 > b.maxX) return false; }
    else {
      var ta = (b.minX - x1) / dx, tb = (b.maxX - x1) / dx;
      if (ta > tb) { var s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }
    if (Math.abs(dz) < 1e-8) { if (z1 < b.minZ || z1 > b.maxZ) return false; }
    else {
      var tc = (b.minZ - z1) / dz, td = (b.maxZ - z1) / dz;
      if (tc > td) { var s2 = tc; tc = td; td = s2; }
      if (tc > t0) t0 = tc;
      if (td < t1) t1 = td;
      if (t0 > t1) return false;
    }
    return true;
  }

  function losBlocked(x1, z1, x2, z2) {
    var g = game();
    var cols = g && g.city ? g.city.colliders : null;
    if (!cols) return false;
    for (var i = 0; i < cols.length; i++) {
      if (segBlocked(x1, z1, x2, z2, cols[i], 0.96)) return true;
    }
    return false;
  }

  // The same down-state npc.js uses when a car runs a ped over.
  function downPed(p) {
    p.mode = 'down';
    p.timer = 6;
    p.fig.group.rotation.x = -Math.PI / 2;
    p.fig.group.position.y = 0.25;
  }

  function tryMelee() {
    var g = game();
    if (!g || !g.player) return;
    var pp = g.player.position;
    var best = null, bd = 1.9;
    for (var i = 0; i < npcs.peds.length; i++) {
      var p = npcs.peds[i];
      if (p.mode === 'down') continue;
      var gp = p.fig.group.position;
      var d = Math.hypot(gp.x - pp.x, gp.z - pp.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      downPed(best);
      audio.punch();
      state.commitCrime(1, 'assault');
      npcs.panicAt(pp.x, pp.z, 10);
    }
  }

  function fire() {
    var g = game();
    if (!g || !g.engine || !g.player) return;
    var cam = g.engine.camera;
    cam.getWorldDirection(_dir);
    var ox = cam.position.x, oy = cam.position.y, oz = cam.position.z;
    var pp = g.player.position;

    state.ammo -= 1;
    fireCd = 0.14;
    audio.shot();
    npcs.panicAt(pp.x, pp.z, 18);

    // muzzle flash + tracer start just ahead of the camera
    var mx = ox + _dir.x * 1.4, my = oy + _dir.y * 1.4 - 0.15, mz = oz + _dir.z * 1.4;
    flash.position.set(mx, my, mz);
    flash.intensity = 30;
    flashT = 0.06;

    // nearest ped in the centre cone
    var bestT = Infinity, bestPed = null;
    for (var i = 0; i < npcs.peds.length; i++) {
      var p = npcs.peds[i];
      if (p.mode === 'down') continue;
      var gp = p.fig.group.position;
      _rel.set(gp.x - ox, gp.y + 1.05 - oy, gp.z - oz);
      var t = _rel.dot(_dir);
      if (t < 1.5 || t > RANGE) continue;
      var perp2 = _rel.lengthSq() - t * t;
      var thr = 0.55 + t * 0.045;
      if (perp2 < thr * thr && t < bestT) { bestT = t; bestPed = p; }
    }
    // nearest car in the cone
    var carT = Infinity;
    var veh = g.vehicles;
    if (veh && veh.cars) {
      for (var j = 0; j < veh.cars.length; j++) {
        var cp = veh.cars[j].group.position;
        _rel.set(cp.x - ox, cp.y + 0.75 - oy, cp.z - oz);
        var tc = _rel.dot(_dir);
        if (tc < 1.5 || tc > RANGE) continue;
        var perpC2 = _rel.lengthSq() - tc * tc;
        var thrC = 1.9 + tc * 0.03;
        if (perpC2 < thrC * thrC && tc < carT) carT = tc;
      }
    }

    var hitT = RANGE;
    if (bestPed && bestT < carT) {
      var bp = bestPed.fig.group.position;
      if (!losBlocked(pp.x, pp.z, bp.x, bp.z)) {
        downPed(bestPed);
        state.kills += 1;
        state.commitCrime(2, 'shooting');
        hitT = bestT;
      }
    } else if (carT < Infinity) {
      state.commitCrime(1, 'shotsfired');
      hitT = carT;
    } else {
      state.commitCrime(1, 'shotsfired');
    }

    var pos = tracerGeo.attributes.position;
    pos.setXYZ(0, mx, my, mz);
    pos.setXYZ(1, ox + _dir.x * hitT, oy + _dir.y * hitT, oz + _dir.z * hitT);
    pos.needsUpdate = true;
    tracerMat.opacity = 0.9;
    tracerT = 0.06;
  }

  function reload() {
    if (reloadT > 0 || state.ammo >= MAX_AMMO || state.reserveAmmo <= 0) return;
    var take = Math.min(MAX_AMMO - state.ammo, state.reserveAmmo);
    state.ammo += take;
    state.reserveAmmo -= take;
    reloadT = 0.8;
    audio.blip();
  }

  // Mouse fire / punch — clicks on menu overlays never reach the canvas.
  var canvas = document.getElementById('game');
  if (canvas) {
    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || busy()) return;
      if (armed) {
        if (fireCd <= 0 && reloadT <= 0 && state.ammo > 0) fire();
        else if (state.ammo <= 0) reload();
      } else {
        tryMelee();
      }
    });
  }

  function update(dt, input) {
    if (fireCd > 0) fireCd -= dt;
    if (reloadT > 0) reloadT -= dt;
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.intensity = 0; }
    if (tracerT > 0) {
      tracerT -= dt;
      tracerMat.opacity = Math.max(0, tracerT / 0.06) * 0.9;
    }
    if (!input || !input.keys || busy()) { prevQ = prevR = prevF = false; return; }

    var q = !!input.keys.KeyQ;
    if (q && !prevQ) { armed = !armed; audio.blip(); }
    prevQ = q;

    var r = !!input.keys.KeyR;
    if (r && !prevR) reload();
    prevR = r;

    var f = !!input.keys.KeyF;
    if (f && !prevF) tryMelee();
    prevF = f;
  }

  var api = { update: update };
  Object.defineProperty(api, 'armed', { get: function () { return armed; } });
  return api;
};
