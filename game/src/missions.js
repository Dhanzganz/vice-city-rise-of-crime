// VICE CITY: Rise of Crime — missions.js
// VC.createMissions(scene, state, player, vehicles, hud, audio)
// Fixer MARCO's three-favour chain, marked by a glowing gold beacon:
//   M1 First Favour — docks pickup, deliver to the garage.
//   M2 Hot Wheels   — steal the gold car, deliver it to the garage.
//   M3 Last Run     — garage pickup, escape to the pier while wanted.
window.VC = window.VC || {};

VC.createMissions = function (scene, state, player, vehicles, hud, audio) {
  'use strict';

  var DOCKS = { x: 182, z: 234 };
  var GARAGE = { x: 26, z: -26 };
  var GOLD_CAR_POS = { x: 71, z: 73 };
  var PIER = { x: 0, z: 244 };

  // --- marker: gold beacon cylinder + floating "!" sprite ----------------
  var markerGroup = new THREE.Group();
  var beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc933, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    })
  );
  beam.position.y = 13;
  markerGroup.add(beam);
  var ring = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.25, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc933, transparent: true, opacity: 0.7 })
  );
  ring.position.y = 0.15;
  markerGroup.add(ring);

  var cnv = document.createElement('canvas');
  cnv.width = 64; cnv.height = 64;
  var ctx = cnv.getContext('2d');
  ctx.font = '900 52px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('!', 32, 34);
  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cnv), transparent: true, depthTest: false
  }));
  sprite.scale.set(2.4, 2.4, 1);
  sprite.position.y = 5;
  markerGroup.add(sprite);
  scene.add(markerGroup);

  // --- the gold car for M2 ----------------------------------------------
  var goldCar = new THREE.Group();
  (function buildGoldCar() {
    var gold = new THREE.MeshLambertMaterial({ color: 0xd8a920, emissive: 0x332200 });
    var dark = new THREE.MeshLambertMaterial({ color: 0x181818 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.4), gold);
    body.position.y = 0.55;
    goldCar.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.0), dark);
    cabin.position.set(0, 1.05, -0.1);
    goldCar.add(cabin);
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    var wx = [-0.95, 0.95], wz = [-1.45, 1.45];
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 2; j++) {
        var w = new THREE.Mesh(wheelGeo, dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx[i], 0.36, wz[j]);
        goldCar.add(w);
      }
    }
  })();
  goldCar.position.set(GOLD_CAR_POS.x, 0, GOLD_CAR_POS.z);
  goldCar.rotation.y = 0.5;
  goldCar.visible = false;
  scene.add(goldCar);

  // --- chain state --------------------------------------------------------
  // stage: 'm1pickup' | 'm1deliver' | 'm2steal' | 'm2deliver' |
  //        'm3pickup' | 'm3escape' | 'done'
  var stage = 'm1pickup';
  var markerPos = { x: DOCKS.x, z: DOCKS.z };
  var bobPhase = 0;

  function banner(title, sub) {
    if (hud && typeof hud.banner === 'function') hud.banner(title, sub, 4200);
  }
  function objective() {
    switch (stage) {
      case 'm1pickup': return { title: 'FIRST FAVOUR', sub: 'Marco: pick up the package at the docks.', at: DOCKS };
      case 'm1deliver': return { title: 'FIRST FAVOUR', sub: 'Deliver the package to the garage.', at: GARAGE };
      case 'm2steal': return { title: 'HOT WHEELS', sub: 'Steal the gold car. Marco wants it intact.', at: GOLD_CAR_POS };
      case 'm2deliver': return { title: 'HOT WHEELS', sub: 'Bring the gold car to the garage.', at: GARAGE };
      case 'm3pickup': return { title: 'LAST RUN', sub: 'Pick up the cargo at the garage.', at: GARAGE };
      case 'm3escape': return { title: 'LAST RUN', sub: 'Lose the heat — escape to the pier!', at: PIER };
      default: return null;
    }
  }
  function syncMarker() {
    var o = objective();
    if (o) {
      markerPos = { x: o.at.x, z: o.at.z };
      markerGroup.visible = true;
      markerGroup.position.set(o.at.x, 0, o.at.z);
    } else {
      markerGroup.visible = false;
    }
  }
  function announce() {
    var o = objective();
    if (o) banner(o.title, o.sub);
    syncMarker();
  }
  function complete(reward, nextStage) {
    state.addCash(reward);
    if (audio) audio.pickup();
    banner('Mission complete', '+$' + reward.toLocaleString('en-US'));
    stage = nextStage;
    if (stage === 'done') {
      syncMarker();
      banner('All favours done', 'Vice City is yours.');
    } else {
      announce();
    }
  }
  function playerPos() {
    var game = window.VC.game;
    if (game && game.driving && vehicles && vehicles.playerCar) {
      return vehicles.playerCar.group.position;
    }
    return player.position;
  }
  function near(x, z, r) {
    var p = playerPos();
    var dx = p.x - x, dz = p.z - z;
    return (dx * dx + dz * dz) <= r * r;
  }

  announce(); // M1 stage A banner at creation

  var missions = {
    marker: markerPos,

    update: function (dt) {
      bobPhase += dt * 2.2;
      sprite.position.y = 5 + Math.sin(bobPhase) * 0.5;
      beam.rotation.y += dt * 0.6;

      switch (stage) {
        case 'm1pickup':
          if (near(DOCKS.x, DOCKS.z, 4)) { stage = 'm1deliver'; announce(); }
          break;
        case 'm1deliver':
          if (near(GARAGE.x, GARAGE.z, 4)) complete(400, 'm2steal');
          break;
        case 'm2steal':
          goldCar.visible = true;
          if (near(GOLD_CAR_POS.x, GOLD_CAR_POS.z, 3.5)) {
            goldCar.visible = false;
            state.wanted = Math.max(state.wanted || 0, 2);
            banner('HOT WHEELS', 'That got attention — get it to the garage!');
            stage = 'm2deliver';
            syncMarker();
          }
          break;
        case 'm2deliver':
          if (near(GARAGE.x, GARAGE.z, 4)) complete(750, 'm3pickup');
          break;
        case 'm3pickup':
          if (near(GARAGE.x, GARAGE.z, 4)) {
            state.wanted = 3;
            stage = 'm3escape';
            announce();
          }
          break;
        case 'm3escape':
          if (near(PIER.x, PIER.z, 4)) complete(1200, 'done');
          break;
      }

      var o = objective();
      missions.marker = o ? { x: o.at.x, z: o.at.z } : null;
    },

    notifyBusted: function () {
      if (stage === 'm3escape') {
        stage = 'm3pickup';
        banner('The run fell apart', 'Pick up again at the garage.');
        syncMarker();
      }
    },

    stageShotMission: function () {
      stage = 'm1pickup';
      syncMarker();
      player.teleport(170, 222);
      if (typeof player.setCameraOverride === 'function') {
        player.setCameraOverride(function (camera) {
          camera.position.set(158, 7, 208);
          camera.lookAt(DOCKS.x, 3, DOCKS.z);
        });
      }
    }
  };

  Object.defineProperty(missions, 'index', {
    get: function () {
      switch (stage) {
        case 'm1pickup': case 'm1deliver': return 0;
        case 'm2steal': case 'm2deliver': return 1;
        case 'm3pickup': case 'm3escape': return 2;
        default: return 3;
      }
    }
  });

  return missions;
};
