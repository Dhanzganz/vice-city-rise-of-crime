// VICE CITY: Rise of Crime — combat.js
// VC.createCombat(scene, state, player, npcs, audio)
// Q arms/disarms a handgun shown in the player's hand. Mouse fire is a
// centre-screen hitscan; F punches. Hits on pedestrians are crimes and
// panic the crowd; R reloads from the reserve pool.
window.VC = window.VC || {};

VC.createCombat = function (scene, state, player, npcs, audio) {
  'use strict';

  var armed = false;
  var flashTime = 0;
  var reloading = false;

  // Gun: a small dark box parented to the player figure.
  var gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x151515 })
  );
  gun.position.set(0.45, 1.05, 0.35);
  gun.visible = false;
  player.group.add(gun);

  // Muzzle flash light, intensity spikes on fire and decays in update().
  var flash = new THREE.PointLight(0xffc266, 0, 18);
  scene.add(flash);

  function rayFromCamera() {
    var game = window.VC.game;
    var cam = game && game.engine ? game.engine.camera : null;
    if (!cam) return null;
    var dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    return { origin: cam.position.clone(), dir: dir };
  }

  // Distance from point p to ray; also returns the along-ray distance.
  function rayHit(origin, dir, p) {
    var ox = p.x - origin.x, oy = p.y - origin.y, oz = p.z - origin.z;
    var t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0) return null;
    var cx = origin.x + dir.x * t, cy = origin.y + dir.y * t, cz = origin.z + dir.z * t;
    var dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { t: t, dist: d };
  }

  function pedPoint(ped) {
    var p = ped.group.position;
    return { x: p.x, y: p.y + 1.0, z: p.z };
  }

  function downPed(ped) {
    ped.mode = 'down';
    ped.timer = 6;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.25;
  }

  var combat = {
    update: function (dt) {
      if (flashTime > 0) {
        flashTime -= dt;
        flash.intensity = Math.max(0, flashTime * 14);
      } else {
        flash.intensity = 0;
      }
      // Reload on KeyR held.
      var game = window.VC.game;
      var keys = game && game.input ? game.input.keys : null;
      if (keys && keys['KeyR'] && state.reserveAmmo > 0 && state.ammo < 60) {
        if (!reloading) {
          reloading = true;
          var move = Math.min(60 - state.ammo, state.reserveAmmo);
          state.ammo += move;
          state.reserveAmmo -= move;
          if (audio) audio.blip();
        }
      } else {
        reloading = false;
      }
    },

    toggleArmed: function () {
      armed = !armed;
      gun.visible = armed;
      if (audio) audio.blip();
    },

    fire: function () {
      if (!armed || state.ammo <= 0) return;
      state.ammo--;
      if (audio) audio.shot();
      var ray = rayFromCamera();
      if (!ray) return;

      // Muzzle flash at the gun's world position.
      var gp = new THREE.Vector3();
      gun.getWorldPosition(gp);
      flash.position.copy(gp);
      flashTime = 0.07;
      flash.intensity = 1;

      var best = null, bestT = Infinity;
      var peds = npcs.peds || [];
      for (var i = 0; i < peds.length; i++) {
        if (peds[i].mode === 'down') continue;
        var hit = rayHit(ray.origin, ray.dir, pedPoint(peds[i]));
        if (hit && hit.dist < 1.2 && hit.t < 60 && hit.t < bestT) {
          best = peds[i];
          bestT = hit.t;
        }
      }
      if (best) {
        var ip = best.group.position;
        downPed(best);
        state.kills = (state.kills || 0) + 1;
        state.commitCrime(2, 'shooting');
        npcs.panicAt(ip.x, ip.z, 12);
      } else {
        var ix = ray.origin.x + ray.dir.x * 60;
        var iz = ray.origin.z + ray.dir.z * 60;
        npcs.panicAt(ix, iz, 8);
      }
    },

    punch: function () {
      var pp = player.position;
      var peds = npcs.peds || [];
      var heading = player.group.rotation.y;
      var fx = Math.sin(heading), fz = Math.cos(heading);
      for (var i = 0; i < peds.length; i++) {
        if (peds[i].mode === 'down') continue;
        var p = peds[i].group.position;
        var dx = p.x - pp.x, dz = p.z - pp.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 2.3) {
          var dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
          if (dot > 0.2 || d < 0.9) {
            downPed(peds[i]);
            state.commitCrime(1, 'assault');
            if (audio) audio.punch();
            npcs.panicAt(p.x, p.z, 6);
            return;
          }
        }
      }
    }
  };

  Object.defineProperty(combat, 'armed', {
    get: function () { return armed; }
  });

  return combat;
};
