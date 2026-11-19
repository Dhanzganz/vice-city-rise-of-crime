'use strict';
/* VICE CITY: Rise of Crime — player.js
 * VC.createPlayer(scene, city, input, engine): a low-poly figure with a
 * procedural walk cycle, WASD movement relative to the orbit camera,
 * sprint, jumping, circle-vs-AABB collision against the city's building
 * colliders, and a third-person orbit camera (wheel zoom, pointer look).
 * setCameraOverride(fn) hands the camera to menus / shot modes. */
window.VC = window.VC || {};

VC.createPlayer = function (scene, city, input, engine) {
  /* ---- figure (origin at the feet, faces +Z at heading 0) ---- */
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b4c7e });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x00b8a9 });

  function part(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || group).add(m);
    return m;
  }
  /* Legs pivot at the hip (y 0.85). */
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.17 * side, 0.85, 0);
    group.add(hip);
    part(new THREE.BoxGeometry(0.32, 0.82, 0.36), pants, 0, -0.41, 0, hip);
    return hip;
  }
  const legL = makeLeg(-1), legR = makeLeg(1);
  part(new THREE.BoxGeometry(0.78, 0.82, 0.44), shirt, 0, 1.28, 0);            // torso
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(0.5 * side, 1.64, 0);
    group.add(sh);
    part(new THREE.BoxGeometry(0.24, 0.74, 0.28), skin, 0, -0.35, 0, sh);
    return sh;
  }
  const armL = makeArm(-1), armR = makeArm(1);
  part(new THREE.BoxGeometry(0.42, 0.44, 0.42), skin, 0, 1.93, 0);             // head
  part(new THREE.BoxGeometry(0.5, 0.13, 0.5), capMat, 0, 2.18, 0);             // cap top
  part(new THREE.BoxGeometry(0.46, 0.07, 0.34), capMat, 0, 2.13, 0.38);        // cap brim
  group.scale.setScalar(0.92);
  scene.add(group);

  /* ---- state ---- */
  const RADIUS = 0.7;
  let x = 0, z = 156, y = 0;
  let vy = 0, grounded = true;
  let heading = Math.PI;               // face -Z, into the city
  let yaw = 0, pitch = 0.18, dist = 7.5;
  let camOverride = null;
  let walkPhase = 0, idleTime = 0;

  const colliders = (city && city.colliders) || [];
  const bounds = (city && city.bounds) || { minX: -262, maxX: 262, minZ: -262, maxZ: 286 };

  function collideAxis(axis) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz >= RADIUS * RADIUS) continue;
      if (axis === 'x') {
        x = x < (c.minX + c.maxX) / 2 ? c.minX - RADIUS : c.maxX + RADIUS;
      } else {
        z = z < (c.minZ + c.maxZ) / 2 ? c.minZ - RADIUS : c.maxZ + RADIUS;
      }
    }
  }

  function angleLerp(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * Math.min(1, t);
  }

  function update(dt) {
    if (dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05;

    /* look + zoom */
    const look = input.takeLook();
    yaw -= look.dx * 0.0032;
    pitch += look.dy * 0.0028;
    pitch = Math.max(-0.05, Math.min(0.9, pitch));
    dist += input.takeWheel() * 0.01;
    dist = Math.max(4, Math.min(11, dist));

    /* wish direction on the ground, relative to the camera */
    const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    let mx = 0, mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) { mx += f.x; mz += f.z; }
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) { mx -= f.x; mz -= f.z; }
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) { mx += r.x; mz += r.z; }
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) { mx -= r.x; mz -= r.z; }
    const len = Math.sqrt(mx * mx + mz * mz);
    const moving = len > 0.01;
    if (moving) { mx /= len; mz /= len; }

    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? 12 : 7;

    if (moving) {
      x += mx * speed * dt;
      collideAxis('x');
      z += mz * speed * dt;
      collideAxis('z');
      heading = angleLerp(heading, Math.atan2(mx, mz), 12 * dt);
      walkPhase += dt * speed * 1.55;
    }
    x = Math.max(bounds.minX + RADIUS, Math.min(bounds.maxX - RADIUS, x));
    z = Math.max(bounds.minZ + RADIUS, Math.min(bounds.maxZ - RADIUS, z));

    /* jump / gravity */
    if (grounded && input.isDown('Space')) {
      vy = 8.4;
      grounded = false;
    }
    if (!grounded) {
      vy -= 22 * dt;
      y += vy * dt;
      if (y <= 0) { y = 0; vy = 0; grounded = true; }
    }

    group.position.set(x, y, z);
    group.rotation.y = heading;

    /* ---- animate the figure ---- */
    if (!grounded) {
      legL.rotation.x = 0.55; legR.rotation.x = -0.4;
      armL.rotation.x = -0.7; armR.rotation.x = -0.7;
    } else if (moving) {
      const s = Math.sin(walkPhase);
      legL.rotation.x = s * 0.65;
      legR.rotation.x = -s * 0.65;
      armL.rotation.x = -s * 0.55;
      armR.rotation.x = s * 0.55;
      idleTime = 0;
    } else {
      idleTime += dt;
      const b = Math.sin(idleTime * 2.1) * 0.045;
      legL.rotation.x = 0; legR.rotation.x = 0;
      armL.rotation.x = b; armR.rotation.x = -b;
    }

    /* ---- camera ---- */
    const camera = engine && engine.camera;
    if (camera) {
      if (camOverride) {
        camOverride(camera, dt);
      } else {
        const cx = x + Math.sin(yaw) * Math.cos(pitch) * dist;
        const cz = z + Math.cos(yaw) * Math.cos(pitch) * dist;
        const cy = y + 2.2 + Math.sin(pitch) * dist;
        camera.position.set(cx, Math.max(0.6, cy), cz);
        camera.lookAt(x, y + 1.6, z);
      }
    }
  }

  return {
    group: group,
    position: group.position,
    update: update,
    teleport: function (tx, tz) {
      x = tx; z = tz; y = 0; vy = 0; grounded = true;
      group.position.set(x, 0, z);
    },
    setCameraOverride: function (fn) { camOverride = fn || null; }
  };
};
