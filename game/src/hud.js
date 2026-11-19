// VICE CITY: Rise of Crime — HUD.
// Minimap, wanted stars, health, cash, ammo/speed, mission banners and
// the BUSTED / WASTED overlay. All HUD styling lives in the CSS string
// injected below, so index.html only needs the script tag.
window.VC = window.VC || {};

VC.createHUD = function (state) {
  var CSS = [
    '#title,#hint{display:none;}', // legacy overlays make room for the HUD
    '#vc-hud{position:fixed;inset:0;z-index:10;pointer-events:none;',
    'font-family:"Segoe UI",Arial,sans-serif;color:#fff;}',
    '#vc-map{position:absolute;top:16px;left:16px;width:176px;height:176px;',
    'border:2px solid rgba(255,255,255,0.35);border-radius:10px;',
    'background:#0b1020;box-shadow:0 4px 18px rgba(0,0,0,0.5);}',
    '#vc-stars{position:absolute;top:14px;right:20px;font-size:30px;',
    'letter-spacing:4px;text-shadow:0 2px 6px rgba(0,0,0,0.8);}',
    '#vc-stars .on{color:#ffd93c;}#vc-stars .off{color:rgba(255,255,255,0.28);}',
    '#vc-bl{position:absolute;left:16px;bottom:16px;width:230px;}',
    '#vc-healthwrap{height:14px;background:rgba(0,0,0,0.55);',
    'border:1px solid rgba(255,255,255,0.4);border-radius:7px;overflow:hidden;}',
    '#vc-health{height:100%;width:100%;background:#3ddc5a;',
    'transition:width .18s ease,background .18s ease;}',
    '#vc-cash{margin-top:7px;font-size:24px;font-weight:800;letter-spacing:1px;',
    'color:#7dff8a;text-shadow:0 2px 5px rgba(0,0,0,0.85);}',
    '#vc-cashpop{font-size:16px;font-weight:700;color:#ffe66d;opacity:0;',
    'margin-left:8px;text-shadow:0 1px 4px rgba(0,0,0,0.8);}',
    '#vc-br{position:absolute;right:20px;bottom:16px;text-align:right;}',
    '#vc-ammo{font-size:26px;font-weight:800;letter-spacing:1px;',
    'text-shadow:0 2px 5px rgba(0,0,0,0.85);}',
    '#vc-ammo .res{font-size:16px;color:rgba(255,255,255,0.65);font-weight:600;}',
    '#vc-speed{font-size:15px;font-weight:700;color:#aee7ff;letter-spacing:2px;',
    'text-shadow:0 1px 4px rgba(0,0,0,0.8);min-height:18px;}',
    '#vc-banner{position:absolute;top:64px;left:50%;transform:translateX(-50%);',
    'text-align:center;opacity:0;transition:opacity .35s ease;max-width:72vw;}',
    '#vc-banner .t{font-size:27px;font-weight:800;letter-spacing:3px;',
    'color:#ffd93c;text-shadow:0 2px 8px rgba(0,0,0,0.9);}',
    '#vc-banner .s{font-size:16px;font-weight:600;color:#fff;margin-top:3px;',
    'text-shadow:0 1px 5px rgba(0,0,0,0.9);}',
    '#vc-overlay{position:absolute;inset:0;display:none;align-items:center;',
    'justify-content:center;flex-direction:column;',
    'background:rgba(5,5,12,0.45);}',
    '#vc-overlay .big{font-size:84px;font-weight:900;letter-spacing:14px;',
    'text-shadow:0 4px 24px rgba(0,0,0,0.9);}',
    '#vc-overlay .sub{font-size:19px;font-weight:600;letter-spacing:2px;',
    'color:#f2f2f2;text-shadow:0 2px 6px rgba(0,0,0,0.9);margin-top:6px;}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'vc-hud';
  root.innerHTML =
    '<canvas id="vc-map" width="176" height="176"></canvas>' +
    '<div id="vc-stars"></div>' +
    '<div id="vc-bl"><div id="vc-healthwrap"><div id="vc-health"></div></div>' +
    '<div><span id="vc-cash"></span><span id="vc-cashpop"></span></div></div>' +
    '<div id="vc-br"><div id="vc-speed"></div><div id="vc-ammo"></div></div>' +
    '<div id="vc-banner"><div class="t"></div><div class="s"></div></div>' +
    '<div id="vc-overlay"><div class="big"></div><div class="sub"></div></div>';
  document.body.appendChild(root);

  var mapCtx = root.querySelector('#vc-map').getContext('2d');
  var starsEl = root.querySelector('#vc-stars');
  var healthEl = root.querySelector('#vc-health');
  var cashEl = root.querySelector('#vc-cash');
  var popEl = root.querySelector('#vc-cashpop');
  var ammoEl = root.querySelector('#vc-ammo');
  var speedEl = root.querySelector('#vc-speed');
  var bannerEl = root.querySelector('#vc-banner');
  var overlayEl = root.querySelector('#vc-overlay');

  var popUntil = 0;
  var bannerUntil = 0;
  var domTimer = 0; // refresh on the very first update

  state.on('cash', function (d) {
    if (!d || !d.amount) return;
    popEl.textContent = (d.amount > 0 ? '+$' : '-$') + Math.abs(d.amount).toLocaleString('en-US');
    popEl.style.opacity = '1';
    popUntil = performance.now() + 1400;
  });

  function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  function refreshDOM(now) {
    var w = Math.max(0, Math.min(5, Math.ceil(state.wanted || 0)));
    var html = '';
    for (var i = 0; i < 5; i++) html += '<span class="' + (i < w ? 'on' : 'off') + '">★</span>';
    starsEl.innerHTML = html;

    var frac = state.maxHealth > 0 ? state.health / state.maxHealth : 0;
    healthEl.style.width = (frac * 100).toFixed(1) + '%';
    healthEl.style.background = 'hsl(' + Math.round(frac * 120) + ',80%,45%)';

    cashEl.textContent = fmtCash(state.cash);
    if (now > popUntil) popEl.style.opacity = '0';

    // ammo = rounds ready / reserve (state.ammo is the ready count)
    ammoEl.innerHTML = state.ammo + ' <span class="res">/ ' + state.reserveAmmo + '</span>';

    var g = VC.game;
    if (g && g.driving && g.vehicles && g.vehicles.playerCar) {
      speedEl.textContent = Math.round(Math.abs(g.vehicles.playerCar.speed) * 2.2) + ' MPH';
    } else {
      speedEl.textContent = '';
    }

    if (now > bannerUntil) bannerEl.style.opacity = '0';
  }

  function drawMap(now) {
    var g = VC.game;
    if (!g || !g.city) return;
    var b = g.city.bounds;
    var roads = g.city.roads;
    var W = 176, H = 176;
    function mx(x) { return (x - b.minX) / (b.maxX - b.minX) * W; }
    function mz(z) { return (z - b.minZ) / (b.maxZ - b.minZ) * H; }

    mapCtx.fillStyle = '#121a2e';
    mapCtx.fillRect(0, 0, W, H);

    // beach sand strip along the south edge of the bounds
    var sandTop = mz(b.maxZ - 102);
    mapCtx.fillStyle = '#c2a878';
    mapCtx.fillRect(0, sandTop, W, H - sandTop);

    // road grid
    mapCtx.strokeStyle = '#46536e';
    mapCtx.lineWidth = Math.max(2, roads.roadW / (b.maxX - b.minX) * W);
    mapCtx.beginPath();
    for (var i = 0; i < roads.n; i++) {
      var c = -234 + roads.block * i;
      mapCtx.moveTo(mx(c), 0); mapCtx.lineTo(mx(c), H);
      mapCtx.moveTo(0, mz(c)); mapCtx.lineTo(W, mz(c));
    }
    mapCtx.stroke();

    // traffic cars
    if (g.vehicles && g.vehicles.cars) {
      mapCtx.fillStyle = '#9aa5b8';
      for (var ci = 0; ci < g.vehicles.cars.length; ci++) {
        var cp = g.vehicles.cars[ci].group.position;
        mapCtx.fillRect(mx(cp.x) - 1.5, mz(cp.z) - 1.5, 3, 3);
      }
    }

    // pedestrians
    if (g.npcs && g.npcs.peds) {
      mapCtx.fillStyle = 'rgba(255,255,255,0.4)';
      for (var pi = 0; pi < g.npcs.peds.length; pi++) {
        var pp = g.npcs.peds[pi].fig.group.position;
        mapCtx.fillRect(mx(pp.x) - 1, mz(pp.z) - 1, 2, 2);
      }
    }

    // police blips (later chunk): flash red/blue
    if (g.police && g.police.units) {
      var flash = Math.floor(now / 300) % 2 === 0;
      mapCtx.fillStyle = flash ? '#ff3b30' : '#3b82f6';
      for (var ui = 0; ui < g.police.units.length; ui++) {
        var u = g.police.units[ui];
        var up = (u.group || u).position;
        if (!up) continue;
        mapCtx.beginPath();
        mapCtx.arc(mx(up.x), mz(up.z), 3, 0, 6.2832);
        mapCtx.fill();
      }
    }

    // mission marker (later chunk)
    if (g.mission && g.mission.marker) {
      mapCtx.fillStyle = '#ffd93c';
      mapCtx.beginPath();
      mapCtx.arc(mx(g.mission.marker.x), mz(g.mission.marker.z), 3.5, 0, 6.2832);
      mapCtx.fill();
    }

    // player arrow
    var pos = null, heading = 0;
    if (g.driving && g.vehicles && g.vehicles.playerCar) {
      pos = g.vehicles.playerCar.group.position;
      heading = g.vehicles.playerCar.heading || 0;
    } else if (g.player) {
      pos = g.player.position;
      heading = g.player.group ? g.player.group.rotation.y : 0;
    }
    if (pos) {
      var px = mx(pos.x), py = mz(pos.z);
      mapCtx.save();
      mapCtx.translate(px, py);
      mapCtx.rotate(Math.PI - heading);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 5); mapCtx.lineTo(0, 2.5); mapCtx.lineTo(-4, 5);
      mapCtx.closePath(); mapCtx.fill();
      mapCtx.restore();
    }
  }

  function banner(title, sub, ms) {
    bannerEl.querySelector('.t').textContent = title || '';
    bannerEl.querySelector('.s').textContent = sub || '';
    bannerEl.style.opacity = '1';
    bannerUntil = performance.now() + (ms || 3500);
  }

  function showOverlay(kind) {
    if (!kind) { overlayEl.style.display = 'none'; return; }
    var big = overlayEl.querySelector('.big');
    var sub = overlayEl.querySelector('.sub');
    if (kind === 'busted') {
      big.textContent = 'BUSTED';
      big.style.color = '#3b82f6';
      sub.textContent = 'The VCPD got you. Bail posted — stay out of trouble.';
    } else {
      big.textContent = 'WASTED';
      big.style.color = '#ff3b30';
      sub.textContent = 'You flatlined in Vice City. The hospital sends its bill.';
    }
    overlayEl.style.display = 'flex';
  }

  function update(dt) {
    var now = performance.now();
    domTimer -= dt;
    if (domTimer <= 0) { domTimer = 0.1; refreshDOM(now); }
    drawMap(now);
  }

  // Paint the initial state synchronously so the HUD is correct from
  // frame one (menus, screenshots) instead of after the first interval.
  refreshDOM(performance.now());

  return { update: update, banner: banner, showOverlay: showOverlay };
};
