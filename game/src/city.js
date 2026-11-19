// VICE CITY: Rise of Crime — the city: street grid, buildings, palms, beach.
// Built once from a seeded RNG; returns colliders/bounds/roads for later chunks.
window.VC = window.VC || {};

VC.buildCity = function (scene, rng) {
  var N = 9, PITCH = 52, ROADW = 12, BLOCK = PITCH - ROADW; // block = 40
  var HALF = (N * PITCH) / 2; // 234
  var colliders = [];
  var facadeMats = [];

  function blockCenter(i) { return -HALF + PITCH / 2 + i * PITCH; }

  // ---------- ground: one canvas texture draws asphalt, sidewalks, dashes ----------
  (function ground() {
    var S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    var g = cv.getContext('2d');
    var px = function (w) { return (w + HALF) / (2 * HALF) * S; }; // world -> px
    var sc = S / (2 * HALF); // px per world unit
    g.fillStyle = '#333338'; g.fillRect(0, 0, S, S); // asphalt
    var i, j;
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      var cx = px(blockCenter(i) - BLOCK / 2), cz = px(blockCenter(j) - BLOCK / 2);
      var w = BLOCK * sc;
      g.fillStyle = '#a9aeb1'; g.fillRect(cx, cz, w, w); // sidewalk slab
      g.fillStyle = '#bcc1c3'; g.fillRect(cx + 3, cz + 3, w - 6, w - 6); // plaza inner
    }
    g.fillStyle = '#e8c832'; // dashed centre lines on every road
    for (i = 0; i <= N; i++) {
      var c = px(-HALF + i * PITCH);
      for (var d = -HALF; d < HALF; d += 9) {
        g.fillRect(c - 1, px(d), 2, 4.6 * sc); // vertical road dashes
        g.fillRect(px(d), c - 1, 4.6 * sc, 2); // horizontal road dashes
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    var base = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600),
      new THREE.MeshLambertMaterial({ color: 0x77a05a }));
    base.rotation.x = -Math.PI / 2; base.position.y = -0.08;
    scene.add(base);
  })();

  // ---------- buildings ----------
  var PALETTE = [0xf2e3c9, 0xe8a2b4, 0x9fd4cf, 0xf5f0e6, 0xe9b44c, 0xb5c7e8];
  function facadeTexture(baseHex) {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
    var g = cv.getContext('2d');
    var ev = document.createElement('canvas'); ev.width = 128; ev.height = 256;
    var e = ev.getContext('2d');
    var base = '#' + baseHex.toString(16).padStart(6, '0');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, 128, 10); // cornice shade
    e.fillStyle = '#000'; e.fillRect(0, 0, 128, 256);
    var lit = [];
    for (var r = 0; r < 14; r++) for (var c = 0; c < 6; c++) {
      var x = 8 + c * 20, y = 14 + r * 17, on = rng.next() < 0.34;
      g.fillStyle = on ? '#ffd98a' : '#2c3e50';
      g.fillRect(x, y, 12, 9);
      if (on) { e.fillStyle = '#ffc46b'; e.fillRect(x, y, 12, 9); lit.push(1); }
    }
    return { map: new THREE.CanvasTexture(cv), emissive: new THREE.CanvasTexture(ev) };
  }
  var variants = PALETTE.map(function (hex) {
    var t = facadeTexture(hex);
    var m = new THREE.MeshLambertMaterial({
      map: t.map, emissiveMap: t.emissive, emissive: 0xffb45e, emissiveIntensity: 0
    });
    facadeMats.push(m);
    return m;
  });
  var roofMat = new THREE.MeshLambertMaterial({ color: 0x64686c });
  var boxGeoCache = {};
  function buildingGeo(w, h, d) {
    var k = w.toFixed(1) + 'x' + h.toFixed(1) + 'x' + d.toFixed(1);
    if (!boxGeoCache[k]) boxGeoCache[k] = new THREE.BoxGeometry(w, h, d);
    return boxGeoCache[k];
  }
  (function buildings() {
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var bx = blockCenter(i), bz = blockCenter(j);
      var distC = Math.max(Math.abs(bx), Math.abs(bz)) / HALF; // 0 centre -> 1 edge
      for (var a = -1; a <= 1; a += 2) for (var b = -1; b <= 1; b += 2) {
        if (rng.next() < 0.15) continue; // empty lot / plaza
        var w = rng.range(12, 18), d = rng.range(12, 18);
        var h = rng.range(10, 20) + (1 - distC) * rng.range(12, 40);
        var x = bx + a * 10, z = bz + b * 10;
        var mat = variants[rng.int(0, variants.length - 1)];
        var mesh = new THREE.Mesh(buildingGeo(w, h, d),
          [mat, mat, roofMat, roofMat, mat, mat]);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  })();

  // ---------- palm trees (instanced trunks + instanced fronds) ----------
  (function palms() {
    var COUNT = 300;
    var trunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 6, 5);
    trunkGeo.translate(0, 3, 0);
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, COUNT);
    trunks.castShadow = true;
    var frondGeo = new THREE.PlaneGeometry(0.9, 3.4, 1, 4);
    frondGeo.translate(0, 1.7, 0);
    var pos = frondGeo.attributes.position;
    for (var v = 0; v < pos.count; v++) {
      var y = pos.getY(v);
      pos.setZ(v, -0.20 * y * y / 3.4);              // droop
      pos.setX(v, pos.getX(v) * (1 - y / 3.4 * 0.65)); // taper
    }
    frondGeo.computeVertexNormals();
    var frondMat = new THREE.MeshLambertMaterial({ color: 0x2e9e4f, side: THREE.DoubleSide });
    var FRONDS = 6;
    var fronds = new THREE.InstancedMesh(frondGeo, frondMat, COUNT * FRONDS);
    var dummy = new THREE.Object3D();
    var top = new THREE.Vector3();
    for (var i = 0; i < COUNT; i++) {
      var bx, bz;
      if (i % 5 === 4) { // beach row
        bx = rng.range(-HALF, HALF); bz = rng.range(HALF + 14, HALF + 60);
      } else { // block perimeter (sidewalk edge)
        bx = blockCenter(rng.int(0, N - 1)); bz = blockCenter(rng.int(0, N - 1));
        var side = rng.int(0, 3), along = rng.range(-19, 19);
        if (side === 0) { bx += along; bz -= 20.8; }
        if (side === 1) { bx += along; bz += 20.8; }
        if (side === 2) { bx -= 20.8; bz += along; }
        if (side === 3) { bx += 20.8; bz += along; }
      }
      var sy = rng.range(0.8, 1.25);
      dummy.position.set(bx, 0, bz);
      dummy.rotation.set(rng.range(-0.1, 0.1), rng.range(0, 6.28), rng.range(-0.1, 0.1));
      dummy.scale.set(1, sy, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      top.set(0, 6, 0).applyMatrix4(dummy.matrix);
      for (var f = 0; f < FRONDS; f++) {
        dummy.position.copy(top);
        dummy.rotation.order = 'YXZ';
        dummy.rotation.set(-rng.range(0.45, 0.85), f * (Math.PI * 2 / FRONDS) + rng.range(-0.2, 0.2), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fronds.setMatrixAt(i * FRONDS + f, dummy.matrix);
      }
    }
    scene.add(trunks); scene.add(fronds);
  })();

  // ---------- streetlights (heads glow at night) ----------
  var lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x4a4f55 });
  (function lights() {
    var pts = [];
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++)
      pts.push([-HALF + i * PITCH + ROADW / 2 + 0.9, -HALF + j * PITCH + ROADW / 2 + 0.9]);
    var poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6, 5);
    poleGeo.translate(0, 3, 0);
    var poles = new THREE.InstancedMesh(poleGeo,
      new THREE.MeshLambertMaterial({ color: 0x3c4147 }), pts.length);
    var headGeo = new THREE.BoxGeometry(0.72, 0.16, 0.72);
    headGeo.translate(0, 6.05, 0);
    var heads = new THREE.InstancedMesh(headGeo, lampHeadMat, pts.length);
    var dummy = new THREE.Object3D();
    pts.forEach(function (p, k) {
      dummy.position.set(p[0], 0, p[1]);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(k, dummy.matrix);
      heads.setMatrixAt(k, dummy.matrix);
    });
    scene.add(poles); scene.add(heads);
  })();

  // ---------- beach + animated ocean ----------
  var waterTex, foamMat, elapsed = 0;
  (function beach() {
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(1500, 104),
      new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, HALF + 52);
    sand.receiveShadow = true;
    scene.add(sand);

    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var g = cv.getContext('2d');
    g.fillStyle = '#2fa3c8'; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 26; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.04 + rng.next() * 0.07) + ')';
      g.fillRect(0, rng.range(0, 256), 256, rng.range(2, 6));
    }
    waterTex = new THREE.CanvasTexture(cv);
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(10, 4);
    var water = new THREE.Mesh(new THREE.PlaneGeometry(1700, 560),
      new THREE.MeshPhongMaterial({
        map: waterTex, color: 0x9fd8e8, specular: 0xbfefff,
        shininess: 90, transparent: true, opacity: 0.93
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.12, HALF + 102 + 278);
    scene.add(water);

    foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    var foam = new THREE.Mesh(new THREE.PlaneGeometry(1500, 2.4), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.14, HALF + 100);
    scene.add(foam);

    // umbrellas + crates + barriers
    var umbCols = [0xff5a5a, 0xffc93c, 0x3ec1d3, 0xff8fab];
    for (var u = 0; u < 10; u++) {
      var grp = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5),
        new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
      pole.position.y = 1.15; grp.add(pole);
      var top2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.65, 8),
        new THREE.MeshLambertMaterial({ color: umbCols[u % umbCols.length] }));
      top2.position.y = 2.35; top2.castShadow = true; grp.add(top2);
      grp.position.set(rng.range(-HALF, HALF), 0, HALF + rng.range(22, 78));
      scene.add(grp);
    }
    var crateMat = new THREE.MeshLambertMaterial({ color: 0xa97c50 });
    for (var c = 0; c < 14; c++) {
      var crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), crateMat);
      crate.position.set(rng.range(-HALF, HALF), 0.65, rng.range(-HALF, HALF + 40));
      crate.rotation.y = rng.range(0, 3);
      crate.castShadow = true;
      scene.add(crate);
    }
    var barMat = new THREE.MeshLambertMaterial({ color: 0xe8762c });
    for (var b = 0; b < 8; b++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.5), barMat);
      var onX = rng.next() < 0.5;
      bar.position.set(onX ? -HALF + rng.int(0, N) * PITCH : rng.range(-HALF, HALF), 0.43,
        onX ? rng.range(-HALF, HALF) : -HALF + rng.int(0, N) * PITCH);
      bar.castShadow = true;
      scene.add(bar);
    }
  })();

  // ---------- night wiring ----------
  var lampDay = new THREE.Color(0x4a4f55), lampNight = new THREE.Color(0xffd9a0);
  if (VC.engine && VC.engine.onDay) {
    VC.engine.onDay(function (nf) {
      lampHeadMat.color.copy(lampDay).lerp(lampNight, nf);
      for (var i = 0; i < facadeMats.length; i++) facadeMats[i].emissiveIntensity = nf * 0.95;
    });
  }

  return {
    colliders: colliders,
    bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF + 102 },
    roads: { block: PITCH, roadW: ROADW, n: N },
    update: function (dt) {
      elapsed += dt;
      if (waterTex) { waterTex.offset.x = (elapsed * 0.010) % 1; waterTex.offset.y = (elapsed * 0.004) % 1; }
      if (foamMat) foamMat.opacity = 0.24 + 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 1.3));
    }
  };
};
