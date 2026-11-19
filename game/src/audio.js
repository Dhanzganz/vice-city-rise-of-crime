'use strict';
/* VICE CITY: Rise of Crime — synthesized audio (chunk C1).
   VC.createAudio(): every sound is WebAudio-synthesized, no assets.
   The AudioContext is created lazily by resume() (first user gesture).
   Every method no-ops safely before resume(). */
(function () {
  window.VC = window.VC || {};

  function createAudio() {
    var ctx = null;
    var master = null;

    var sirenNodes = null;   // {osc, lfo, lfoGain, gain}
    var engineNodes = null;  // {osc, filter, gain}

    function resume() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    }

    function now() { return ctx.currentTime; }

    /* Short noise burst + square blip: a gunshot crack. */
    function shot() {
      if (!ctx) return;
      var t = now();
      var dur = 0.12;
      var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      var noise = ctx.createBufferSource();
      noise.buffer = buf;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      noise.connect(ng); ng.connect(master);
      noise.start(t);

      var osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.25, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(og); og.connect(master);
      osc.start(t); osc.stop(t + 0.1);
    }

    /* Low sine thump: a fist landing. */
    function punch() {
      if (!ctx) return;
      var t = now();
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.6, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + 0.17);
    }

    /* Two rising sine notes: item collected. */
    function pickup() {
      if (!ctx) return;
      var t = now();
      var notes = [660, 990];
      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[i];
        var g = ctx.createGain();
        var start = t + i * 0.07;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(g); g.connect(master);
        osc.start(start); osc.stop(start + 0.18);
      }
    }

    /* Tiny UI tick. */
    function blip() {
      if (!ctx) return;
      var t = now();
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + 0.07);
    }

    /* Minor chord hit: busted / wasted sting. */
    function sting() {
      if (!ctx) return;
      var t = now();
      var freqs = [110, 130.81, 164.81]; // A2, C3, E3 — A minor
      for (var i = 0; i < freqs.length; i++) {
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freqs[i];
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(g); g.connect(master);
        osc.start(t); osc.stop(t + 0.95);
      }
    }

    /* Looping siren wail: oscillator whose frequency is swept by an LFO. */
    function sirenSet(on) {
      if (!ctx) return;
      if (on) {
        if (sirenNodes) return;
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 800;
        var lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.6;
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        var g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.exponentialRampToValueAtTime(0.08, now() + 0.2);
        osc.connect(g); g.connect(master);
        osc.start(); lfo.start();
        sirenNodes = { osc: osc, lfo: lfo, lfoGain: lfoGain, gain: g };
      } else {
        if (!sirenNodes) return;
        var nodes = sirenNodes;
        sirenNodes = null;
        nodes.gain.gain.cancelScheduledValues(now());
        nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now());
        nodes.gain.gain.exponentialRampToValueAtTime(0.001, now() + 0.15);
        var stopAt = now() + 0.2;
        try { nodes.osc.stop(stopAt); nodes.lfo.stop(stopAt); } catch (e) {}
      }
    }

    /* Engine hum: sawtooth through a lowpass; pitch follows level 0..1.
       engineSet(null) stops it. */
    function engineSet(level) {
      if (!ctx) return;
      if (level === null || level === undefined) {
        if (!engineNodes) return;
        var nodes = engineNodes;
        engineNodes = null;
        nodes.gain.gain.cancelScheduledValues(now());
        nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now());
        nodes.gain.gain.exponentialRampToValueAtTime(0.001, now() + 0.12);
        try { nodes.osc.stop(now() + 0.16); } catch (e) {}
        return;
      }
      var lv = Math.max(0, Math.min(1, level));
      if (!engineNodes) {
        var osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 2;
        var g = ctx.createGain();
        g.gain.value = 0.0001;
        osc.connect(filter); filter.connect(g); g.connect(master);
        osc.start();
        engineNodes = { osc: osc, filter: filter, gain: g };
      }
      engineNodes.osc.frequency.setTargetAtTime(50 + lv * 130, now(), 0.05);
      engineNodes.filter.frequency.setTargetAtTime(300 + lv * 900, now(), 0.05);
      engineNodes.gain.gain.setTargetAtTime(0.05 + lv * 0.08, now(), 0.05);
    }

    return {
      resume: resume,
      shot: shot,
      punch: punch,
      pickup: pickup,
      blip: blip,
      sting: sting,
      sirenSet: sirenSet,
      engineSet: engineSet
    };
  }

  window.VC.createAudio = createAudio;
})();
