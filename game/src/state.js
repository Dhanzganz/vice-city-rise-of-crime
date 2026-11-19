'use strict';
/* VICE CITY: Rise of Crime — game state (chunk C1).
   VC.createState() -> central mutable state + tiny event emitter.
   commitCrime() only COUNTS and emits 'crime'; it never touches wanted
   (the police module owns the wanted level). */
(function () {
  window.VC = window.VC || {};

  function createState() {
    var listeners = {}; // event -> [fn]

    var state = {
      cash: 250,
      health: 100,       // 0..100
      wanted: 0,         // 0..5 float, owned by police
      ammo: 60,
      reserveAmmo: 240,
      kills: 0,
      crimes: 0
    };

    state.on = function (ev, fn) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev].push(fn);
    };

    state.off = function (ev, fn) {
      var arr = listeners[ev];
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };

    state.emit = function (ev, payload) {
      var arr = listeners[ev];
      if (!arr) return;
      arr = arr.slice();
      for (var i = 0; i < arr.length; i++) {
        try { arr[i](payload); } catch (e) { /* listener errors never break the game */ }
      }
    };

    state.addCash = function (n) {
      state.cash += n;
      state.emit('cash', state.cash);
    };

    state.damage = function (n) {
      state.health -= n;
      if (state.health < 0) state.health = 0;
      if (state.health > 100) state.health = 100;
      state.emit('health', state.health);
    };

    state.heal = function (n) {
      state.health += n;
      if (state.health > 100) state.health = 100;
      if (state.health < 0) state.health = 0;
      state.emit('health', state.health);
    };

    /* Count a crime and tell the world. Wanted is NOT changed here:
       police subscribes to 'crime' and decides the response. */
    state.commitCrime = function (level, kind) {
      state.crimes += 1;
      state.emit('crime', { level: level, kind: kind });
    };

    return state;
  }

  window.VC.createState = createState;
})();
