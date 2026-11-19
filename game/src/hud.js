'use strict';
/* VICE CITY: Rise of Crime — HUD (chunk C1).
   VC.createHUD(state): DOM overlay — cash + health (top-left), wanted
   stars (top-right), ammo + speed (bottom-right), minimap (bottom-left),
   a queued centre banner and BUSTED/WASTED overlays. The initial state
   is painted synchronously at creation so headless captures are real. */
(function () {
  window.VC = window.VC || {};

  var WORLD = { minX: -262, maxX: 262, minZ: -262, maxZ: 286 };
  var MAP = 176;

  function createHUD(state) {
    var FONT = "'Arial Black', 'Segoe UI', Arial, sans-serif";

    var root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;' +
      'font-family:' + FONT + ';color:#fff;overflow:hidden;';
    document.body.appendChild(root);

    function box(css) {
      var el = document.createElement('div');
      el.style.cssText = css;
      root.appendChild(el);
      return el;
    }

    /* top-left: cash + health */
    var cashEl = box('position:absolute;top:14px;left:16px;font-size:26px;' +
      'color:#7be495;text-shadow:2px 2px 0 rgba(0,0,0,.55);letter-spacing:1px;');
    var healthOuter = box('position:absolute;top:52px;left:16px;width:180px;height:14px;' +
      'background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.65);border-radius:3px;');
    var healthInner = document.createElement('div');
    healthInner.style.cssText = 'height:100%;width:100%;background:#3ae03a;border-radius:2px;';
    healthOuter.appendChild(healthInner);

    /* top-right: wanted stars */
    var starsEl = box('position:absolute;top:12px;right:16px;font-size:30px;' +
      'text-shadow:2px 2px 0 rgba(0,0,0,.55);letter-spacing:3px;');
    var starSpans = [];
    for (var s = 0; s < 5; s++) {
      var sp = document.createElement('span');
      sp.textContent = '★';
      sp.style.color = 'rgba(255,255,255,.28)';
      starsEl.appendChild(sp);
      starSpans.push(sp);
    }

    /* bottom-right: ammo + speed */
    var ammoEl = box('position:absolute;right:16px;bottom:16px;font-size:24px;text-align:right;' +
      'text-shadow:2px 2px 0 rgba(0,0,0,.55);');
    var speedEl = box('position:absolute;right:16px;bottom:52px;font-size:18px;text-align:right;' +
      'color:#ffd76a;text-shadow:2px 2px 0 rgba(0,0,0,.55);');

    /* bottom-left: minimap */
    var mapCanvas = document.createElement('canvas');
    mapCanvas.width = MAP; mapCanvas.height = MAP;
    mapCanvas.style.cssText = 'position:absolute;left:16px;bottom:16px;width:176px;height:176px;' +
      'border:2px solid rgba(255,255,255,.65);border-radius:4px;background:#20242c;';
    root.appendChild(mapCanvas);
    var mctx = mapCanvas.getContext('2d');

    /* centre banner */
    var bannerEl = box('position:absolute;left:50%;top:16%;transform:translateX(-50%);' +
      'text-align:center;opacity:0;transition:opacity .25s ease;max-width:80%;');
    var bannerTitle = document.createElement('div');
    bannerTitle.style.cssText = 'font-size:34px;color:#ffd76a;text-shadow:3px 3px 0 rgba(0,0,0,.6);letter-spacing:1px;';
    var bannerSub = document.createElement('div');
    bannerSub.style.cssText = 'font-size:17px;color:#fff;text-shadow:2px 2px 0 rgba(0,0,0,.6);margin-top:4px;';
    bannerEl.appendChild(bannerTitle);
    bannerEl.appendChild(bannerSub);

    /* centre overlay (BUSTED / WASTED) */
    var overlayEl = box('position:absolute;left:50%;top:38%;transform:translateX(-50%);' +
      'font-size:64px;letter-spacing:6px;display:none;text-shadow:4px 4px 0 rgba(0,0,0,.65);');

    /* ---------------- banner queue ---------------- */
    var queue = [];
    var current = null; // {title, sub, ms, phase, t}
    function banner(title, sub, ms) {
      queue.push({ title: title, sub: sub || '', ms: ms || 2600 });
    }
    function stepBanner(dt) {
      if (!current) {
        if (queue.length === 0) { bannerEl.style.opacity = '0'; return; }
        current = queue.shift();
        current.phase = 'in'; current.t = 0;
        bannerTitle.textContent = current.title;
        bannerSub.textContent = current.sub;
      }
      current.t += dt;
      if (current.phase === 'in') {
        bannerEl.style.opacity = '1';
        if (current.t > 0.25) { current.phase = 'hold'; current.t = 0; }
      } else if (current.phase === 'hold') {
        if (current.t * 1000 > current.ms) { current.phase = 'out'; current.t = 0; }
      } else if (current.phase === 'out') {
        bannerEl.style.opacity = '0';
        if (current.t > 0.3) current = null;
      }
    }

    /* ---------------- overlay ---------------- */
    var overlayT = 0;
    function showOverlay(kind) {
      if (kind === 'busted') { overlayEl.textContent = 'BUSTED'; overlayEl.style.color = '#5aa2ff'; }
      else { overlayEl.textContent = 'WASTED'; overlayEl.style.color = '#ff5147'; }
      overlayEl.style.display = 'block';
      overlayT = 2.5;
    }
    function hideOverlay() {
      overlayEl.style.display = 'none';
      overlayT = 0;
    }

    /* ---------------- minimap ---------------- */
    function mapX(x) { return (x - WORLD.minX) / (WORLD.maxX - WORLD.minX) * MAP; }
    function mapY(z) { return (z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ) * MAP; }

    function drawMinimap() {
      var G = window.VC.game || null;
      mctx.fillStyle = '#c2a878'; // sand / city base
      mctx.fillRect(0, 0, MAP, MAP);
      // water strip at the south edge (beach side, high z)
      mctx.fillStyle = '#3f7fbf';
      mctx.fillRect(0, mapY(262), MAP, MAP - mapY(262));

      // road bands
      mctx.fillStyle = '#4a4f58';
      var roadPxX = 12 / (WORLD.maxX - WORLD.minX) * MAP;
      var roadPxY = 12 / (WORLD.maxZ - WORLD.minZ) * MAP;
      for (var i = 0; i < 9; i++) {
        var c = -234 + 52 * i;
        mctx.fillRect(mapX(c) - roadPxX / 2, 0, roadPxX, MAP);
        mctx.fillRect(0, mapY(c) - roadPxY / 2, MAP, roadPxY);
      }

      // mission marker (gold)
      if (G && G.mission && G.mission.marker) {
        mctx.fillStyle = '#ffd700';
        mctx.beginPath();
        mctx.arc(mapX(G.mission.marker.x), mapY(G.mission.marker.z), 4.5, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = 'rgba(0,0,0,.6)';
        mctx.stroke();
      }

      // police blips (red)
      if (G && G.police && G.police.units) {
        mctx.fillStyle = '#ff3b30';
        for (var u = 0; u < G.police.units.length; u++) {
          var unit = G.police.units[u];
          if (!unit || !unit.group) continue;
          mctx.beginPath();
          mctx.arc(mapX(unit.group.position.x), mapY(unit.group.position.z), 3, 0, Math.PI * 2);
          mctx.fill();
        }
      }

      // player arrow (white)
      var pp = null, heading = 0;
      if (G && G.vehicles && G.vehicles.playerCar) {
        pp = G.vehicles.playerCar.group.position;
        heading = G.vehicles.playerCar.heading;
      } else if (G && G.player && G.player.group) {
        pp = G.player.group.position;
        heading = G.player.group.rotation.y;
      }
      if (pp) {
        mctx.save();
        mctx.translate(mapX(pp.x), mapY(pp.z));
        mctx.rotate(Math.PI - heading);
        mctx.fillStyle = '#ffffff';
        mctx.strokeStyle = 'rgba(0,0,0,.7)';
        mctx.beginPath();
        mctx.moveTo(0, -6);
        mctx.lineTo(4.4, 5);
        mctx.lineTo(0, 2.6);
        mctx.lineTo(-4.4, 5);
        mctx.closePath();
        mctx.fill();
        mctx.stroke();
        mctx.restore();
      }
    }

    /* ---------------- refresh ---------------- */
    function refresh(dt) {
      cashEl.textContent = '$' + state.cash;
      var h = Math.max(0, Math.min(100, state.health));
      healthInner.style.width = h + '%';
      healthInner.style.background = 'hsl(' + Math.round(h * 1.2) + ',80%,45%)';

      var filled = Math.max(0, Math.min(5, Math.ceil(state.wanted)));
      for (var i = 0; i < 5; i++) {
        starSpans[i].style.color = i < filled ? '#ffd700' : 'rgba(255,255,255,.28)';
      }

      ammoEl.textContent = state.ammo + ' / ' + state.reserveAmmo;

      var G = window.VC.game || null;
      if (G && G.driving && G.vehicles && G.vehicles.playerCar) {
        speedEl.textContent = Math.round(Math.abs(G.vehicles.playerCar.speed) * 3.6) + ' KM/H';
        speedEl.style.display = 'block';
      } else {
        speedEl.style.display = 'none';
      }

      drawMinimap();
      stepBanner(dt || 0);
      if (overlayT > 0) {
        overlayT -= dt || 0;
        if (overlayT <= 0) overlayEl.style.display = 'none';
      }
    }

    function update(dt) { refresh(dt); }

    refresh(0); // synchronous initial paint

    return {
      update: update,
      banner: banner,
      showOverlay: showOverlay,
      hideOverlay: hideOverlay
    };
  }

  window.VC.createHUD = createHUD;
})();
