// VICE CITY: Rise of Crime — synthesized audio.
// Every sound is generated with WebAudio oscillators/noise: no assets.
// All entry points no-op safely when no AudioContext is available or it
// is still suspended (headless capture, pre-gesture autoplay policies).
window.VC = window.VC || {};

VC.createAudio = function () {
  var ctx = null;
  var master = null;
  var engineOsc = null, engineGain = null, engineFilter = null;
  var sirenOsc = null, sirenGain = null, sirenTimer = null, sirenHigh = false;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.15;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function ready() {
    return !!(ctx && ctx.state === 'running');
  }

  function resume() {
    if (!ensure()) return;
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }

  function noiseBuffer(dur) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function shot() {
    if (!ready()) return;
    try {
      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.16);
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, t);
      filter.frequency.exponentialRampToValueAtTime(300, t + 0.14);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.17);
      // low body thump under the crack
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.7, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(og); og.connect(master);
      osc.start(t); osc.stop(t + 0.14);
    } catch (e) {}
  }

  function punch() {
    if (!ready()) return;
    try {
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + 0.12);
    } catch (e) {}
  }

  function tone(freq, t0, dur, type, vol, glideTo) {
    var osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function blip() {
    if (!ready()) return;
    try {
      var t = ctx.currentTime;
      tone(880, t, 0.07, 'square', 0.22);
      tone(1320, t + 0.07, 0.09, 'square', 0.22);
    } catch (e) {}
  }

  function pickup() {
    if (!ready()) return;
    try {
      var t = ctx.currentTime;
      tone(660, t, 0.06, 'square', 0.22);
      tone(990, t + 0.06, 0.06, 'square', 0.22);
      tone(1320, t + 0.12, 0.1, 'square', 0.22);
    } catch (e) {}
  }

  function sting() {
    if (!ready()) return;
    try {
      var t = ctx.currentTime;
      tone(392, t, 0.22, 'triangle', 0.35);
      tone(311, t + 0.2, 0.22, 'triangle', 0.35);
      tone(233, t + 0.4, 0.45, 'triangle', 0.4);
    } catch (e) {}
  }

  function engineSet(speed01, driving) {
    if (!ensure()) return;
    try {
      if (driving && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 500;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (!engineOsc) return;
      var t = ctx.currentTime;
      var target = driving && ready() ? 0.12 : 0;
      engineGain.gain.setTargetAtTime(target, t, 0.08);
      if (driving) {
        var s = Math.max(0, Math.min(1, speed01 || 0));
        engineOsc.frequency.setTargetAtTime(60 + s * 120, t, 0.05);
        engineFilter.frequency.setTargetAtTime(400 + s * 900, t, 0.05);
      }
    } catch (e) {}
  }

  function sirenSet(on) {
    if (!ensure()) return;
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 650;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        sirenHigh = false;
        sirenTimer = window.setInterval(function () {
          if (!sirenOsc) return;
          sirenHigh = !sirenHigh;
          try { sirenOsc.frequency.setValueAtTime(sirenHigh ? 950 : 650, ctx.currentTime); } catch (e) {}
        }, 380);
      }
      if (sirenGain) {
        sirenGain.gain.setTargetAtTime(on && ready() ? 0.05 : 0, ctx.currentTime, 0.1);
      }
      if (!on && sirenOsc) {
        var osc = sirenOsc, timer = sirenTimer;
        sirenOsc = null; sirenTimer = null;
        window.clearInterval(timer);
        window.setTimeout(function () { try { osc.stop(); } catch (e) {} }, 400);
      }
    } catch (e) {}
  }

  return {
    resume: resume,
    shot: shot,
    punch: punch,
    pickup: pickup,
    blip: blip,
    sting: sting,
    engineSet: engineSet,
    sirenSet: sirenSet
  };
};
