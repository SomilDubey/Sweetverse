/* SWEETVERSE UI
 * 2026-11-14 v0.2 home, map, game, modals, synth audio (archived: archive/ui.v02.js)
 * 2026-11-14 v0.3 splash, main menu, profile + stats, achievements, daily reward, coins,
 *                 booster inventory, 5 boosters (Hammer, Colour Blast, Magic Swap, Shuffle,
 *                 Extra Moves), chocolate, canvas particles, volume sliders, reduced motion,
 *                 landscape layout, session-only storage fallback.
 * 2026-11-15 v0.4 performance (no per-tile filters, auto lite graphics), candy crates, fizz
 *                 bombs, Sugar Rush finale, start boosters, tutorial hand, worlds 4-6,
 *                 new achievements. Previous: archive/ui.v03.js
 * 2026-11-15 v0.5 versioned save (v2) with migration from v0.1-v0.4 keys, backup copy and
 *                 corruption recovery; smart goal-aware hints + hint button; audio voice
 *                 limiting. Previous: archive/ui.v04.js
 * 2026-11-15 v0.6 visuals: landing squash, press feedback, match impact flash, star trail
 *                 to the star bar, richer candy material, Pip on win/lose screens, failure
 *                 explanation on the defeat screen. Previous: archive/ui.v05.js
 * 2026-11-15 v0.6 phase 3: player XP/level (meta.js), weekly missions, treasure chests,
 *                 daily streak recovery, Missions screen. Previous: archive/ui.v06p2.js
 */
