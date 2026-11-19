'use strict';
/* VICE CITY: Rise of Crime — engine.js
 * VC.createEngine(mount): renderer, scene, camera, lights and the day cycle.
 * timeOfDay runs [0,1): 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
 * A full day lasts 240 s unless frozen. Sky, fog, sun and hemisphere light
 * are keyframed across the phases; onDay subscribers get a nightFactor
 * (0 = full day, 1 = deep night) whenever it changes materially. */
window.VC = window.VC || {};

VC.createEngine = function (mount) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.0016);

  const camera = new THREE.PerspectiveCamera(62, (mount.clientWidth || window.innerWidth) / (mount.clientHeight || window.innerHeight), 0.1, 900);
  camera.position.set(0, 8, 14);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  /* Keyframes: t, sky, fog, sun colour, sun intensity, sun elevation (rad),
   * sun azimuth (rad), hemi intensity, nightFactor. */
  const KEYS = [
    { t: 0.00, sky: 0x0b1026, fog: 0x0b1026, sunC: 0x8fb4ff, sunI: 0.12, elev: -0.35, azim: 0.6, hemi: 0.22, night: 1.0 },
    { t: 0.21, sky: 0x131a3a, fog: 0x131a3a, sunC: 0x9db8ff, sunI: 0.14, elev: -0.06, azim: 0.9, hemi: 0.26, night: 0.95 },
    { t: 0.27, sky: 0xe8a34c, fog: 0xe8b06a, sunC: 0xffb45e, sunI: 0.75, elev: 0.16, azim: 1.15, hemi: 0.5, night: 0.35 },
    { t: 0.36, sky: 0x87bfe8, fog: 0x9fc8e8, sunC: 0xffe9b8, sunI: 1.15, elev: 0.7, azim: 1.7, hemi: 0.75, night: 0.0 },
    { t: 0.50, sky: 0x87ceeb, fog: 0xaad4ee, sunC: 0xffffff, sunI: 1.25, elev: 1.25, azim: 2.6, hemi: 0.8, night: 0.0 },
    { t: 0.64, sky: 0x86bde6, fog: 0x9fc4e4, sunC: 0xffe4ae, sunI: 1.1, elev: 0.65, azim: 3.5, hemi: 0.72, night: 0.0 },
    { t: 0.73, sky: 0xf07f4a, fog: 0xe88a5e, sunC: 0xff8a4a, sunI: 0.8, elev: 0.14, azim: 4.1, hemi: 0.5, night: 0.3 },
    { t: 0.79, sky: 0x53355e, fog: 0x53355e, sunC: 0xd98ab0, sunI: 0.3, elev: -0.05, azim: 4.4, hemi: 0.32, night: 0.8 },
    { t: 0.85, sky: 0x0e1430, fog: 0x0e1430, sunC: 0x8fb4ff, sunI: 0.13, elev: -0.3, azim: 4.8, hemi: 0.23, night: 1.0 },
    { t: 1.00, sky: 0x0b1026, fog: 0x0b1026, sunC: 0x8fb4ff, sunI: 0.12, elev: -0.35, azim: 0.6, hemi: 0.22, night: 1.0 }
  ];

  let timeOfDay = 0.34;
  let frozen = false;
  let lastNight = -1;
  const subs = [];
  const cA = new THREE.Color(), cB = new THREE.Color();

  function lerp(a, b, f) { return a + (b - a) * f; }
  function lerpColor(target, hexA, hexB, f) {
    cA.setHex(hexA); cB.setHex(hexB);
    target.copy(cA).lerp(cB, f);
  }

  function apply() {
    let i = 0;
    while (i < KEYS.length - 2 && timeOfDay >= KEYS[i + 1].t) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const span = (B.t - A.t) || 1;
    const f = Math.min(1, Math.max(0, (timeOfDay - A.t) / span));

    lerpColor(scene.background, A.sky, B.sky, f);
    lerpColor(scene.fog.color, A.fog, B.fog, f);
    lerpColor(sun.color, A.sunC, B.sunC, f);
    sun.intensity = lerp(A.sunI, B.sunI, f);
    hemi.intensity = lerp(A.hemi, B.hemi, f);

    const elev = lerp(A.elev, B.elev, f);
    const azim = lerp(A.azim, B.azim, f);
    const R = 320;
    sun.position.set(Math.cos(elev) * Math.sin(azim) * R, Math.sin(elev) * R, Math.cos(elev) * Math.cos(azim) * R);
    /* At night the "sun" is the moon: keep it above the horizon so shadows read. */
    if (sun.position.y < 40) sun.position.y = 40;
    sun.target.position.set(0, 0, 0);

    const night = lerp(A.night, B.night, f);
    if (Math.abs(night - lastNight) > 0.02) {
      lastNight = night;
      for (let s = 0; s < subs.length; s++) subs[s](night);
    }
  }

  function onResize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  apply();

  return {
    renderer: renderer,
    scene: scene,
    camera: camera,
    setTimeOfDay: function (t) {
      timeOfDay = ((t % 1) + 1) % 1;
      apply();
    },
    getTimeOfDay: function () { return timeOfDay; },
    setFrozen: function (b) { frozen = !!b; },
    onDay: function (cb) {
      subs.push(cb);
      cb(lastNight < 0 ? 0 : lastNight);
    },
    update: function (dt) {
      if (!frozen && dt > 0) {
        timeOfDay = (timeOfDay + dt / 240) % 1;
        apply();
      }
    }
  };
};
