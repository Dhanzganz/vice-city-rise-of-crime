// VICE CITY: Rise of Crime — engine: renderer, lights, day cycle.
// Classic script on the VC namespace; Three.js r147 UMD is loaded before this file.
window.VC = window.VC || {};

VC.createEngine = function (canvas) {
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0xbfe3f5, 180, 900);

  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(30, 18, 60);

  var hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5f, 0.55);
  scene.add(hemi);

  var sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // Day keyframes: [hour, sky, fog, sunIntensity, sunColor, hemiIntensity]
  var STOPS = [
    [0.0,  0x0a0e24, 0x0a0e24, 0.10, 0x8fb2ff, 0.12],
    [5.0,  0x0a0e24, 0x0d1130, 0.10, 0x8fb2ff, 0.12],
    [6.5,  0xffb36b, 0xf7a56b, 0.50, 0xffb36b, 0.30],
    [9.0,  0x8ec9ee, 0xbfe3f5, 1.05, 0xfff3d6, 0.55],
    [13.0, 0x87bfe8, 0xbfe3f5, 1.15, 0xffffff, 0.60],
    [17.0, 0x93c4e8, 0xc4dff2, 0.95, 0xffe9c4, 0.50],
    [18.8, 0xff8a5f, 0xff9e7d, 0.55, 0xff7e47, 0.32],
    [20.0, 0x3b2d5c, 0x463a6b, 0.10, 0x8fb2ff, 0.16],
    [21.5, 0x0a0e24, 0x0d1130, 0.10, 0x8fb2ff, 0.12],
    [24.0, 0x0a0e24, 0x0a0e24, 0.10, 0x8fb2ff, 0.12]
  ];
  var skyA = new THREE.Color(), skyB = new THREE.Color();
  var fogA = new THREE.Color(), fogB = new THREE.Color();
  var sunA = new THREE.Color(), sunB = new THREE.Color();

  function lerpStops(hour) {
    var i = 0;
    while (i < STOPS.length - 2 && hour >= STOPS[i + 1][0]) i++;
    var a = STOPS[i], b = STOPS[i + 1];
    var f = Math.min(1, Math.max(0, (hour - a[0]) / (b[0] - a[0])));
    skyA.setHex(a[1]); skyB.setHex(b[1]); scene.background.copy(skyA).lerp(skyB, f);
    fogA.setHex(a[2]); fogB.setHex(b[2]); scene.fog.color.copy(fogA).lerp(fogB, f);
    sunA.setHex(a[4]); sunB.setHex(b[4]); sun.color.copy(sunA).lerp(sunB, f);
    sun.intensity = a[3] + (b[3] - a[3]) * f;
    hemi.intensity = a[5] + (b[5] - a[5]) * f;
  }

  function nightFactorFor(hour) {
    if (hour <= 5 || hour >= 20.5) return 1;
    if (hour >= 8.5 && hour <= 17.5) return 0;
    if (hour < 8.5) return 1 - (hour - 5) / 3.5;
    return (hour - 17.5) / 3;
  }

  var listeners = [];
  var time01 = 0.45; // start mid-morning
  var night = 0;

  function applyTime() {
    var hour = time01 * 24;
    lerpStops(hour);
    // Sun path: rises in the east (+X), sets in the west (-X), slight southern tilt.
    var ang = ((hour - 6) / 12) * Math.PI; // 0 at 06:00, PI at 18:00
    var elev = Math.sin(ang);
    if (elev > -0.05) {
      sun.position.set(Math.cos(ang) * 320, Math.max(elev, 0.04) * 300, 120);
    } else {
      // Moon: fixed cool light from the north-east.
      sun.position.set(140, 260, -180);
    }
    night = nightFactorFor(hour);
    for (var i = 0; i < listeners.length; i++) listeners[i](night);
  }

  var DAY_SECONDS = 480; // one full day = 8 minutes of play
  var engine = {
    renderer: renderer,
    scene: scene,
    camera: camera,
    setTimeOfDay: function (t) { time01 = ((t % 1) + 1) % 1; applyTime(); },
    getTimeOfDay: function () { return time01; },
    onDay: function (fn) { listeners.push(fn); fn(night); },
    update: function (dt) {
      time01 = (time01 + dt / DAY_SECONDS) % 1;
      applyTime();
    }
  };
  VC.engine = engine;

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  applyTime();
  return engine;
};