(function () {
  'use strict';
  var M = window.SweetMeta, E = window.SweetEngine, LEVELS = window.SWEET_LEVELS, WORLDS = window.SWEET_WORLDS;
  var $ = function (s) { return document.querySelector(s); };
  var COLORS = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#2ed58a', '#3a86ff', '#b15cff'];
  var COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

  // ---------- storage (persistent if available, else session-only) ----------
  var persistent = (function () { try { localStorage.setItem('__sv', '1'); localStorage.removeItem('__sv'); return true; } catch (e) { return false; } })();
  var mem = {};
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEF = {
    progress: { unlocked: 1, stars: {}, best: {} },
    inv: { hammer: 3, blast: 1, swap: 2, shuffle: 2, moves: 2 },
    settings: { sfxVol: 0.8, musicVol: 0.4, haptics: true, reduced: prefersReduced, lite: null, autoHint: true },
    profile: { name: 'Sweet Player', avatar: '🧁', coins: 100, xp: 0 },
    meta: { missions: null, chests: { bronze: 0, silver: 0, gold: 0 } },
    stats: { played: 0, wins: 0, losses: 0, totalScore: 0, matches: 0, rockets: 0, bombs: 0, rainbows: 0, combos: 0,
      bestCascade: 0, ice: 0, choc: 0, acorns: 0, boosters: 0, dailyClaims: 0, crates: 0, defused: 0 },
    daily: { last: '', streak: 0 },
    ach: { done: {} }
  };
  // ---- Save system v2 (2026-11-15) ----
  // One versioned record {v, savedAt, data}. A backup of the previous save is kept in sv_save_bak.
  // A save that cannot be read is copied to sv_corrupt_<time> and never silently overwritten.
  // Old v0.1-v0.4 per-section keys (sv_progress, sv_inv, ...) are migrated and left in place.
  var SAVE_KEY = 'sv_save', SAVE_VERSION = 2, saveNote = '';
  function lsGet(k) { if (!persistent) return mem[k] || null; try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } }
  function lsSet(k, v) { mem[k] = v; if (!persistent) return true; try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function migrateSave(p) {
    if (!p || typeof p !== 'object' || !p.data) return null;
    var d = p.data, v = p.v || 1;
    // future: if (v === 2) { ...convert to 3...; v = 3; }
    return v <= SAVE_VERSION ? d : null;
  }
  function readSave(raw) { try { return migrateSave(JSON.parse(raw)); } catch (e) { return null; } }
  function loadSave() {
    var raw = lsGet(SAVE_KEY), data = null;
    if (raw) {
      data = readSave(raw);
      if (!data) {
        lsSet('sv_corrupt_' + Date.now(), raw);
        var bak = lsGet(SAVE_KEY + '_bak');
        data = bak ? readSave(bak) : null;
        saveNote = data ? 'Your save was damaged, so it was restored from the backup copy.' : 'Your save could not be read. A copy was kept and a fresh save started.';
      }
    } else {
      var old = {}, found = false;
      Object.keys(DEF).forEach(function (k) {
        var v = lsGet('sv_' + k);
        if (v) { try { old[k] = JSON.parse(v); found = true; } catch (e) {} }
      });
      if (found) { data = old; saveNote = 'migrated'; }
    }
    var out = {};
    Object.keys(DEF).forEach(function (k) {
      out[k] = Object.assign(JSON.parse(JSON.stringify(DEF[k])), (data && data[k] && typeof data[k] === 'object') ? data[k] : {});
    });
    return out;
  }
  var S = loadSave();
  function save() {
    var prev = lsGet(SAVE_KEY);
    if (prev && readSave(prev)) lsSet(SAVE_KEY + '_bak', prev);
    lsSet(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, savedAt: new Date().toISOString(), data: S }));
  }

  // ---------- audio (Web Audio, generated) ----------
  var actx = null, sfxBus = null, musicBus = null;
  function ac() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        sfxBus = actx.createGain(); musicBus = actx.createGain();
        sfxBus.connect(actx.destination); musicBus.connect(actx.destination);
        applyVolumes();
      } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function applyVolumes() { if (sfxBus) { sfxBus.gain.value = S.settings.sfxVol; musicBus.gain.value = S.settings.musicVol * 0.6; } }
  var voices = 0, MAX_VOICES = 14, lastSfx = {};
  function tone(f, d, type, vol, when, slide, bus) {
    var a = ac(); if (!a) return;
    if (voices >= MAX_VOICES) return;          // never stack too many sounds in big cascades
    if ((bus || 'sfx') === 'sfx' && S.settings.sfxVol <= 0) return;
    var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(bus === 'music' ? musicBus : sfxBus); o.start(t); o.stop(t + d + 0.05);
    voices++; o.onended = function () { voices--; };
  }
  var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  var sfx = {
    match: function (c) { var f = SCALE[Math.min(c - 1, 7)]; tone(f, 0.16, 'triangle', 0.2); tone(f * 1.5, 0.12, 'sine', 0.08, 0.04); },
    fall: function () { tone(330, 0.07, 'sine', 0.05, 0, 0.7); tone(260, 0.07, 'sine', 0.04, 0.05, 0.7); },
    special: function () { tone(180, 0.4, 'sawtooth', 0.09, 0, 5); tone(900, 0.3, 'triangle', 0.08, 0.05, 0.4); },
    combo: function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, 'square', 0.05, i * 0.04); }); tone(120, 0.5, 'sawtooth', 0.1, 0, 0.3); },
    bad: function () { tone(200, 0.1, 'square', 0.06); tone(160, 0.12, 'square', 0.06, 0.08); },
    click: function () { tone(900, 0.05, 'sine', 0.08); },
    swap: function () { tone(660, 0.06, 'sine', 0.07, 0, 1.3); },
    create: function () { tone(784, 0.1, 'sine', 0.12); tone(1175, 0.18, 'triangle', 0.1, 0.07); },
    collect: function () { tone(988, 0.1, 'sine', 0.14); tone(1319, 0.2, 'sine', 0.14, 0.08); tone(1568, 0.25, 'sine', 0.1, 0.16); },
    ice: function () { tone(2000 + Math.random() * 600, 0.08, 'triangle', 0.05); },
    choc: function () { tone(140, 0.12, 'square', 0.07, 0, 0.6); },
    unlock: function () { tone(1400, 0.06, 'square', 0.05); tone(700, 0.12, 'triangle', 0.08, 0.05); },
    coin: function () { tone(1568, 0.06, 'square', 0.05); tone(2093, 0.12, 'square', 0.05, 0.06); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.16, i * 0.11); }); tone(1047, 0.8, 'sine', 0.1, 0.6); },
    lose: function () { [494, 440, 392, 330].forEach(function (f, i) { tone(f, 0.32, 'triangle', 0.12, i * 0.2); }); },
    star: function (n) { tone(880 + n * 220, 0.25, 'triangle', 0.15); }
  };
  // rate-limit each sound effect so the same one can't fire more than every 45 ms
  Object.keys(sfx).forEach(function (k) {
    var fn = sfx[k];
    sfx[k] = function () { var now = Date.now(); if (now - (lastSfx[k] || 0) < 45) return; lastSfx[k] = now; return fn.apply(null, arguments); };
  });
  var musicTimer = null, musicStep = 0;
  var MEL = [0, 2, 4, 7, 4, 2, 9, 7, 0, 4, 7, 9, 7, 4, 2, 4], BASS = [0, 5, 3, 7, 5, 8, 7, 5];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(function () {
      if (S.settings.musicVol <= 0 || document.hidden || !actx) return;
      tone(392 * Math.pow(2, MEL[musicStep % 16] / 12), 0.28, 'sine', 0.06, 0, 0, 'music');
      if (musicStep % 2 === 0) tone(98 * Math.pow(2, BASS[(musicStep / 2) % 8] / 12), 0.5, 'triangle', 0.07, 0, 0, 'music');
      musicStep++;
    }, 300);
  }
  function buzz(ms) { if (S.settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }
  function T(ms) { return S.settings.reduced ? Math.round(ms * 0.55) : ms; }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, T(ms)); }); };

  // ---------- screens ----------
  var SCREENS = ['splash', 'home', 'map', 'game', 'profile', 'shop'];
  var current = 'splash';
  function show(id) {
    SCREENS.forEach(function (s) { $('#' + s).classList.toggle('hidden', s !== id); });
    var el = $('#' + id); el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    if (id !== 'game') stopTimers();
    current = id;
    updateCoins();
  }
  function updateCoins() { document.querySelectorAll('.coinVal').forEach(function (e) { e.textContent = S.profile.coins.toLocaleString(); }); }

  // ---------- modal (always has a close X) ----------
  var modalClose = null;
  function showModal(o) {
    var m = $('#modal'); m.classList.remove('hidden');
    m.innerHTML = '<div class="card"><button class="x" aria-label="Close">✕</button>' + (o.title ? '<h2>' + o.title + '</h2>' : '') + (o.body || '') + '<div class="btns"></div></div>';
    var btns = m.querySelector('.btns');
    (o.buttons || []).forEach(function (b) {
      var el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label;
      if (b.disabled) el.disabled = true;
      el.onclick = function () { sfx.click(); hideModal(); b.fn && b.fn(); };
      btns.appendChild(el);
    });
    modalClose = o.onClose || null;
    m.querySelector('.x').onclick = function () { sfx.click(); var f = modalClose; hideModal(); f && f(); };
    if (o.after) o.after(m);
  }
  function hideModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; modalClose = null; }
  function modalOpen() { return !$('#modal').classList.contains('hidden'); }
  function confirmModal(title, text, yesLabel, onYes, onCancel) {
    showModal({ title: title, body: '<p>' + text + '</p>', buttons: [{ label: yesLabel, cls: '', fn: onYes }, { label: 'Cancel', cls: 'blue', fn: onCancel }], onClose: onCancel });
  }
  var toastQ = [], toastBusy = false;
  function toast(html) {
    toastQ.push(html); if (toastBusy) return;
    (function next() {
      var h = toastQ.shift(); if (!h) { toastBusy = false; return; }
      toastBusy = true;
      var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = h; document.body.appendChild(t);
      setTimeout(function () { t.remove(); next(); }, 2600);
    })();
  }

  // ---------- goals ----------
  var SP_NAME = { rocket: 'Rockets', bomb: 'Magic Bombs', rainbow: 'Rainbow Orbs', any: 'special sweets' };
  var SP_ICON = { rocket: '🚀', bomb: '💣', rainbow: '🌈', any: '✨' };
  function goalIcon(g) {
    if (g.type === 'color') return '<span class="gi"><span class="candy c' + g.color + '"></span></span>';
    if (g.type === 'make') return '<span class="gi">' + SP_ICON[g.special] + '</span>';
    return '<span class="gi">' + ({ ice: '❄️', locks: '🔒', ingredients: '🌰', score: '⭐', chocolate: '🍫', combo: '💥', crates: '🎁', fuses: '🧨' })[g.type] + '</span>';
  }
  function goalsHtml(goals, game) {
    return goals.map(function (g) {
      var left = game ? game.goalLeft(g) : g.target;
      var txt = g.type === 'score' ? (game ? Math.min(game.score, g.target).toLocaleString() + ' / ' : '') + g.target.toLocaleString() : (left <= 0 ? '✔' : left);
      return '<span class="goal' + (game && left <= 0 ? ' done' : '') + '">' + goalIcon(g) + txt + '</span>';
    }).join('');
  }
  function goalDesc(level) {
    return level.goals.map(function (g) {
      switch (g.type) {
        case 'score': return 'Score ' + g.target.toLocaleString();
        case 'color': return 'Collect ' + g.target + ' ' + COLOR_NAMES[g.color];
        case 'ice': return 'Melt all ice';
        case 'locks': return 'Break all locks';
        case 'ingredients': return 'Bring down ' + g.target + ' acorns';
        case 'chocolate': return 'Clear all chocolate';
        case 'make': return 'Make ' + g.target + ' ' + SP_NAME[g.special];
        case 'combo': return 'Fire ' + g.target + ' special combo' + (g.target > 1 ? 's' : '');
        case 'crates': return 'Crack all candy crates';
        case 'fuses': return 'Defuse ' + g.target + ' fizz bombs';
      }
    }).join(' · ');
  }

  // ---------- splash & menu ----------
  function bootSplash() {
    var bar = $('#loadFill'), p = 0;
    var iv = setInterval(function () {
      p = Math.min(100, p + 7 + Math.random() * 9); bar.style.width = p + '%';
      if (p >= 100) { clearInterval(iv); $('#tapStart').classList.remove('hidden'); $('#loadBar').classList.add('hidden'); }
    }, 90);
    $('#splash').onclick = function () { if ($('#tapStart').classList.contains('hidden')) return; ac(); sfx.click(); startMusic(); show('home'); refreshHome(); };
  }
  function refreshHome() {
    $('#dailyDot').classList.toggle('hidden', !dailyAvailable());
    $('#homeAvatar').textContent = S.profile.avatar;
    $('#homeName').textContent = S.profile.name;
    $('#homeStars').textContent = totalStars();
    refreshBadges();
  }

  // ---------- daily reward ----------
  var DAILY = [
    { coins: 50 }, { inv: 'hammer', n: 1 }, { coins: 100 }, { inv: 'shuffle', n: 1 },
    { coins: 150 }, { inv: 'blast', n: 1 }, { coins: 300, inv: 'swap', n: 2 }
  ];
  var INV_NAME = { hammer: 'Sweet Hammer', blast: 'Colour Blast', swap: 'Magic Swap', shuffle: 'Shuffle Magic', moves: 'Extra Moves' };
  var INV_ICON = { hammer: '🔨', blast: '🎨', swap: '🔄', shuffle: '🔀', moves: '➕' };
  function todayStr(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dailyAvailable() { return M.dailyStatus(S.daily, new Date()).canClaim; }
  function nextDayIndex() { return M.dailyStatus(S.daily, new Date()).dayIndex; }
  function rewardLabel(r) { var p = []; if (r.coins) p.push('🪙 ' + r.coins); if (r.inv) p.push(INV_ICON[r.inv] + ' ×' + r.n); return p.join('<br>'); }
  function dailyModal() {
    var ds = M.dailyStatus(S.daily, new Date()), avail = ds.canClaim, idx = ds.dayIndex;
    var cells = DAILY.map(function (r, i) {
      var cls = 'day' + (i < idx || (!avail && i === idx) ? ' claimed' : '') + (avail && i === idx ? ' today' : '');
      return '<div class="' + cls + '"><b>Day ' + (i + 1) + '</b><span>' + rewardLabel(r) + '</span></div>';
    }).join('');
    showModal({ title: 'Daily Treats', body: '<p>Come back every day. Miss a day and the streak starts again.</p><div class="days">' + cells + '</div>' +
      (avail ? '' : '<p style="font-weight:800">Already claimed today. See you tomorrow!</p>') +
      (ds.recoverable ? '<p class="warnNote">You missed yesterday. Keep your ' + S.daily.streak + '-day streak for 🪙 ' + ds.recoverCost + ', or start again from Day 1 for free.</p>' : ''),
      buttons: avail ? (ds.recoverable ? [{ label: 'Keep streak (🪙 ' + ds.recoverCost + ')', cls: 'gold', disabled: S.profile.coins < ds.recoverCost, fn: function () { claimDaily(true); } }, { label: 'Start again (free)', cls: 'green', fn: function () { claimDaily(false); } }]
        : [{ label: 'Claim', cls: 'green', fn: function () { claimDaily(false); } }]) : [{ label: 'OK', cls: 'blue' }], onClose: refreshHome });
  }
  function claimDaily(recover) {
    var ds = M.dailyStatus(S.daily, new Date());
    if (!ds.canClaim) return;
    var idx = ds.dayIndex;
    if (recover && ds.recoverable && S.profile.coins >= ds.recoverCost) { S.profile.coins -= ds.recoverCost; idx = ds.recoverIndex; }
    var r = DAILY[idx];
    S.daily.streak = idx + 1; S.daily.last = todayStr();
    if (r.coins) S.profile.coins += r.coins;
    if (r.inv) S.inv[r.inv] += r.n;
    S.stats.dailyClaims++; addXp(M.XP.daily); save(); sfx.coin(); confetti(30);
    toast('🎁 Day ' + (idx + 1) + ' reward: ' + rewardLabel(r).replace('<br>', ' + '));
    checkAch(); refreshHome(); updateCoins();
  }

  // ---------- XP, player level, chests, missions (rules in meta.js) ----------
  function playerLevel() { return M.levelFromXp(S.profile.xp); }
  function addXp(n) {
    var before = playerLevel().level;
    S.profile.xp += n;
    var after = playerLevel().level;
    for (var l = before + 1; l <= after; l++) { var ch = M.levelUpChest(l); S.meta.chests[ch]++; toast('⬆️ Player level ' + l + '! ' + M.CHESTS[ch].icon + ' ' + M.CHESTS[ch].name + ' earned'); }
    save(); refreshBadges();
  }
  function curStats() { return Object.assign({}, S.stats, { stars: totalStars() }); }
  function missions() { var m = M.ensureWeek(S.meta.missions, new Date(), curStats()); if (m !== S.meta.missions) { S.meta.missions = m; save(); } return m; }
  function claimable() { return missions().list.filter(function (m) { return !m.claimed && M.missionProgress(m, curStats()) >= m.target; }).length; }
  function chestCount() { var c = S.meta.chests; return c.bronze + c.silver + c.gold; }
  function refreshBadges() {
    var d = document.getElementById('missionDot'); if (d) d.classList.toggle('hidden', !(claimable() || chestCount()));
    var lv = playerLevel(), b = document.getElementById('lvBadge');
    if (b) { b.textContent = 'Lv ' + lv.level; document.getElementById('xpFill').style.width = Math.round(100 * lv.into / lv.need) + '%'; }
  }
  function missionsModal() {
    var ms = missions(), st = curStats(), c = S.meta.chests;
    var rows = ms.list.map(function (m, k) {
      var p = M.missionProgress(m, st), done = p >= m.target;
      return '<div class="mission' + (m.claimed ? ' claimed' : '') + '"><span class="mi">' + m.icon + '</span><div class="md"><b>' + m.text + '</b><div class="mbar"><div style="width:' + Math.round(100 * p / m.target) + '%"></div></div><small>' + p + ' / ' + m.target + ' · reward ' + M.CHESTS[m.chest].icon + '</small></div>' +
        (m.claimed ? '<span class="ar">✔</span>' : '<button class="btn small ' + (done ? 'green' : 'blue') + '" data-k="' + k + '"' + (done ? '' : ' disabled') + '>Claim</button>') + '</div>';
    }).join('');
    var chests = ['bronze', 'silver', 'gold'].map(function (t) {
      return '<button class="chestBtn" data-t="' + t + '"' + (c[t] ? '' : ' disabled') + '><span>' + M.CHESTS[t].icon + '</span><b>×' + c[t] + '</b><small>' + (c[t] ? 'Open' : M.CHESTS[t].name) + '</small></button>';
    }).join('');
    var lv = playerLevel();
    showModal({ title: 'Missions',
      body: '<p><b>Player level ' + lv.level + '</b> · ' + lv.into + ' / ' + lv.need + ' XP</p><div class="mbar big"><div style="width:' + Math.round(100 * lv.into / lv.need) + '%"></div></div>' +
        '<p style="margin-top:12px"><b>This week</b> <small>(new missions every Monday)</small></p>' + rows +
        '<p style="margin-top:12px"><b>Your chests</b></p><div class="row">' + chests + '</div>',
      buttons: [{ label: 'Done', cls: 'green', fn: refreshHome }], onClose: refreshHome,
      after: function (m) {
        m.querySelectorAll('.mission button').forEach(function (b) { b.onclick = function () {
          var ms2 = missions(), mi = ms2.list[+b.dataset.k];
          if (mi.claimed || M.missionProgress(mi, curStats()) < mi.target) return;
          mi.claimed = true; S.meta.chests[mi.chest]++; sfx.coin(); addXp(M.XP.mission); save(); missionsModal();
        }; });
        m.querySelectorAll('.chestBtn').forEach(function (b) { b.onclick = function () { if (S.meta.chests[b.dataset.t] > 0) openChestModal(b.dataset.t); }; });
      } });
  }
  function openChestModal(t) {
    if (S.meta.chests[t] <= 0) return;
    S.meta.chests[t]--;
    var r = M.openChest(t);
    S.profile.coins += r.coins;
    Object.keys(r.items).forEach(function (k) { S.inv[k] += r.items[k]; });
    save(); updateCoins();
    var items = Object.keys(r.items).map(function (k) { return '<span class="goal">' + INV_ICON[k] + ' ×' + r.items[k] + '</span>'; }).join('');
    showModal({ title: M.CHESTS[t].name,
      body: '<div class="chestOpen">' + M.CHESTS[t].icon + '</div><div class="chestLoot"><p class="coinLine">🪙 +' + r.coins + '</p><div class="row">' + items + '</div></div>',
      buttons: [{ label: chestCount() ? 'Back to missions' : 'Great!', cls: 'green', fn: missionsModal }], onClose: refreshHome,
      after: function () { sfx.win(); confetti(40); } });
  }

  // ---------- achievements ----------
  function totalStars() { var n = 0; for (var k in S.progress.stars) n += S.progress.stars[k]; return n; }
  var ACH = [
    { id: 'first', icon: '🍬', name: 'First Bite', desc: 'Win your first level', coins: 50, test: function (s) { return s.wins >= 1; } },
    { id: 'rocket', icon: '🚀', name: 'Liftoff', desc: 'Make a Rocket', coins: 30, test: function (s) { return s.rockets >= 1; } },
    { id: 'bomb', icon: '💣', name: 'Kaboom', desc: 'Make a Magic Bomb', coins: 30, test: function (s) { return s.bombs >= 1; } },
    { id: 'rainbow', icon: '🌈', name: 'Over the Rainbow', desc: 'Make a Rainbow Orb', coins: 50, test: function (s) { return s.rainbows >= 1; } },
    { id: 'combo', icon: '💥', name: 'Mega Blaster', desc: 'Fire a special combo', coins: 60, test: function (s) { return s.combos >= 1; } },
    { id: 'cascade', icon: '🌊', name: 'Sugar Rush', desc: 'Reach a 5× cascade', coins: 100, test: function (s) { return s.bestCascade >= 5; } },
    { id: 'specials', icon: '✨', name: 'Special Agent', desc: 'Make 50 special sweets', coins: 150, test: function (s) { return s.rockets + s.bombs + s.rainbows >= 50; } },
    { id: 'choc', icon: '🍫', name: 'Chocoholic', desc: 'Break 50 chocolate', coins: 100, test: function (s) { return s.choc >= 50; } },
    { id: 'acorn', icon: '🌰', name: 'Nut Collector', desc: 'Collect 10 acorns', coins: 100, test: function (s) { return s.acorns >= 10; } },
    { id: 'stars30', icon: '⭐', name: 'Starry Eyed', desc: 'Earn 30 stars', coins: 100, test: function () { return totalStars() >= 30; } },
    { id: 'stars90', icon: '🌟', name: 'Star Collector', desc: 'Earn 90 stars', coins: 300, test: function () { return totalStars() >= 90; } },
    { id: 'stars180', icon: '💫', name: 'Sweet Perfection', desc: 'Earn all 180 stars', coins: 800, test: function () { return totalStars() >= 180; } },
    { id: 'crates', icon: '🎁', name: 'Crate Cracker', desc: 'Crack open 30 candy crates', coins: 120, test: function (s) { return s.crates >= 30; } },
    { id: 'defuse', icon: '🧨', name: 'Bomb Squad', desc: 'Defuse 20 fizz bombs', coins: 150, test: function (s) { return s.defused >= 20; } },
    { id: 'w1', icon: '🌸', name: 'Meadow Hero', desc: 'Finish Sugarleaf Meadow', coins: 150, test: function () { return !!S.progress.stars[10]; } },
    { id: 'w2', icon: '🏔️', name: 'Peak Climber', desc: 'Finish Frostberry Peaks', coins: 200, test: function () { return !!S.progress.stars[20]; } },
    { id: 'w3', icon: '🍫', name: 'Vault Breaker', desc: 'Finish Cocoa Caverns', coins: 300, test: function () { return !!S.progress.stars[30]; } },
    { id: 'w4', icon: '🫧', name: 'Bay Sailor', desc: 'Finish Bubblegum Bay', coins: 300, test: function () { return !!S.progress.stars[40]; } },
    { id: 'w5', icon: '💥', name: 'Falls Hero', desc: 'Finish Fizzy Falls', coins: 400, test: function () { return !!S.progress.stars[50]; } },
    { id: 'w6', icon: '🌟', name: 'Master Baker', desc: 'Finish Starlight Bakery', coins: 600, test: function () { return !!S.progress.stars[60]; } },
    { id: 'daily', icon: '📅', name: 'Sweet Tooth', desc: 'Claim 7 daily rewards', coins: 150, test: function (s) { return s.dailyClaims >= 7; } }
  ];
  function checkAch() {
    ACH.forEach(function (a) {
      if (S.ach.done[a.id] || !a.test(S.stats)) return;
      S.ach.done[a.id] = Date.now(); S.profile.coins += a.coins;
      toast('🏆 <b>' + a.name + '</b> · +' + a.coins + ' 🪙'); sfx.coin();
    });
    save(); updateCoins();
  }

  // ---------- profile ----------
  var AVATARS = ['🧁', '🍭', '🍩', '🍪', '🧚', '🦄', '🐻', '🐰', '🦊', '🐼'];
  function renderProfile() {
    var s = S.stats, played = s.played || 0;
    $('#profAvatar').textContent = S.profile.avatar;
    $('#profName').value = S.profile.name;
    $('#avatarRow').innerHTML = AVATARS.map(function (a) { return '<button class="av' + (a === S.profile.avatar ? ' on' : '') + '" data-a="' + a + '">' + a + '</button>'; }).join('');
    var plv = playerLevel();
    var rows = [['Player level', plv.level + ' (' + plv.into + '/' + plv.need + ' XP)'], ['Levels completed', Object.keys(S.progress.stars).length + ' / ' + LEVELS.length], ['Stars', totalStars() + ' / ' + LEVELS.length * 3],
      ['Games played', played], ['Win rate', played ? Math.round(s.wins / played * 100) + '%' : '–'], ['Total score', s.totalScore.toLocaleString()],
      ['Matches made', s.matches.toLocaleString()], ['Rockets', s.rockets], ['Magic Bombs', s.bombs], ['Rainbow Orbs', s.rainbows], ['Combos fired', s.combos],
      ['Best cascade', s.bestCascade ? s.bestCascade + '×' : '–'], ['Ice melted', s.ice], ['Chocolate broken', s.choc], ['Acorns collected', s.acorns], ['Crates cracked', s.crates], ['Fizz bombs defused', s.defused], ['Boosters used', s.boosters]];
    $('#statGrid').innerHTML = rows.map(function (r) { return '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
    $('#achCount').textContent = Object.keys(S.ach.done).length + ' / ' + ACH.length;
    $('#achList').innerHTML = ACH.map(function (a) {
      var d = S.ach.done[a.id];
      return '<div class="ach' + (d ? ' got' : '') + '"><span class="ai">' + a.icon + '</span><div><b>' + a.name + '</b><small>' + a.desc + '</small></div><span class="ar">' + (d ? '✔' : '🪙' + a.coins) + '</span></div>';
    }).join('');
    $('#avatarRow').querySelectorAll('.av').forEach(function (b) { b.onclick = function () { sfx.click(); S.profile.avatar = b.dataset.a; save(); renderProfile(); }; });
  }

  // ---------- booster inventory / shop (coins only) ----------
  var PRICE = { hammer: 60, blast: 120, swap: 40, shuffle: 50, moves: 90 };
  var INV_DESC = { hammer: 'Smash any one sweet, lock or chocolate.', blast: 'Tap a sweet to clear every sweet of that colour.',
    swap: 'Swap any two sweets, anywhere. Doesn’t use a move.', shuffle: 'Mix up the whole board.', moves: '+5 moves (or +15 s on timed levels).' };
  function renderShop() {
    $('#shopList').innerHTML = Object.keys(PRICE).map(function (k) {
      return '<div class="shopItem"><span class="si">' + INV_ICON[k] + '</span><div class="sd"><b>' + INV_NAME[k] + ' <span class="own">×' + S.inv[k] + '</span></b><small>' + INV_DESC[k] + '</small></div>' +
        '<button class="btn small gold" data-k="' + k + '"' + (S.profile.coins < PRICE[k] ? ' disabled' : '') + '>🪙 ' + PRICE[k] + '</button></div>';
    }).join('');
    $('#shopList').querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k; if (S.profile.coins < PRICE[k]) { sfx.bad(); return; }
        S.profile.coins -= PRICE[k]; S.inv[k]++; save(); sfx.coin(); toast(INV_ICON[k] + ' +1 ' + INV_NAME[k]); renderShop(); updateCoins();
      };
    });
  }

  // ---------- map ----------
  var ENV = { w1: ['🌸', '☁️', '🦋', '🌼', '☁️', '🍄'], w2: ['❄️', '☁️', '❄️', '🫐', '☁️', '❄️'], w3: ['✨', '🫧', '🍫', '✨', '🔥', '🫧'],
    w4: ['🫧', '🐚', '⛵', '🫧', '🌊', '🐠'], w5: ['💧', '🫧', '🌈', '💧', '✨', '🫧'], w6: ['⭐', '🎂', '✨', '🌙', '🧁', '⭐'] };
  function renderMap() {
    $('#starTotal').textContent = totalStars() + ' / ' + LEVELS.length * 3;
    var m = $('#mapScroll'); m.innerHTML = '';
    WORLDS.forEach(function (w) {
      var sec = document.createElement('div'), locked = w.from > S.progress.unlocked;
      sec.className = 'world ' + w.cls + (locked ? ' locked' : '');
      var env = ENV[w.cls].map(function (e, k) { return '<span class="env" style="left:' + (6 + k * 15) + '%;top:' + (12 + (k * 37) % 76) + '%;animation-delay:' + (-k * 1.7) + 's">' + e + '</span>'; }).join('');
      var ws = 0; for (var q = w.from; q <= w.to; q++) ws += S.progress.stars[q] || 0;
      sec.innerHTML = env + '<h2>' + w.icon + ' ' + w.name + '</h2><p>' + w.story + '</p><div class="wstars">⭐ ' + ws + ' / ' + (w.to - w.from + 1) * 3 + '</div>';
      var path = document.createElement('div'); path.className = 'path';
      for (var n = w.from; n <= w.to; n++) {
        (function (n) {
          var l = LEVELS[n - 1], st = S.progress.stars[n] || 0, isLocked = n > S.progress.unlocked;
          var off = Math.sin((n - w.from) * 0.9) * 80;
          var b = document.createElement('button');
          b.className = 'node' + (l.boss ? ' boss' : '') + (isLocked ? ' locked' : st ? ' done' : '') + (n === S.progress.unlocked ? ' current' : '');
          b.style.transform = 'translateX(' + off + 'px)';
          b.setAttribute('aria-label', 'Level ' + n + (isLocked ? ' locked' : ''));
          b.innerHTML = (isLocked ? '🔒' : n) + (st ? '<span class="st">' + '★★★'.slice(0, st) + '<span style="opacity:.35">' + '★★★'.slice(st) + '</span></span>' : '') +
            (l.time ? '<span class="tag">⏱</span>' : l.boss ? '<span class="tag">BOSS</span>' : '');
          b.onclick = function () { sfx.click(); if (isLocked) { sfx.bad(); toast('🔒 Finish level ' + (n - 1) + ' first'); return; } openIntro(n); };
          path.appendChild(b);
          if (n < w.to) { var d = document.createElement('div'); d.className = 'dots'; d.style.transform = 'translateX(' + (off + Math.sin((n - w.from + 1) * 0.9) * 80) / 2 + 'px)'; path.appendChild(d); }
        })(n);
      }
      sec.appendChild(path); m.appendChild(sec);
    });
    setTimeout(function () { var c = m.querySelector('.node.current') || m.querySelector('.node:not(.locked)'); if (c) c.scrollIntoView({ block: 'center' }); }, 30);
  }
  function diffTag(l) { return '<span class="diff ' + l.difficulty.split(' ')[0] + '">' + l.difficulty + '</span>'; }
  function openIntro(n) {
    var l = LEVELS[n - 1], best = S.progress.best[n];
    var preview = new E.Game(l, 1);
    showModal({
      title: 'Level ' + n,
      body: '<p style="font-weight:800">' + goalDesc(l) + ' ' + diffTag(l) + '</p>' +
        '<div class="row" style="margin-top:10px">' + goalsHtml(preview.goals) + '</div>' +
        '<p>' + (l.time ? '⏱ ' + l.time + ' seconds' : '👆 ' + l.moves + ' moves') + ' · 🎯 target ' + l.target.toLocaleString() + (best ? ' · best ' + best.toLocaleString() : '') + '</p>' +
        (l.tip ? '<div class="tipBox"><span class="pip">🧚</span><span><b>Pip:</b> ' + l.tip + '</span></div>' : '') +
        (n >= 4 ? '<div class="startB"><b>Start with a special?</b><div class="row">' + Object.keys(START_COST).map(function (k) {
          return '<label class="sb"><input type="checkbox" data-k="' + k + '"><span>' + SP_ICON[k] + ' 🪙' + START_COST[k] + '</span></label>'; }).join('') + '</div><small>You have 🪙 ' + S.profile.coins.toLocaleString() + '</small></div>' : ''),
      buttons: [{ label: 'Play', cls: 'green', fn: function () {
        var picks = [], cost = 0;
        pendingPicks.forEach(function (k) { if (cost + START_COST[k] <= S.profile.coins) { picks.push(k); cost += START_COST[k]; } });
        if (cost) { S.profile.coins -= cost; S.stats.boosters += picks.length; save(); }
        startLevel(n, picks);
      } }],
      after: function (m) {
        pendingPicks = [];
        m.querySelectorAll('.sb input').forEach(function (cb) {
          cb.onchange = function () {
            var k = cb.dataset.k, cost = START_COST[k] + pendingPicks.reduce(function (a, p) { return a + START_COST[p]; }, 0);
            if (cb.checked && cost > S.profile.coins) { cb.checked = false; sfx.bad(); toast('Not enough coins'); return; }
            pendingPicks = Array.from(m.querySelectorAll('.sb input:checked')).map(function (x) { return x.dataset.k; }); sfx.click();
          };
        });
      }
    });
  }
  var START_COST = { rocket: 30, bomb: 50, rainbow: 90 }, pendingPicks = [];

  // ---------- particles (canvas, capped, rAF only while alive) ----------
  var pcan, pctx, parts = [], raf = 0, pdpr = 1, pPad = 0, MAXP = 260;
  function sizeCanvas() {
    pdpr = Math.min(2, window.devicePixelRatio || 1); pPad = cs;
    var W = cs * game.w + pPad * 2, H = cs * game.h + pPad * 2;
    pcan.width = W * pdpr; pcan.height = H * pdpr; pcan.style.width = W + 'px'; pcan.style.height = H + 'px';
    pcan.style.left = -pPad + 'px'; pcan.style.top = -pPad + 'px';
    pctx.setTransform(pdpr, 0, 0, pdpr, 0, 0);
  }
  function emit(x, y, color, n, spd) {
    n = S.settings.reduced ? Math.ceil(n / 3) : liteOn() ? Math.ceil(n / 2) : n;
    for (var k = 0; k < n; k++) {
      if (parts.length >= MAXP) parts.shift();
      var a = Math.random() * Math.PI * 2, v = (spd || 3) * (0.4 + Math.random());
      parts.push({ x: x + pPad, y: y + pPad, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, decay: 0.022 + Math.random() * 0.02,
        r: 2 + Math.random() * 3.5, c: color, star: Math.random() < 0.25 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    pctx.clearRect(0, 0, pcan.width, pcan.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.98; p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      pctx.globalAlpha = p.life; pctx.fillStyle = p.c;
      if (p.star) { pctx.fillRect(p.x - p.r, p.y - 0.8, p.r * 2, 1.6); pctx.fillRect(p.x - 0.8, p.y - p.r, 1.6, p.r * 2); }
      else { pctx.beginPath(); pctx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, 6.283); pctx.fill(); }
    }
    pctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }

  // ---------- game state ----------
  var game = null, cur = 0, cs = 48, busy = false, over = false, paused = false, mode = null, swapFirst = null;
  var tileEls = new Map(), bgEls = [], lockEls = [], chocEls = [], crateEls = [], iceEls = [], spawnFrom = new Map(), born = new Set();
  var timerId = null, hintId = null, selected = null, down = null, levelStats = null, movesMade = 0, landing = [];
  var board, tilesL, overlayL, fxL, boardWrap;
  function stopTimers() { if (timerId) clearInterval(timerId); timerId = null; if (hintId) clearTimeout(hintId); hintId = null; }
  function tr(x, y) { return 'translate(' + x * cs + 'px,' + y * cs + 'px)'; }

  function startLevel(n, picks) {
    cur = n; var l = LEVELS[n - 1]; movesMade = 0;
    game = new E.Game(l, window.__svSeed);
    busy = false; over = false; paused = false; mode = null; selected = null; swapFirst = null;
    levelStats = { counted: false, specials: 0, combos: 0 };
    show('game');
    $('#gameBg').className = 'bg ' + WORLDS.filter(function (w) { return n >= w.from && n <= w.to; })[0].cls;
    $('#lvlNum').textContent = n;
    $('#targetVal').textContent = l.target.toLocaleString();
    layoutBoard(); renderBoosters(); stopTimers(); probeFps();
    if (picks && picks.length) {
      setTimeout(function () { picks.forEach(function (k) { game.placeStart(k); }); drain(); render(); sfx.create(); banner('Start boosters ready!'); }, 350);
    }
    if (l.time) timerId = setInterval(function () {
      if (over || paused || modalOpen() || current !== 'game') return;
      game.timeLeft = Math.max(0, game.timeLeft - 1); renderHud();
      if (game.timeLeft <= 5 && game.timeLeft > 0) tone(1200, 0.05, 'square', 0.05);
      if (game.timeLeft <= 0 && !busy) checkEnd();
    }, 1000);
    idleReset();
  }

  function layoutBoard() {
    if (!game) return;
    var land = window.innerWidth > window.innerHeight && window.innerHeight < 600;
    var aw, ah;
    if (land) { aw = window.innerWidth - $('.side').offsetWidth - 40; ah = window.innerHeight - 36; }
    else { aw = Math.min(window.innerWidth - 28, 600); ah = window.innerHeight - ($('.hud').offsetHeight + $('.goals').offsetHeight + $('.boosters').offsetHeight + 44); }
    cs = Math.max(26, Math.floor(Math.min(aw / game.w, ah / game.h, 72)));
    document.documentElement.style.setProperty('--cs', cs + 'px');
    board.style.width = cs * game.w + 'px'; board.style.height = cs * game.h + 'px';
    Array.from(board.querySelectorAll('.cell')).forEach(function (e) { e.remove(); });
    tilesL.innerHTML = ''; overlayL.innerHTML = ''; fxL.innerHTML = '';
    tileEls.clear(); bgEls = []; lockEls = []; chocEls = []; crateEls = []; iceEls = []; parts.length = 0;
    game.cells.forEach(function (c, i) {
      var p = game.xy(i);
      var el = document.createElement('div'); el.style.transform = tr(p[0], p[1]); board.insertBefore(el, tilesL); bgEls.push(el);
      var ie = document.createElement('div'); ie.className = 'iceov'; ie.style.transform = tr(p[0], p[1]); overlayL.appendChild(ie); iceEls.push(ie);
      var ch = document.createElement('div'); ch.className = 'choc'; ch.style.transform = tr(p[0], p[1]); overlayL.appendChild(ch); chocEls.push(ch);
      var lk = document.createElement('div'); lk.className = 'lock'; lk.style.transform = tr(p[0], p[1]); overlayL.appendChild(lk); lockEls.push(lk);
      var cr = document.createElement('div'); cr.className = 'crate'; cr.style.transform = tr(p[0], p[1]); overlayL.appendChild(cr); crateEls.push(cr);
    });
    sizeCanvas();
    board.classList.add('noanim'); render(); void board.offsetWidth; board.classList.remove('noanim');
  }

  function render() {
    game.cells.forEach(function (c, i) {
      var p = game.xy(i), el = bgEls[i];
      var cls = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '') + (c.hole ? ' hole' : '') + (c.ice === 1 ? ' ice1' : c.ice === 2 ? ' ice2' : '');
      if (el.dataset.k !== cls) { el.className = cls; el.dataset.k = cls; }
      var lk = lockEls[i];
      if (c.lock) { lk.style.display = 'block'; lk.classList.remove('breaking'); } else if (!lk.classList.contains('breaking')) lk.style.display = 'none';
      var ie = iceEls[i], icls = 'iceov' + (c.ice ? ' i' + c.ice : '');
      if (ie.className !== icls) ie.className = icls;
      var cr = crateEls[i];
      if (!cr.classList.contains('crack')) { if (c.crate) { cr.style.display = 'block'; cr.className = 'crate l' + c.crate; } else cr.style.display = 'none'; }
      var ch = chocEls[i];
      if (ch.classList.contains('crack')) return;
      if (c.choc) { ch.style.display = 'block'; ch.className = 'choc' + (c.choc === 2 ? ' dark' : ''); } else ch.style.display = 'none';
    });
    var seen = new Set();
    game.cells.forEach(function (c, i) {
      if (!c.tile) return;
      var t = c.tile, p = game.xy(i); seen.add(t.id);
      var el = tileEls.get(t.id);
      if (!el) {
        el = document.createElement('div'); el.innerHTML = '<div class="candy"></div>';
        tilesL.appendChild(el); tileEls.set(t.id, el);
        el.style.transform = tr(p[0], spawnFrom.has(t.id) ? spawnFrom.get(t.id) : p[1]);
        void el.offsetWidth;
      }
      var prevI = el.dataset.i != null ? +el.dataset.i : null;
      if (prevI != null && prevI !== i && game.xy(prevI)[1] < p[1] && !S.settings.reduced) landing.push(el);
      else if (prevI == null && spawnFrom.has(t.id) && !S.settings.reduced) landing.push(el);
      el.dataset.i = i;
      var cc = (t.kind === 'ingredient' ? 'tile ing' : 'tile' + (t.special ? ' sp-' + t.special : '')) +
        (selected === i || swapFirst === i ? ' sel' : '') + (born.has(t.id) ? ' born' : '');
      if (el.className !== cc) el.className = cc;
      var candy = el.firstChild, ccl = 'candy' + (t.kind === 'candy' ? ' c' + t.color : '');
      if (candy.className !== ccl) candy.className = ccl;
      if (t.kind === 'ingredient' && !candy.textContent) candy.textContent = '🌰';
      var fz = el.querySelector('.fz');
      if (t.fuse) { if (!fz) { fz = document.createElement('span'); el.appendChild(fz); } fz.className = 'fz' + (t.fuse <= 3 ? ' hot' : ''); fz.textContent = t.fuse; }
      else if (fz) fz.remove();
      el.style.transform = tr(p[0], p[1]);
    });
    tileEls.forEach(function (el, id) { if (!seen.has(id)) { el.remove(); tileEls.delete(id); } });
    if (landing.length) {
      var land = landing; landing = [];
      setTimeout(function () { land.forEach(function (el) { el.classList.remove('land'); void el.offsetWidth; el.classList.add('land'); }); }, T(250));
    }
    spawnFrom.clear();
    if (born.size) setTimeout((function (ids) { return function () { ids.forEach(function (id) { var e = tileEls.get(id); if (e) e.classList.remove('born'); }); }; })(Array.from(born)), 500);
    born.clear();
    renderHud();
  }

  function renderHud() {
    var l = game.level, mv = $('#movesBox');
    $('#movesLbl').textContent = l.time ? 'Time' : 'Moves';
    $('#movesVal').textContent = l.time ? game.timeLeft : game.moves;
    mv.classList.toggle('warn', l.time ? game.timeLeft <= 10 : game.moves <= 3);
    $('#scoreVal').textContent = game.score.toLocaleString();
    var top = l.stars[2];
    $('#starFill').style.width = Math.min(100, game.score / top * 100) + '%';
    var mk = $('#starMarks');
    if (mk.dataset.l != cur) { mk.dataset.l = cur; mk.innerHTML = l.stars.map(function (s) { return '<span class="mk" style="left:' + (s / top * 100) + '%">⭐</span>'; }).join(''); }
    Array.from(mk.children).forEach(function (e, k) { var on = game.score >= l.stars[k]; if (on && !e.classList.contains('on')) { e.classList.add('on'); sfx.star(k); starTrail(e); } else if (!on) e.classList.remove('on'); });
    $('#goalRow').innerHTML = goalsHtml(game.goals, game);
  }

  var BOOSTERS = ['hammer', 'blast', 'swap', 'shuffle', 'moves'];
  function renderBoosters() {
    BOOSTERS.forEach(function (k) {
      var el = $('#b-' + k);
      el.querySelector('.cnt').textContent = S.inv[k];
      el.classList.toggle('empty', S.inv[k] <= 0);
      el.classList.toggle('active', mode === k);
    });
    $('#b-moves .nm').textContent = game && game.level.time ? '+15 s' : '+5';
    var hint = { hammer: '🔨 Tap a sweet, lock or chocolate to smash it', blast: '🎨 Tap a sweet to clear that colour', swap: swapFirst == null ? '🔄 Tap the first sweet to swap' : '🔄 Now tap the second sweet' }[mode];
    $('#modeHint').classList.toggle('hidden', !hint);
    $('#modeText').textContent = hint || '';
  }

  // ---------- effects ----------
  function center(i) { var p = game.xy(i); return [(p[0] + 0.5) * cs, (p[1] + 0.5) * cs]; }
  function fxEl(cls, css, life) {
    var e = document.createElement('div'); e.className = cls;
    for (var k in css) e.style.setProperty(k, css[k]);
    fxL.appendChild(e); setTimeout(function () { e.remove(); }, life || 700); return e;
  }
  function burst(i, color, n) { var c = center(i); emit(c[0], c[1], color >= 0 ? COLORS[color] : color === -2 ? '#7a4416' : '#ffffff', n || 8, 3); }
  function popTile(id, i, color, collected) {
    var el = tileEls.get(id);
    if (el) { tileEls.delete(id); el.classList.add(collected ? 'collected' : 'pop'); setTimeout(function () { el.remove(); }, 520); }
    burst(i, collected ? -1 : color, collected ? 18 : 9);
  }
  function floatText(x, y, txt) { if (S.settings.reduced) return; fxEl('floatScore', { left: x + 'px', top: y + 'px' }, 950).textContent = txt; }
  var COMBO_WORDS = ['', '', 'Sweet!', 'Tasty!', 'Delicious!', 'Divine!', 'Sugar Rush!'];
  function comboText(t) { var e = document.createElement('div'); e.className = 'comboTxt'; e.textContent = t; boardWrap.appendChild(e); setTimeout(function () { e.remove(); }, 1050); }
  function banner(t) { var e = document.createElement('div'); e.className = 'banner'; e.textContent = t; boardWrap.appendChild(e); setTimeout(function () { e.remove(); }, 1250); }
  function specialFx(e) {
    var p = game.xy(e.idx), c = center(e.idx), W = cs * game.w, H = cs * game.h;
    if (e.special === 'row') fxEl('beam', { left: '0px', top: (p[1] * cs + cs * 0.2) + 'px', width: W + 'px', height: cs * 0.6 + 'px' }, 450);
    else if (e.special === 'col') fxEl('beam v', { top: '0px', left: (p[0] * cs + cs * 0.2) + 'px', height: H + 'px', width: cs * 0.6 + 'px' }, 450);
    else if (e.special === 'bomb') fxEl('ring', { left: (c[0] - cs * 1.6) + 'px', top: (c[1] - cs * 1.6) + 'px', width: cs * 3.2 + 'px', height: cs * 3.2 + 'px' }, 500);
    else if (e.special === 'rainbow') fxEl('flash', {}, 550);
    emit(c[0], c[1], '#fff6c0', 16, 5);
  }
  var COMBO_NAME = { cross: 'Mega Blast!', bigcross: 'Mega Blast XL!', star: 'Star Crusher!', rainbow: 'Rainbow Magic!', mega: 'Colour Explosion!', blast: 'Colour Blast!' };
  function comboFx(e) {
    var p = game.xy(e.idx), c = center(e.idx), W = cs * game.w, H = cs * game.h, k;
    if (e.kind === 'cross' || e.kind === 'bigcross') {
      var r = e.kind === 'bigcross' ? 1 : 0;
      for (k = -r; k <= r; k++) {
        fxEl('beam', { left: '0px', top: ((p[1] + k) * cs + cs * 0.15) + 'px', width: W + 'px', height: cs * 0.7 + 'px' }, 450);
        fxEl('beam v', { top: '0px', left: ((p[0] + k) * cs + cs * 0.15) + 'px', height: H + 'px', width: cs * 0.7 + 'px' }, 450);
      }
    } else if (e.kind === 'star') fxEl('ring', { left: (c[0] - cs * 2.6) + 'px', top: (c[1] - cs * 2.6) + 'px', width: cs * 5.2 + 'px', height: cs * 5.2 + 'px' }, 500);
    else fxEl('flash', {}, 600);
    banner(COMBO_NAME[e.kind] || (e.kind.indexOf('rainbow-') === 0 ? 'Colour Explosion!' : 'Mega Blast!'));
    emit(c[0], c[1], '#ffffff', 30, 6);
    sfx.combo();
  }
  // a star flies from the board to the star bar when a star threshold is reached (2026-11-15)
  function starTrail(target) {
    if (S.settings.reduced || !board) return;
    var b = board.getBoundingClientRect(), t = target.getBoundingClientRect();
    var s = document.createElement('div'); s.className = 'starFly'; s.textContent = '⭐';
    s.style.left = (b.left + b.width / 2) + 'px'; s.style.top = (b.top + b.height / 2) + 'px';
    document.body.appendChild(s); void s.offsetWidth;
    s.style.transform = 'translate(' + (t.left + t.width / 2 - b.left - b.width / 2) + 'px,' + (t.top + t.height / 2 - b.top - b.height / 2) + 'px) scale(.6) rotate(360deg)';
    s.style.opacity = '0.9';
    setTimeout(function () { s.remove(); }, 750);
  }
  function shake() { if (S.settings.reduced) { buzz(30); return; } boardWrap.classList.remove('shake'); void boardWrap.offsetWidth; boardWrap.classList.add('shake'); buzz(35); }

  function drain() {
    var evs = game.events.splice(0), sh = false, sp = false, st = S.stats;
    evs.forEach(function (e) {
      switch (e.type) {
        case 'match':
          sfx.match(e.cascade); st.matches += e.groups.length; if (e.cascade > st.bestCascade) st.bestCascade = e.cascade;
          if (e.cascade >= 2) comboText(COMBO_WORDS[Math.min(e.cascade, 6)]);
          e.groups.forEach(function (g) {
            var sx = 0, sy = 0; g.cells.forEach(function (i) { var c = center(i); sx += c[0]; sy += c[1]; });
            floatText(sx / g.cells.length, sy / g.cells.length, '+' + g.cells.length * 60 * e.cascade);
            if (!S.settings.reduced && !liteOn()) fxEl('impact', { left: (sx / g.cells.length - cs) + 'px', top: (sy / g.cells.length - cs) + 'px', width: cs * 2 + 'px', height: cs * 2 + 'px', '--ic': COLORS[g.color] || '#fff' }, 320);
          });
          break;
        case 'clear': popTile(e.id, e.idx, e.color); break;
        case 'special': specialFx(e); sh = true; sp = true; break;
        case 'combo': comboFx(e); sh = true; if (e.kind !== 'blast') { st.combos++; if (levelStats) levelStats.combos++; } break;
        case 'create': born.add(e.id); sfx.create(); if (levelStats) levelStats.specials++; if (e.special === 'bomb') st.bombs++; else if (e.special === 'rainbow') st.rainbows++; else st.rockets++; break;
        case 'convert': born.add(e.id); break;
        case 'spawn': spawnFrom.set(e.id, e.from); break;
        case 'collect': popTile(e.id, e.idx, -1, true); sfx.collect(); st.acorns++; var c = center(e.idx); floatText(c[0], c[1], '+1000'); break;
        case 'unlock': (function (lk, idx) { lk.classList.add('breaking'); setTimeout(function () { lk.classList.remove('breaking'); lk.style.display = game.cells[idx] && game.cells[idx].lock ? 'block' : 'none'; }, 360); })(lockEls[e.idx], e.idx); sfx.unlock(); break;
        case 'ice': var be = bgEls[e.idx]; be.classList.remove('ice-hit'); void be.offsetWidth; be.classList.add('ice-hit'); sfx.ice(); burst(e.idx, -1, 6); if (e.left === 0) st.ice++; break;
        case 'choc':
          (function (ch, idx, left) {
            ch.style.display = 'block'; ch.className = 'choc' + (left >= 1 ? ' dark' : '') + ' crack';
            setTimeout(function () { var cc = game.cells[idx]; ch.className = 'choc' + (cc && cc.choc === 2 ? ' dark' : ''); ch.style.display = cc && cc.choc ? 'block' : 'none'; }, 380);
          })(chocEls[e.idx], e.idx, e.left);
          sfx.choc(); burst(e.idx, -2, 10); if (e.left === 0) st.choc++; break;
        case 'chocGrow': popTile(e.id, e.idx, -2); banner('The chocolate grew!'); break;
        case 'shuffle': banner('No moves – Shuffle!'); break;
        case 'crate':
          (function (cr, idx) { cr.classList.add('crack'); setTimeout(function () { cr.classList.remove('crack'); var cc = game.cells[idx]; cr.className = 'crate' + (cc && cc.crate ? ' l' + cc.crate : ''); cr.style.display = cc && cc.crate ? 'block' : 'none'; }, 360); })(crateEls[e.idx], e.idx);
          sfx.choc(); burst(e.idx, 0, 8); if (e.left === 0) { st.crates++; burst(e.idx, -1, 12); } break;
        case 'defuse': st.defused++; sfx.collect(); var dc = center(e.idx); floatText(dc[0], dc[1], 'Defused!'); break;
        case 'fuseBoom': var bc = center(e.idx); fxEl('ring', { left: (bc[0] - cs * 2) + 'px', top: (bc[1] - cs * 2) + 'px', width: cs * 4 + 'px', height: cs * 4 + 'px' }, 600); emit(bc[0], bc[1], '#ff5a3c', 40, 7); sh = true; sfx.combo(); break;
      }
    });
    if (sp) sfx.special();
    if (sh) shake();
  }

  // ---------- turn flow ----------
  async function resolveLoop(preferred, alreadyCleared) {
    busy = true;
    if (alreadyCleared) { drain(); render(); await wait(320); }
    else if (preferred) { game.matchStep(preferred); drain(); render(); await wait(270); }
    for (var g = 0; g < 80; g++) {
      game.collapse(); drain(); render(); sfx.fall(); await wait(310);
      if (!game.matchStep(null)) break;
      drain(); render(); await wait(270);
    }
    var hadShuffle = !game.isWon() && !game.hasMoves();
    game.endTurn(); drain(); render();
    if (hadShuffle) await wait(500);
    busy = false; idleReset(); checkEnd();
  }
  async function doSwap(a, b) {
    if (busy || over || mode) return;
    if (!game.canSwap(a, b)) { sfx.bad(); return; }
    busy = true; clearHint();
    var ea = tileEls.get(game.cells[a].tile.id), eb = tileEls.get(game.cells[b].tile.id);
    var pa = game.xy(a), pb = game.xy(b);
    sfx.swap();
    ea.style.transform = tr(pb[0], pb[1]); eb.style.transform = tr(pa[0], pa[1]);
    await wait(180);
    var res = game.trySwap(a, b);
    if (!res.ok) { sfx.bad(); buzz(15); render(); await wait(200); busy = false; idleReset(); return; }
    movesMade++;
    await resolveLoop(res.combo ? null : [a, b], res.combo);
  }

  function checkEnd() {
    if (over || busy) return;
    if (game.isWon()) finishWin();
    else if (game.isLost()) showLose();
  }
  function countGame(won, stars, firstClear) {
    if (levelStats.counted) return; levelStats.counted = true;
    S.stats.played++; if (won) S.stats.wins++; else S.stats.losses++;
    addXp(M.xpForGame({ won: won, stars: stars || 0, firstClear: !!firstClear, specials: levelStats.specials, combos: levelStats.combos }));
  }
  async function finishWin() {
    over = true; stopTimers(); clearHint(); mode = null; swapFirst = null; renderBoosters();
    var left = game.level.time ? 0 : game.moves;
    if (left > 0) await sugarRushFinale();
    var stars = game.stars(), prev = S.progress.stars[cur] || 0, first = !prev;
    S.progress.stars[cur] = Math.max(prev, stars);
    var newBest = game.score > (S.progress.best[cur] || 0);
    if (newBest) S.progress.best[cur] = game.score;
    if (cur >= S.progress.unlocked && cur < LEVELS.length) S.progress.unlocked = cur + 1;
    var coins = 10 + stars * 10 + left * 2 + (first ? 20 : 0);
    S.profile.coins += coins; S.stats.totalScore += game.score;
    var xpBefore = S.profile.xp;
    countGame(true, stars, first); save(); sfx.win(); confetti(70);
    var xpGain = S.profile.xp - xpBefore;
    var isLast = cur === LEVELS.length, worldDone = WORLDS.filter(function (w) { return w.to === cur; })[0];
    showModal({
      title: worldDone && first ? worldDone.name + ' saved!' : 'Level ' + cur + ' complete!',
      body: '<div class="bigStars"><span>⭐</span><span>⭐</span><span>⭐</span></div><p style="font-size:28px;font-weight:900;margin:0">' + game.score.toLocaleString() + '</p>' +
        (newBest && prev ? '<p class="newBest">New best!</p>' : '') +
        '<p class="coinLine">🪙 +<span id="coinCount">0</span>' + (first ? ' <small>(incl. first-clear bonus)</small>' : '') + ' · <span class="xpGain">+' + xpGain + ' XP</span></p>' +
        '<div class="pipCheer">🧚</div>' +
        (isLast && first ? '<p>🧚 Pip has brought every magic sweet home, and Grumble has promised to share from now on. More worlds are coming soon!</p>' : ''),
      buttons: (isLast ? [] : [{ label: 'Next level', cls: 'green', fn: function () { show('map'); renderMap(); openIntro(cur + 1); } }])
        .concat([{ label: 'Replay', cls: 'blue', fn: function () { startLevel(cur); } }, { label: 'World map', cls: '', fn: goMap }]),
      onClose: goMap,
      after: function (m) {
        m.querySelectorAll('.bigStars span').forEach(function (s, i) { if (i < stars) setTimeout(function () { s.classList.add('on'); sfx.star(i); }, T(350 + i * 300)); });
        var cc = m.querySelector('#coinCount'), v = 0, stepN = Math.max(1, Math.round(coins / 20));
        var iv = setInterval(function () { v = Math.min(coins, v + stepN); if (cc) cc.textContent = v; if (v >= coins) { clearInterval(iv); sfx.coin(); updateCoins(); } }, 40);
        setTimeout(checkAch, 1200);
      }
    });
  }
  // Sugar Rush finale: leftover moves become rockets, then everything fires (2026-11-15)
  async function sugarRushFinale() {
    busy = true; banner('Sugar Rush!');
    await wait(700);
    for (var k = 0; k < 15; k++) {
      var i = game.finaleConvert(); if (i == null) break;
      drain(); render(); tone(660 + k * 60, 0.08, 'triangle', 0.12); await wait(110);
    }
    if (game.moves > 0) { game.score += game.moves * 250; game.moves = 0; }
    await wait(300);
    for (var round = 0; round < 6; round++) {
      if (!game.finaleFire()) break;
      drain(); render(); await wait(380);
      for (var g = 0; g < 40; g++) { game.collapse(); drain(); render(); await wait(260); if (!game.matchStep(null)) break; drain(); render(); await wait(240); }
    }
    busy = false;
  }
  function showLose() {
    over = true; clearHint(); mode = null; swapFirst = null; renderBoosters(); sfx.lose(); buzz([40, 60, 40]);
    var timed = !!game.level.time, btns = [];
    if (S.inv.moves > 0) btns.push({ label: (timed ? '+15 seconds' : '+5 moves') + ' (' + S.inv.moves + ' left)', cls: 'gold', fn: function () { S.inv.moves--; S.stats.boosters++; save(); game.addMoves(); over = false; renderHud(); renderBoosters(); idleReset(); } });
    btns.push({ label: 'Try again', cls: 'green', fn: function () { countGame(false); save(); startLevel(cur); } });
    btns.push({ label: 'World map', cls: 'blue', fn: function () { countGame(false); save(); goMap(); } });
    if (game.exploded) btns = btns.filter(function (b) { return b.cls !== 'gold'; });
    showModal({ title: game.exploded ? 'A fizz bomb popped!' : timed ? 'Time’s up!' : 'Out of moves!', body: '<div class="pipSad">🧚</div><p>So close! Still to do:</p><div class="row">' + goalsHtml(game.goals, game) + '</div>' + '<div class="tipBox"><span class="pip">💡</span><span>' + failReason() + '</span></div>',
      buttons: btns, onClose: function () { countGame(false); save(); goMap(); } });
  }
  // Clear failure explanation: what blocked the player most, and one concrete tip (2026-11-15)
  function failReason() {
    if (game.exploded) return 'A fizz bomb reached 0. Bombs with a red counter (3 or less) need clearing first. Any match that includes the bomb defuses it.';
    var worst = null, ratio = -1;
    game.goals.forEach(function (g) { var left = game.goalLeft(g), r = left / Math.max(1, g.type === 'score' ? g.target : g.target || 1); if (left > 0 && r > ratio) { ratio = r; worst = g; } });
    if (!worst) return 'You were close. Try again!';
    var left = game.goalLeft(worst);
    var tips = {
      score: 'You needed ' + left.toLocaleString() + ' more points. Matches near the bottom cause more cascades, and specials score big.',
      color: left + ' ' + COLOR_NAMES[worst.color] + ' sweets were still needed. A Rainbow Orb swapped with that colour clears them all at once.',
      ice: left + ' ice tiles were left. Rockets aimed along the icy rows melt a whole line in one go.',
      locks: left + ' locks were left. Locked sweets can’t move, so make matches that run through them.',
      ingredients: left + ' acorns still had to reach the bottom. Clear the sweets directly underneath them.',
      chocolate: left + ' chocolate squares were left. Break at least one each turn, or it grows.',
      crates: left + ' crate squares were left. Bombs and Rockets next to crates hit several at once.',
      fuses: left + ' fizz bombs still needed defusing. Include them in your matches.',
      make: 'You still needed ' + left + ' ' + SP_NAME[worst.special] + '. Look for 4 in a row, L/T shapes or 5 in a row before making small matches.',
      combo: 'You still needed ' + left + ' combo(s). Build two specials next to each other, then swap them together.'
    };
    return tips[worst.type] || 'Try again: the 💡 hint shows the best move for your goals.';
  }
  function goMap() { stopTimers(); show('map'); renderMap(); }
  function confetti(n) {
    if (S.settings.reduced) n = Math.round(n / 4);
    for (var k = 0; k < n; k++) {
      var c = document.createElement('div'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = COLORS[k % 6];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; c.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(c); setTimeout((function (c) { return function () { c.remove(); }; })(c), 3800);
    }
  }

  // ---------- hints ----------
  // Smart hint (2026-11-15): best move for this level's goals, simulated by the engine
  function smartMove() { var r = game.suggestMove(liteOn() ? 16 : 40); return r ? r.move : game.findMove(); }
  function showHint(mv) { mv.forEach(function (i) { var t = game.cells[i].tile, el = t && tileEls.get(t.id); if (el) { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); } }); }
  function clearHint() { if (hintId) clearTimeout(hintId); hintId = null; if (tilesL) tilesL.querySelectorAll('.hint').forEach(function (e) { e.classList.remove('hint'); }); var h = document.getElementById('hand'); if (h) h.remove(); }
  function idleReset() {
    clearHint();
    var tutorial = cur <= 2 && movesMade < 3;
    hintId = setTimeout(function () {
      if (busy || over || !game || mode) return;
      if (!tutorial && S.settings.autoHint === false) return;
      var mv = smartMove(); if (!mv) return;
      showHint(mv);
      if (tutorial) {   // animated hand showing the swipe
        var a = center(mv[0]), b = center(mv[1]), h = document.createElement('div');
        h.id = 'hand'; h.className = 'hand'; h.textContent = '👆';
        h.style.setProperty('--x0', a[0] + 'px'); h.style.setProperty('--y0', a[1] + 'px');
        h.style.setProperty('--x1', b[0] + 'px'); h.style.setProperty('--y1', b[1] + 'px');
        fxL.appendChild(h);
      }
    }, tutorial ? 700 : 6000);
  }

  // ---------- input (pointer events: mouse, touch, pen) ----------
  function cellAt(ev) {
    var r = board.getBoundingClientRect();
    var x = Math.floor((ev.clientX - r.left) / cs), y = Math.floor((ev.clientY - r.top) / cs);
    if (x < 0 || y < 0 || x >= game.w || y >= game.h) return null;
    var i = game.idx(x, y); return game.cells[i].hole ? null : i;
  }
  function adjacent(a, b) { var pa = game.xy(a), pb = game.xy(b); return Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) === 1; }
  function bindInput() {
    board.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); ac();
      if (busy || over) return;
      var i = cellAt(ev); if (i == null) return;
      down = { i: i, x: ev.clientX, y: ev.clientY, moved: false };
      var pt = game.cells[i].tile, pel = pt && tileEls.get(pt.id); if (pel) { pel.classList.add('press'); down.el = pel; }
      try { board.setPointerCapture(ev.pointerId); } catch (e) {}
      idleReset();
    });
    board.addEventListener('pointermove', function (ev) {
      if (!down || down.moved || busy || mode) return;
      var dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      if (Math.hypot(dx, dy) < cs * 0.35) return;
      down.moved = true; if (down.el) down.el.classList.remove('press');
      var p = game.xy(down.i), nx = p[0], ny = p[1];
      if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
      if (nx < 0 || ny < 0 || nx >= game.w || ny >= game.h) return;
      if (selected != null) { selected = null; render(); }
      doSwap(down.i, game.idx(nx, ny));
    });
    board.addEventListener('pointerup', function () {
      if (!down) return;
      var d = down; down = null; if (d.el) d.el.classList.remove('press');
      if (d.moved || busy || over) return;
      if (mode) { useBoosterOn(d.i); return; }
      if (selected != null && selected !== d.i && adjacent(selected, d.i)) { var s = selected; selected = null; render(); doSwap(s, d.i); }
      else if (selected === d.i) { selected = null; render(); }
      else { selected = d.i; render(); }
    });
    board.addEventListener('pointercancel', function () { if (down && down.el) down.el.classList.remove('press'); down = null; });
    $('#game').addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  }

  // ---------- boosters ----------
  async function useBoosterOn(i) {
    if (mode === 'hammer') {
      if (!game.hammer(i)) { sfx.bad(); return; }
      spend('hammer'); sfx.special(); shake();
      var c = center(i); fxEl('ring', { left: (c[0] - cs * 0.8) + 'px', top: (c[1] - cs * 0.8) + 'px', width: cs * 1.6 + 'px', height: cs * 1.6 + 'px' }, 500);
      await resolveLoop(null, true);
    } else if (mode === 'blast') {
      if (!game.colourBlast(i)) { sfx.bad(); toast('Pick a normal sweet'); return; }
      spend('blast');
      await resolveLoop(null, true);
    } else if (mode === 'swap') {
      var ct = game.cells[i];
      if (!ct.tile || ct.lock || ct.choc) { sfx.bad(); return; }
      if (swapFirst == null) { swapFirst = i; sfx.click(); render(); renderBoosters(); return; }
      if (swapFirst === i) { swapFirst = null; render(); renderBoosters(); return; }
      var a = swapFirst, r = game.magicSwap(a, i);
      if (!r.ok) { sfx.bad(); return; }
      swapFirst = null; spend('swap'); sfx.swap();
      if (r.matched) await resolveLoop([a, i], false);
      else { render(); game.endTurn(); drain(); render(); idleReset(); }
    }
  }
  function spend(k) { S.inv[k]--; S.stats.boosters++; mode = null; save(); renderBoosters(); }
  function bindBoosters() {
    BOOSTERS.forEach(function (k) {
      $('#b-' + k).onclick = function () {
        if (busy || over) return; sfx.click();
        if (S.inv[k] <= 0) { emptyBooster(k); return; }
        if (k === 'shuffle') { mode = null; swapFirst = null; spend('shuffle'); game.shuffle(); game.events.length = 0; banner('Shuffle Magic!'); sfx.special(); render(); idleReset(); return; }
        if (k === 'moves') { mode = null; swapFirst = null; spend('moves'); game.addMoves(); banner(game.level.time ? '+15 seconds!' : '+5 moves!'); sfx.create(); renderHud(); return; }
        mode = mode === k ? null : k; swapFirst = null; selected = null; clearHint(); render(); renderBoosters();
      };
    });
    $('#modeCancel').onclick = function () { sfx.click(); mode = null; swapFirst = null; render(); renderBoosters(); };
  }
  function emptyBooster(k) {
    var canBuy = S.profile.coins >= PRICE[k];
    paused = true;
    showModal({ title: 'Out of ' + INV_NAME[k], body: '<p>' + INV_DESC[k] + '</p><p>Buy one for 🪙 ' + PRICE[k] + '? You have 🪙 ' + S.profile.coins.toLocaleString() + '.</p><p style="font-size:12px;opacity:.7">Coins are earned by playing. There are no real-money purchases.</p>',
      buttons: [{ label: 'Buy for 🪙 ' + PRICE[k], cls: 'gold', disabled: !canBuy, fn: function () { paused = false; S.profile.coins -= PRICE[k]; S.inv[k]++; save(); sfx.coin(); renderBoosters(); updateCoins(); } },
        { label: 'Not now', cls: 'blue', fn: function () { paused = false; } }], onClose: function () { paused = false; } });
  }

  // ---------- settings / pause ----------
  function settingsModal(onBack) {
    function slider(key, label) { return '<div class="setRow">' + label + '<input type="range" min="0" max="100" value="' + Math.round(S.settings[key] * 100) + '" data-k="' + key + '" aria-label="' + label + '"></div>'; }
    function toggle(key, label) { return '<div class="setRow">' + label + '<button class="toggle' + (S.settings[key] ? ' on' : '') + '" data-k="' + key + '" aria-label="' + label + '"></button></div>'; }
    showModal({
      title: 'Settings',
      body: slider('sfxVol', '🔊 Sound') + slider('musicVol', '🎵 Music') + toggle('haptics', '📳 Vibration') + toggle('reduced', '🐢 Reduced motion') + toggle('autoHint', '💡 Auto hints after 6 s') +
        '<div class="setRow">⚡ Lite graphics<button class="toggle' + (liteOn() ? ' on' : '') + '" data-k="lite" aria-label="Lite graphics"></button></div>' +
        (persistent ? '' : '<p class="warnNote">Your browser is blocking storage here, so progress lasts only for this session.</p>') +
        '<p style="font-size:12px;opacity:.7;margin-top:10px">Sweetverse prototype v0.6 · 15 Nov 2026 (phase 3)</p>',
      buttons: [{ label: 'Done', cls: 'green', fn: onBack }, { label: 'Reset progress', cls: '', fn: function () {
        confirmModal('Reset progress?', 'Do you want to delete all your stars, coins, boosters, stats and achievements? This can’t be undone.', 'Yes, delete everything', function () {
          Object.keys(DEF).forEach(function (k) { S[k] = JSON.parse(JSON.stringify(DEF[k])); }); save(); applyReduced(); applyVolumes(); show('home'); refreshHome(); toast('Progress reset');
        }, function () { settingsModal(onBack); });
      } }],
      onClose: onBack,
      after: function (m) {
        m.querySelectorAll('input[type=range]').forEach(function (r) { r.oninput = function () { S.settings[r.dataset.k] = r.value / 100; applyVolumes(); save(); }; r.onchange = function () { sfx.click(); }; });
        m.querySelectorAll('.toggle').forEach(function (t) {
          t.onclick = function () { var k = t.dataset.k; S.settings[k] = k === 'lite' ? !liteOn() : !S.settings[k]; t.classList.toggle('on', !!S.settings[k]); save(); applyReduced(); sfx.click(); if (k === 'haptics' && S.settings.haptics) buzz(30); };
        });
      }
    });
  }
  // Lite graphics: explicit setting, or switched on automatically when frame rate is low (2026-11-15)
  var autoLite = false, fpsProbe = null;
  function liteOn() { return S.settings.lite === true || (S.settings.lite == null && autoLite); }
  function applyReduced() { document.body.classList.toggle('reduced', !!S.settings.reduced); document.body.classList.toggle('lite', liteOn()); }
  function probeFps() {
    if (fpsProbe || S.settings.lite != null) return;
    fpsProbe = { n: 0, t: 0, last: 0 };
    requestAnimationFrame(function f(t) {
      if (current !== 'game' || document.hidden) { fpsProbe.last = 0; requestAnimationFrame(f); return; }
      if (fpsProbe.last && t - fpsProbe.last < 250) { fpsProbe.t += t - fpsProbe.last; fpsProbe.n++; }
      fpsProbe.last = t;
      if (fpsProbe.n < 240) { requestAnimationFrame(f); return; }
      if (fpsProbe.t / fpsProbe.n > 24) { autoLite = true; applyReduced(); toast('⚡ Lite graphics on for smoother play (change in Settings)'); }
    });
  }
  function pauseModal() {
    if (over || modalOpen()) return;
    paused = true;
    var resume = function () { paused = false; };
    var back = function () { paused = false; pauseModal(); };
    showModal({ title: 'Paused', body: '<p style="font-weight:800">' + goalDesc(game.level) + '</p><div class="row" style="margin-top:6px">' + goalsHtml(game.goals, game) + '</div>',
      buttons: [{ label: 'Resume', cls: 'green', fn: resume },
        { label: 'Restart', cls: 'blue', fn: function () { confirmModal('Restart level?', 'You’ll lose your progress on this attempt.', 'Restart', function () { countGame(false); save(); startLevel(cur); }, back); } },
        { label: 'Settings', cls: 'gold', fn: function () { settingsModal(back); } },
        { label: 'Quit to map', cls: '', fn: function () { confirmModal('Quit level?', 'This attempt will count as a loss.', 'Quit', function () { paused = false; countGame(false); save(); goMap(); }, back); } }],
      onClose: resume });
  }

  // ---------- boot ----------
  function decorHome() {
    var h = $('#home');
    [[6, 10, 0, 54], [82, 7, 4, 46], [4, 80, 5, 40], [86, 76, 2, 58], [72, 44, 3, 34], [12, 46, 1, 30]].forEach(function (d, k) {
      var e = document.createElement('div'); e.className = 'deco';
      e.style.cssText = 'left:' + d[0] + '%;top:' + d[1] + '%;width:' + d[3] + 'px;height:' + d[3] + 'px;animation-delay:' + (-k * 0.6) + 's';
      e.innerHTML = '<div class="candy c' + d[2] + '"></div>'; h.appendChild(e);
    });
  }
  window.addEventListener('DOMContentLoaded', function () {
    board = $('#board'); tilesL = $('#tiles'); overlayL = $('#overlay'); fxL = $('#fx'); boardWrap = $('#boardWrap');
    pcan = $('#pcan'); pctx = pcan.getContext('2d');
    applyReduced(); decorHome(); bindInput(); bindBoosters(); bootSplash();
    $('#playBtn').onclick = function () { sfx.click(); show('map'); renderMap(); };
    $('#dailyBtn').onclick = function () { sfx.click(); dailyModal(); };
    $('#missionsBtn').onclick = function () { sfx.click(); missionsModal(); };
    $('#shopBtn').onclick = function () { sfx.click(); $('#shopBack').dataset.to = 'home'; show('shop'); renderShop(); };
    $('#profileBtn').onclick = function () { sfx.click(); show('profile'); renderProfile(); };
    $('#homeSettings').onclick = function () { sfx.click(); settingsModal(); };
    $('#mapHome').onclick = function () { sfx.click(); show('home'); refreshHome(); };
    $('#mapSettings').onclick = function () { sfx.click(); settingsModal(); };
    $('#mapShop').onclick = function () { sfx.click(); $('#shopBack').dataset.to = 'map'; show('shop'); renderShop(); };
    $('#shopBack').onclick = function () { sfx.click(); var to = $('#shopBack').dataset.to || 'home'; show(to); if (to === 'map') renderMap(); else refreshHome(); };
    $('#profBack').onclick = function () { sfx.click(); show('home'); refreshHome(); };
    $('#profName').addEventListener('change', function () { var v = this.value.trim().slice(0, 16); S.profile.name = v || 'Sweet Player'; this.value = S.profile.name; save(); });
    $('#pauseBtn').onclick = function () { sfx.click(); pauseModal(); };
    $('#hintBtn').onclick = function () { if (busy || over || mode || !game) return; sfx.click(); var mv = smartMove(); if (mv) { showHint(mv); toast('💡 Best move for your goals is wiggling'); } };
    if (saveNote === 'migrated') save(); else if (saveNote) setTimeout(function () { toast('💾 ' + saveNote); }, 2500);
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (game && current === 'game' && !busy) layoutBoard(); }, 120); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && game && !over && current === 'game' && !modalOpen()) pauseModal(); });
    window.__sv = { M: M, missionsModal: missionsModal, addXp: addXp, get voices() { return voices; }, saveNow: function () { save(); }, get game() { return game; }, startLevel: startLevel, doSwap: doSwap, get busy() { return busy; }, S: S, show: show, claimDaily: claimDaily, get parts() { return parts.length; }, get mode() { return mode; } };
  });
})();
