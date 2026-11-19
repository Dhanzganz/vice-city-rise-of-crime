// VICE CITY: Rise of Crime — third-person character + orbit camera.
// Low-poly figure from boxes; WASD camera-relative movement, sprint, jump,
// circle-vs-AABB slide collision against the city's building colliders.
window.VC = window.VC || {};

VC.createPlayer = function (scene, colliders, camera) {
  var CORAL = 0xff6f61, SKIN = 0xe8b08a, DARK = 0x2b2f36, DENIM = 0x35507a;

  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  function limb(color, w, h, d, px, py) {
    var pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    var m = box(w, h, d, color, 0, -h / 2 + 0.06, 0);
    pivot.add(m);
    return pivot;
  }

  var group = new THREE.Group();
  var legL = limb(DENIM, 0.2, 0.88, 0.22, -0.14, 0.92);
  var legR = limb(DENIM, 0.2, 0.88, 0.22, 0.14, 0.92);
  var armL = limb(CORAL, 0.16, 0.72, 0.18, -0.42, 1.62);
  var armR = limb(CORAL, 0.16, 0.72, 0.18, 0.42, 1.62);
  group.add(legL); group.add(legR); group.add(armL); group.add(armR);
  group.add(box(0.64, 0.74, 0.3, CORAL, 0, 1.3, 0));       // torso
  group.add(box(0.34, 0.36, 0.32, SKIN, 0, 1.86, 0));      // head
  group.add(box(0.38, 0.12, 0.36, DARK, 0, 2.06, 0));      // hair cap
  group.scale.setScalar(0.95);
  scene.add(group);

  var pos = new THREE.Vector3(-26, 0, 40);
  var vy = 0, grounded = true;
  var yaw = 0.6, pitch = 0.34, dist = 8; // orbit camera state
  var facing = 0, phase = 0;
  var override = null;
  var camPos = new THREE.Vector3(30, 16, 70);
  var RADIUS = 0.55;

  function collide() {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      var nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      var dx = pos.x - nx, dz = pos.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-6) {
          var d = Math.sqrt(d2);
          pos.x = nx + dx / d * RADIUS;
          pos.z = nz + dz / d * RADIUS;
        } else {
          // centre inside the box: push out along the smallest penetration
          var pl = pos.x - c.minX, pr = c.maxX - pos.x;
          var pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
          var m = Math.min(pl, pr, pt, pb);
          if (m === pl) pos.x = c.minX - RADIUS;
          else if (m === pr) pos.x = c.maxX + RADIUS;
          else if (m === pt) pos.z = c.minZ - RADIUS;
          else pos.z = c.maxZ + RADIUS;
        }
      }
    }
  }

  var fwd = new THREE.Vector3(), target = new THREE.Vector3(), want = new THREE.Vector3();

  var player = {
    group: group,
    position: pos,
    teleport: function (x, z) { pos.set(x, 0, z); vy = 0; },
    setCameraOverride: function (fn) { override = fn; },
    update: function (dt, input) {
      // --- look ---
      yaw -= (input.lookDX || 0) * 0.0052;
      pitch += (input.lookDY || 0) * 0.004;
      pitch = Math.max(0.06, Math.min(1.05, pitch));
      dist *= 1 + (input.wheel || 0) * 0.0011;
      dist = Math.max(4, Math.min(14, dist));
      input.lookDX = 0; input.lookDY = 0; input.wheel = 0;

      // --- move (camera-relative) ---
      var ix = 0, iz = 0;
      if (input.pressed('KeyW') || input.pressed('ArrowUp')) iz -= 1;
      if (input.pressed('KeyS') || input.pressed('ArrowDown')) iz += 1;
      if (input.pressed('KeyA') || input.pressed('ArrowLeft')) ix -= 1;
      if (input.pressed('KeyD') || input.pressed('ArrowRight')) ix += 1;
      var moving = (ix !== 0 || iz !== 0);
      var sprint = input.pressed('ShiftLeft') || input.pressed('ShiftRight');
      var speed = sprint ? 10.5 : 6;
      if (moving) {
        var len = Math.hypot(ix, iz); ix /= len; iz /= len;
        var sin = Math.sin(yaw), cos = Math.cos(yaw);
        // camera forward on XZ is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw)
        var wx = ix * cos + iz * sin;
        var wz = -ix * sin + iz * cos;
        pos.x += wx * speed * dt;
        pos.z += wz * speed * dt;
        var wantFacing = Math.atan2(wx, wz);
        var diff = wantFacing - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        facing += diff * Math.min(1, dt * 12);
        phase += dt * speed * 1.55;
      }

      // --- jump / gravity ---
      if (grounded && input.pressed('Space')) { vy = 5.4; grounded = false; }
      if (!grounded) {
        pos.y += vy * dt;
        vy -= 15 * dt;
        if (pos.y <= 0) { pos.y = 0; vy = 0; grounded = true; }
      }

      collide();
      pos.x = Math.max(-400, Math.min(400, pos.x));
      pos.z = Math.max(-400, Math.min(430, pos.z));

      // --- animate ---
      var swing = moving ? Math.sin(phase) * 0.62 : 0;
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.85; armR.rotation.x = swing * 0.85;
      group.position.copy(pos);
      group.position.y = pos.y + (moving && grounded ? Math.abs(Math.sin(phase)) * 0.05 : 0);
      group.rotation.y = facing;

      // --- camera ---
      if (override) { override(camera, dt); return; }
      target.set(pos.x, pos.y + 1.7, pos.z);
      want.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        target.y + Math.sin(pitch) * dist,
        target.z + Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camPos.lerp(want, 1 - Math.exp(-9 * dt));
      camera.position.copy(camPos);
      camera.lookAt(target);
    }
  };
  group.position.copy(pos);
  return player;
};
