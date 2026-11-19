// VICE CITY: Rise of Crime — shared game state + tiny event emitter.
// One object every later system reads and mutates: cash, health, wanted,
// ammo, plus crime/shot/cash/health events for HUD, audio and police.
window.VC = window.VC || {};

VC.createState = function () {
  var listeners = {};

  var state = {
    cash: 250,
    health: 100,
    maxHealth: 100,
    wanted: 0,        // 0..5, may be fractional; HUD shows Math.ceil
    ammo: 60,         // rounds ready to fire (combat chunk manages reloads)
    reserveAmmo: 240, // spare rounds carried
    kills: 0,
    crimes: 0,

    on: function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return state;
    },

    off: function (evt, fn) {
      var arr = listeners[evt];
      if (!arr) return state;
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
      return state;
    },

    emit: function (evt, data) {
      var arr = listeners[evt];
      if (!arr) return state;
      // copy so handlers may unsubscribe while we iterate
      var copy = arr.slice();
      for (var i = 0; i < copy.length; i++) copy[i](data, state);
      return state;
    },

    // Convenience mutators that keep the event stream honest.
    addCash: function (amount) {
      state.cash += amount;
      state.emit('cash', { amount: amount, total: state.cash });
    },

    damage: function (amount) {
      state.health = Math.max(0, state.health - amount);
      state.emit('health', { amount: -amount, total: state.health });
    },

    heal: function (amount) {
      state.health = Math.min(state.maxHealth, state.health + amount);
      state.emit('health', { amount: amount, total: state.health });
    },

    commitCrime: function (level, kind) {
      state.crimes += 1;
      state.emit('crime', { level: level || 1, kind: kind || 'generic' });
    }
  };

  return state;
};
