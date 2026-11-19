'use strict';
/* VICE CITY: Rise of Crime — city.js
 * VC.buildCity(scene, rng, engine): the tropical grid — roads with dashed
 * centrelines, pastel tower blocks with windows that light up at night,
 * palms, streetlights, a beach, water and a pier to the south.
 * Returns {group, colliders, bounds, roads}. Colliders are 2D AABBs
 * ({minX, maxX, minZ, maxZ}) for every building footprint. */
window.VC = window.VC || {};

VC.buildCity = function (scene, rng, engine) {
  const BLOCK = 52, ROADW = 12, N = 9;
  const roads = { block: BLOCK, roadW: ROADW, n: N };
  const bounds = { minX: -262, maxX: 262, minZ: -262, maxZ: 286 };
  const group = new THREE.Group();
  const colliders = [];

  const centres = [];
  for (let k = 0; k < N; k++) centres.push(-234 + BLOCK * k);

  /* Materials whose emissive strength follows the day cycle. */
  const dayMats = [];
  function registerDay(mat, dayI, nightI) {
    mat.emissiveIntensity = dayI;
    dayMats.push({ mat: mat, dayI: dayI, nightI: nightI });
  }
  if (engine && engine.onDay) {
    engine.onDay(function (night) {
      for (let i = 0; i < dayMats.length; i++) {
        const d = dayMats[i];
        d.mat.emissiveIntensity = d.dayI + (d.nightI - d.dayI) * night;
      }
    });
  }

  /* ---- canvas textures ---- */
  function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  /* Asphalt tile: dark, speckled, one dashed centre line along U. */
  const asphaltTex = makeCanvas(128, 128, function (g, w, h) {
    g.fillStyle = '#33373c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rng.chance(0.5) ? '#3a3f45' : '#2c3034';
      g.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
    }
    g.fillStyle = '#e8e4c8';
    g.fillRect(14, h / 2 - 2, 62, 4);
  });
  const asphaltTexNS = asphaltTex.clone();
  asphaltTexNS.center.set(0.5, 0.5);
  asphaltTexNS.rotation = Math.PI / 2;
  asphaltTexNS.needsUpdate = true;

  /* Building wall: pale plaster with a window grid (used as map). */
  const wallTex = makeCanvas(128, 256, function (g, w, h) {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 12; y += 22) {
      for (let x = 10; x < w - 12; x += 22) {
        g.fillStyle = rng.chance(0.22) ? '#ffd98a' : '#5a6d80';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
  /* Emissive map: black except the lit windows. */
  const glowTex = makeCanvas(128, 256, function (g, w, h) {
    g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 12; y += 22) {
      for (let x = 10; x < w - 12; x += 22) {
        if (rng.chance(0.22)) { g.fillStyle = '#ffc46a'; g.fillRect(x, y, 12, 14); }
      }
    }
  });
  /* Palm frond: green strokes fanning from the base, alpha background. */
  const frondTex = makeCanvas(128, 64, function (g, w, h) {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2e9e4f'; g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = -0.25 - i * 0.16;
      g.beginPath();
      g.moveTo(4, h - 4);
      g.quadraticCurveTo(w * 0.55, h - 4 + Math.sin(a) * 34, w - 4, h - 4 + Math.sin(a) * 58 + 16);
      g.stroke();
    }
  });
  frondTex.wrapS = frondTex.wrapT = THREE.ClampToEdgeWrapping;

  /* ---- ground base (asphalt dark everywhere) ---- */
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
    new THREE.MeshLambertMaterial({ color: 0x33373b })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, 0, (bounds.minZ + bounds.maxZ) / 2);
  base.receiveShadow = true;
  group.add(base);

  /* ---- roads ---- */
  const roadMatEW = new THREE.MeshLambertMaterial({ map: asphaltTex });
  const roadMatNS = new THREE.MeshLambertMaterial({ map: asphaltTexNS });
  const SPAN = 524;
  for (let k = 0; k < N; k++) {
    const c = centres[k];
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, ROADW), roadMatEW);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.015, c);
    ew.receiveShadow = true;
    group.add(ew);
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(ROADW, SPAN), roadMatNS);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.02, 0);
    ns.receiveShadow = true;
    group.add(ns);
  }
  asphaltTex.repeat.set(SPAN / 26, 1);
  asphaltTexNS.repeat.set(1, SPAN / 26);

  /* ---- sidewalk slabs + buildings, block by block ---- */
  const slabMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a2 });
  const slabGeo = new THREE.BoxGeometry(BLOCK - ROADW, 0.06, BLOCK - ROADW);
  const PASTELS = [0xf6c6d8, 0xf9e08a, 0xa8d8ea, 0xb8e6c9, 0xf7b267, 0xd5b8ea, 0xf2f0d5, 0xffa8a8];
  const NEONS = [0xff2e88, 0x00e5ff, 0xff9500, 0xb6ff00];
  const buildingMats = PASTELS.map(function (col) {
    const m = new THREE.MeshLambertMaterial({
      color: col, map: wallTex,
      emissive: 0xffc46a, emissiveMap: glowTex, emissiveIntensity: 0
    });
    registerDay(m, 0, 0.95);
    return m;
  });
  const neonMats = NEONS.map(function (col) {
    const m = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.4 });
    registerDay(m, 0.4, 1.25);
    return m;
  });
  const trimGeoCache = {};

  function addBuilding(cx, cz, w, d, maxH) {
    const distC = Math.sqrt(cx * cx + cz * cz);
    const centreBoost = Math.max(0, 1 - distC / 330) * 38;
    const h = Math.min(70, Math.max(12, rng.range(12, 30) + centreBoost * rng.range(0.4, 1)));
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = buildingMats[rng.int(0, buildingMats.length - 1)];
    const b = new THREE.Mesh(geo, mat);
    b.position.set(cx, 0.06 + h / 2, cz);
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
    if (rng.chance(0.35)) {
      const key = w.toFixed(1) + 'x' + d.toFixed(1);
      if (!trimGeoCache[key]) trimGeoCache[key] = new THREE.BoxGeometry(w + 0.5, 0.55, d + 0.5);
      const trim = new THREE.Mesh(trimGeoCache[key], neonMats[rng.int(0, neonMats.length - 1)]);
      trim.position.set(cx, 0.06 + h + 0.27, cz);
      group.add(trim);
    }
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return h;
  }

  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const cx = centres[i] + BLOCK / 2;
      const cz = centres[j] + BLOCK / 2;
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(cx, 0.03, cz);
      slab.receiveShadow = true;
      group.add(slab);

      const count = rng.int(1, 4);
      if (count === 1) {
        addBuilding(cx + rng.range(-2, 2), cz + rng.range(-2, 2), rng.range(24, 36), rng.range(24, 36));
      } else if (count === 2) {
        if (rng.chance(0.5)) {
          addBuilding(cx - 10, cz, rng.range(15, 18), rng.range(22, 34));
          addBuilding(cx + 10, cz, rng.range(15, 18), rng.range(22, 34));
        } else {
          addBuilding(cx, cz - 10, rng.range(22, 34), rng.range(15, 18));
          addBuilding(cx, cz + 10, rng.range(22, 34), rng.range(15, 18));
        }
      } else {
        const offs = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
        for (let q = 0; q < count; q++) {
          addBuilding(cx + offs[q][0], cz + offs[q][1], rng.range(13, 18), rng.range(13, 18));
        }
      }
    }
  }

  /* ---- palm trees along the sidewalks ---- */
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 4.4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const frondGeo = new THREE.PlaneGeometry(3.6, 1.8);
  const frondMat = new THREE.MeshLambertMaterial({ map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide });
  function addPalm(x, z) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.2;
    trunk.rotation.z = rng.range(-0.07, 0.07);
    t.add(trunk);
    for (let p = 0; p < 3; p++) {
      const fr = new THREE.Mesh(frondGeo, frondMat);
      fr.position.y = 4.45;
      fr.rotation.y = (p / 3) * Math.PI;
      fr.rotation.x = -0.5;
      t.add(fr);
    }
    t.position.set(x, 0.06, z);
    group.add(t);
  }
  let palms = 0, guard = 0;
  while (palms < 120 && guard++ < 900) {
    const c = centres[rng.int(0, N - 1)];
    const along = rng.range(-256, 256);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = (ROADW / 2 + 1.6) * side;
    if (rng.chance(0.5)) addPalm(c + off, along); else addPalm(along, c + off);
    palms++;
  }

  /* ---- streetlights at intersections (emissive heads, no real lights) ---- */
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 4.8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a5058 });
  const headGeo = new THREE.BoxGeometry(1.5, 0.18, 0.5);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xffdf9e, emissiveIntensity: 0.25 });
  registerDay(headMat, 0.25, 1.8);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = centres[i] + ROADW / 2 + 0.9;
      const z = centres[j] + ROADW / 2 + 0.9;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2.4, z);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x - 0.5, 4.85, z);
      group.add(head);
    }
  }

  /* ---- beach + water + pier (south edge) ---- */
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(524, 98),
    new THREE.MeshLambertMaterial({ color: 0xe0c184 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.012, 237);
  sand.receiveShadow = true;
  group.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 260),
    new THREE.MeshPhongMaterial({ color: 0x1a6f9e, shininess: 140, specular: 0xbfe8ff, transparent: true, opacity: 0.93 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.25, 380);
  group.add(water);

  const woodTex = makeCanvas(64, 64, function (g, w, h) {
    g.fillStyle = '#9a7448'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d5c36';
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
  const pierMat = new THREE.MeshLambertMaterial({ map: woodTex });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 48), pierMat);
  pier.position.set(0, 0.35, 268);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.6, 6);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6e5230 });
  for (let pz = 248; pz <= 290; pz += 10.5) {
    for (let px = -2.6; px <= 2.6; px += 5.2) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, -0.2, pz);
      group.add(post);
    }
  }

  scene.add(group);
  return { group: group, colliders: colliders, bounds: bounds, roads: roads };
};
