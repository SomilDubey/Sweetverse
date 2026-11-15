/* SWEETVERSE meta progression – pure logic, no DOM (unit-tested in test.js)
 * 2026-11-15 v0.6 phase 3: player XP and levels, weekly missions, treasure chests,
 *                 daily streak with recovery.
 */
(function (root) {
  'use strict';

  // ---------- XP and player level ----------
  // Level n needs 80 + 40*(n-1) XP to reach n+1 (gentle curve: level 10 at ~2,160 XP).
  function xpNeeded(level) { return 80 + 40 * (level - 1); }
  function levelFromXp(xp) {
    var level = 1, left = Math.max(0, xp | 0);
    while (left >= xpNeeded(level)) { left -= xpNeeded(level); level++; }
    return { level: level, into: left, need: xpNeeded(level) };
  }
  var XP = { win: 20, perStar: 10, firstClear: 15, loss: 5, special: 1, combo: 3, daily: 10, mission: 40 };
  // XP for one finished level attempt
  function xpForGame(r) {
    var xp = r.won ? XP.win + r.stars * XP.perStar + (r.firstClear ? XP.firstClear : 0) : XP.loss;
    return xp + (r.specials || 0) * XP.special + (r.combos || 0) * XP.combo;
  }
  // chest earned when reaching a new player level: gold every 10, silver every 5, else bronze
  function levelUpChest(level) { return level % 10 === 0 ? 'gold' : level % 5 === 0 ? 'silver' : 'bronze'; }

  // ---------- small seeded RNG + date helpers ----------
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function dayStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  // week id: the date of that week's Monday (local time)
  function weekId(d) { var m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return dayStr(m); }

  // ---------- weekly missions ----------
  var POOL = [
    { id: 'rockets', text: 'Make 25 Rockets', stat: 'rockets', target: 25, icon: '🚀' },
    { id: 'bombs', text: 'Make 15 Magic Bombs', stat: 'bombs', target: 15, icon: '💣' },
    { id: 'rainbows', text: 'Make 5 Rainbow Orbs', stat: 'rainbows', target: 5, icon: '🌈' },
    { id: 'combos', text: 'Fire 6 special combos', stat: 'combos', target: 6, icon: '💥' },
    { id: 'wins', text: 'Win 10 levels', stat: 'wins', target: 10, icon: '🏁' },
    { id: 'stars', text: 'Earn 15 new stars', stat: 'stars', target: 15, icon: '⭐' },
    { id: 'ice', text: 'Melt 60 ice tiles', stat: 'ice', target: 60, icon: '❄️' },
    { id: 'choc', text: 'Break 40 chocolate', stat: 'choc', target: 40, icon: '🍫' },
    { id: 'crates', text: 'Crack 30 crate layers', stat: 'crates', target: 30, icon: '🎁' },
    { id: 'acorns', text: 'Collect 8 acorns', stat: 'acorns', target: 8, icon: '🌰' },
    { id: 'defused', text: 'Defuse 10 fizz bombs', stat: 'defused', target: 10, icon: '🧨' },
    { id: 'matches', text: 'Make 300 matches', stat: 'matches', target: 300, icon: '✨' }
  ];
  var MISSION_CHEST = ['bronze', 'silver', 'gold'];
  // 3 different missions per week, the same for everyone that week. Baseline = stats at week start.
  function weeklyMissions(week, stats) {
    var r = rng(hash('sv-week-' + week)), pool = POOL.slice(), out = [];
    for (var k = 0; k < 3; k++) {
      var m = pool.splice(Math.floor(r() * pool.length), 1)[0];
      out.push({ id: m.id, text: m.text, stat: m.stat, target: m.target, icon: m.icon, base: stats[m.stat] || 0, claimed: false, chest: MISSION_CHEST[k] });
    }
    return { week: week, list: out };
  }
  function missionProgress(m, stats) { return Math.min(m.target, Math.max(0, (stats[m.stat] || 0) - m.base)); }
  // keep this week's missions, or start a fresh set (baseline = current stats)
  function ensureWeek(missions, now, stats) {
    var w = weekId(now);
    return missions && missions.week === w ? missions : weeklyMissions(w, stats);
  }

  // ---------- treasure chests ----------
  var CHESTS = {
    bronze: { coins: [30, 60], items: 1, name: 'Bronze chest', icon: '🧰' },
    silver: { coins: [80, 140], items: 2, name: 'Silver chest', icon: '🎁' },
    gold: { coins: [200, 320], items: 3, name: 'Golden chest', icon: '👑' }
  };
  var ITEMS = ['hammer', 'blast', 'swap', 'shuffle', 'moves'];
  function openChest(type, seed) {
    var c = CHESTS[type], r = rng(seed == null ? (Math.random() * 4294967296) >>> 0 : seed);
    var res = { coins: c.coins[0] + Math.floor(r() * (c.coins[1] - c.coins[0] + 1)), items: {} };
    for (var k = 0; k < c.items; k++) { var it = ITEMS[Math.floor(r() * ITEMS.length)]; res.items[it] = (res.items[it] || 0) + 1; }
    return res;
  }

  // ---------- daily streak with recovery ----------
  // state: { last: 'Y-M-D', streak: n }. Returns what the daily screen should offer today.
  function dailyStatus(state, now) {
    var today = dayStr(now), d1 = new Date(now), d2 = new Date(now);
    d1.setDate(d1.getDate() - 1); d2.setDate(d2.getDate() - 2);
    if (state.last === today) return { canClaim: false, dayIndex: (state.streak - 1) % 7, recoverable: false };
    if (state.last === dayStr(d1)) return { canClaim: true, dayIndex: state.streak % 7, recoverable: false };
    // missed exactly one day: the streak can be kept for a small coin price
    if (state.last === dayStr(d2) && state.streak > 0) return { canClaim: true, dayIndex: 0, recoverable: true, recoverIndex: state.streak % 7, recoverCost: 50 };
    return { canClaim: true, dayIndex: 0, recoverable: false };
  }
  var RECOVER_COST = 50;

  var api = { xpNeeded: xpNeeded, levelFromXp: levelFromXp, xpForGame: xpForGame, XP: XP, levelUpChest: levelUpChest,
    weekId: weekId, dayStr: dayStr, weeklyMissions: weeklyMissions, missionProgress: missionProgress, ensureWeek: ensureWeek,
    POOL: POOL, CHESTS: CHESTS, openChest: openChest, dailyStatus: dailyStatus, RECOVER_COST: RECOVER_COST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SweetMeta = api;
})(this);
