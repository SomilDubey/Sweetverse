/* SWEETVERSE UI – 2026-11-14 v0.1 */
(function () {
  'use strict';
  var E = window.SweetEngine, LEVELS = window.SWEET_LEVELS, WORLDS = window.SWEET_WORLDS;
  var $ = function (s) { return document.querySelector(s); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var COLORS = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#2ed58a', '#3a86ff', '#b15cff'];
  var COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

  // ---------- storage (safe) ----------
  var mem = {};
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch (e) { if (mem[k]) return mem[k]; } return d; },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var progress = store.get('sv_progress', { unlocked: 1, stars: {} });
  var inv = store.get('sv_inv', { hammer: 3, shuffle: 2, moves: 2 });
  var settings = store.get('sv_settings', { sound: true, music: true, haptics: true });
  function save() { store.set('sv_progress', progress); store.set('sv_inv', inv); store.set('sv_settings', settings); }

  // ---------- audio (synthesised, original) ----------
  var actx = null, master = null;
  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.9; master.connect(actx.destination); } catch (e) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(f, d, type, vol, when, slide, force) {
    if (!settings.sound && !force) return;
    var a = ac(); if (!a) return;
    var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];
  var sfx = {
    match: function (c) { var f = SCALE[Math.min(c - 1, 7)]; tone(f, 0.16, 'triangle', 0.2); tone(f * 1.5, 0.12, 'sine', 0.08, 0.04); },
    special: function () { tone(180, 0.4, 'sawtooth', 0.09, 0, 5); tone(900, 0.3, 'triangle', 0.08, 0.05, 0.4); },
    combo: function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, 'square', 0.05, i * 0.04); }); tone(120, 0.5, 'sawtooth', 0.1, 0, 0.3); },
    bad: function () { tone(200, 0.1, 'square', 0.06); tone(160, 0.12, 'square', 0.06, 0.08); },
    click: function () { tone(900, 0.05, 'sine', 0.08); },
    swap: function () { tone(660, 0.06, 'sine', 0.07, 0, 1.3); },
    create: function () { tone(784, 0.1, 'sine', 0.12); tone(1175, 0.18, 'triangle', 0.1, 0.07); },
    collect: function () { tone(988, 0.1, 'sine', 0.14); tone(1319, 0.2, 'sine', 0.14, 0.08); tone(1568, 0.25, 'sine', 0.1, 0.16); },
    ice: function () { tone(2000 + Math.random() * 600, 0.08, 'triangle', 0.05); },
    unlock: function () { tone(1400, 0.06, 'square', 0.05); tone(700, 0.12, 'triangle', 0.08, 0.05); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.16, i * 0.11); }); tone(1047, 0.8, 'sine', 0.1, 0.6); },
    lose: function () { [494, 440, 392, 330].forEach(function (f, i) { tone(f, 0.32, 'triangle', 0.12, i * 0.2); }); },
    star: function (n) { tone(880 + n * 220, 0.25, 'triangle', 0.15); }
  };
  // gentle original pentatonic loop
  var musicTimer = null, musicStep = 0;
  var MEL = [0, 2, 4, 7, 4, 2, 9, 7, 0, 4, 7, 9, 7, 4, 2, 4], BASS = [0, 0, 5, 5, 3, 3, 4, 4];
  function startMusic() {
    stopMusic();
    if (!settings.music) return;
    musicTimer = setInterval(function () {
      if (!settings.music || document.hidden) return;
      var semis = MEL[musicStep % 16], f = 392 * Math.pow(2, semis / 12);
      tone(f, 0.28, 'sine', 0.035, 0, 0, true);
      if (musicStep % 2 === 0) tone(98 * Math.pow(2, [0, 5, 3, 7, 5, 8, 7, 5][BASS[(musicStep / 2) % 8]] / 12), 0.5, 'triangle', 0.04, 0, 0, true);
      musicStep++;
    }, 300);
  }
  function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
  function buzz(ms) { if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

  // ---------- screens ----------
  function show(id) {
    ['home', 'map', 'game'].forEach(function (s) { $('#' + s).classList.toggle('hidden', s !== id); });
    if (id !== 'game') { stopTimers(); }
  }

  // ---------- modal (always has a close X) ----------
  var modalClose = null;
  function showModal(o) {
    var m = $('#modal'); m.classList.remove('hidden');
    var html = '<div class="card"><button class="x" aria-label="Close">✕</button>' +
      (o.title ? '<h2>' + o.title + '</h2>' : '') + (o.body || '') + '<div class="btns"></div></div>';
    m.innerHTML = html;
    var btns = m.querySelector('.btns');
    (o.buttons || []).forEach(function (b) {
      var el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label;
      el.onclick = function () { sfx.click(); hideModal(); b.fn && b.fn(); };
      btns.appendChild(el);
    });
    modalClose = o.onClose || null;
    m.querySelector('.x').onclick = function () { sfx.click(); var f = modalClose; hideModal(); f && f(); };
    if (o.after) o.after(m);
  }
  function hideModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; modalClose = null; }
  function confirmModal(title, text, yesLabel, onYes, onCancel) {
    showModal({ title: title, body: '<p>' + text + '</p>', buttons: [
      { label: yesLabel, cls: '', fn: onYes }, { label: 'Cancel', cls: 'blue', fn: onCancel }], onClose: onCancel });
  }

  // ---------- goal chips ----------
  function goalIcon(g) {
    if (g.type === 'color') return '<span class="gi"><span class="candy c' + g.color + '"></span></span>';
    return '<span class="gi">' + ({ ice: '❄️', locks: '🔒', ingredients: '🌰', score: '⭐' })[g.type] + '</span>';
  }
  function goalText(g, game) {
    if (g.type === 'score') return (game ? Math.min(game.score, g.target).toLocaleString() + ' / ' : '') + g.target.toLocaleString();
    var left = g.target - (g.progress || 0);
    return left <= 0 ? '✔' : String(left);
  }
  function goalsHtml(goals, game) {
    return goals.map(function (g) {
      var done = game && (g.type === 'score' ? game.score >= g.target : g.progress >= g.target);
      return '<span class="goal' + (done ? ' done' : '') + '">' + goalIcon(g) + goalText(g, game) + '</span>';
    }).join('');
  }
  function goalDesc(level) {
    return level.goals.map(function (g) {
      if (g.type === 'score') return 'Score ' + g.target.toLocaleString() + ' points';
      if (g.type === 'color') return 'Collect ' + g.target + ' ' + COLOR_NAMES[g.color] + ' sweets';
      if (g.type === 'ice') return 'Melt all the ice';
      if (g.type === 'locks') return 'Break all the locks';
      if (g.type === 'ingredients') return 'Bring down ' + g.target + ' acorns';
    }).join(' · ');
  }
  // preview goals with real targets (ice/lock counts come from layout)
  function previewGoals(level) { return new E.Game(level, 1).goals; }

  // ---------- map ----------
  function totalStars() { var n = 0; for (var k in progress.stars) n += progress.stars[k]; return n; }
  function renderMap() {
    $('#starTotal').textContent = totalStars() + ' / ' + LEVELS.length * 3;
    var m = $('#mapScroll'); m.innerHTML = '';
    WORLDS.forEach(function (w) {
      var sec = document.createElement('div');
      var locked = w.from > progress.unlocked;
      sec.className = 'world ' + w.cls + (locked ? ' locked' : '');
      sec.innerHTML = '<h2>' + w.name + '</h2><p>' + w.story + '</p>';
      var path = document.createElement('div'); path.className = 'path';
      for (var n = w.from; n <= w.to; n++) {
        (function (n) {
          var l = LEVELS[n - 1], st = progress.stars[n] || 0, isLocked = n > progress.unlocked;
          var off = Math.sin((n - w.from) * 0.9) * 90;
          var b = document.createElement('button');
          b.className = 'node' + (l.boss ? ' boss' : '') + (isLocked ? ' locked' : st ? ' done' : '') + (n === progress.unlocked ? ' current' : '');
          b.style.transform = 'translateX(' + off + 'px)';
          b.innerHTML = (isLocked ? '🔒' : n) + (st ? '<span class="st">' + '★★★'.slice(0, st) + '<span style="opacity:.35">' + '★★★'.slice(st) + '</span></span>' : '') +
            (l.time ? '<span class="tag">⏱</span>' : l.boss ? '<span class="tag">BOSS</span>' : '');
          b.onclick = function () { sfx.click(); if (isLocked) { sfx.bad(); return; } openIntro(n); };
          path.appendChild(b);
          if (n < w.to) { var d = document.createElement('div'); d.className = 'dots'; d.style.transform = 'translateX(' + (off + Math.sin((n - w.from + 0.5) * 0.9) * 90) / 2 + 'px)'; path.appendChild(d); }
        })(n);
      }
      sec.appendChild(path); m.appendChild(sec);
    });
    setTimeout(function () { var c = m.querySelector('.node.current'); if (c) c.scrollIntoView({ block: 'center' }); }, 30);
  }
  function diffTag(l) { return '<span class="diff ' + l.difficulty.split(' ')[0] + '">' + l.difficulty + '</span>'; }
  function openIntro(n) {
    var l = LEVELS[n - 1];
    showModal({
      title: 'Level ' + n,
      body: '<p style="font-weight:800">' + goalDesc(l) + diffTag(l) + '</p>' +
        '<div class="row" style="margin-top:10px">' + goalsHtml(previewGoals(l)) + '</div>' +
        '<p>' + (l.time ? '⏱ ' + l.time + ' seconds' : '👆 ' + l.moves + ' moves') + '</p>' +
        (l.tip ? '<div class="tipBox"><span class="pip">🧚</span><span><b>Pip:</b> ' + l.tip + '</span></div>' : ''),
      buttons: [{ label: 'Play', cls: 'green', fn: function () { startLevel(n); } }]
    });
  }

  // ---------- game state ----------
  var game = null, cur = 0, cs = 48, busy = false, over = false, paused = false, mode = null;
  var tileEls = new Map(), bgEls = [], lockEls = [], spawnFrom = new Map(), born = new Set();
  var timerId = null, hintId = null, selected = null, down = null;
  var board, tilesL, overlayL, fxL, boardWrap;

  function stopTimers() { if (timerId) clearInterval(timerId); timerId = null; if (hintId) clearTimeout(hintId); hintId = null; }
  function tr(x, y) { return 'translate(' + x * cs + 'px,' + y * cs + 'px)'; }

  function startLevel(n) {
    cur = n; var l = LEVELS[n - 1];
    game = new E.Game(l);
    busy = false; over = false; paused = false; mode = null; selected = null;
    show('game');
    $('#gameBg').className = 'bg ' + WORLDS.filter(function (w) { return n >= w.from && n <= w.to; })[0].cls;
    $('#lvlNum').textContent = n;
    layoutBoard();
    renderBoosters();
    stopTimers();
    if (l.time) timerId = setInterval(function () {
      if (over || paused || !$('#modal').classList.contains('hidden')) return;
      game.timeLeft = Math.max(0, game.timeLeft - 1); renderHud();
      if (game.timeLeft <= 5 && game.timeLeft > 0) tone(1200, 0.05, 'square', 0.05);
      if (game.timeLeft <= 0 && !busy) checkEnd();
    }, 1000);
    idleReset();
  }

  function layoutBoard() {
    var hudH = $('.hud').offsetHeight + $('.goals').offsetHeight + $('.boosters').offsetHeight + 40;
    var aw = Math.min(window.innerWidth - 28, 560), ah = window.innerHeight - hudH;
    cs = Math.max(26, Math.floor(Math.min(aw / game.w, ah / game.h)));
    document.documentElement.style.setProperty('--cs', cs + 'px');
    board.style.width = cs * game.w + 'px'; board.style.height = cs * game.h + 'px';
    Array.from(board.querySelectorAll('.cell')).forEach(function (e) { e.remove(); });
    tilesL.innerHTML = ''; overlayL.innerHTML = ''; fxL.innerHTML = '';
    tileEls.clear(); bgEls = []; lockEls = [];
    game.cells.forEach(function (c, i) {
      var p = game.xy(i);
      var el = document.createElement('div'); el.style.transform = tr(p[0], p[1]);
      board.insertBefore(el, tilesL); bgEls.push(el);
      var lk = document.createElement('div'); lk.className = 'lock'; lk.style.transform = tr(p[0], p[1]);
      overlayL.appendChild(lk); lockEls.push(lk);
    });
    board.classList.add('noanim'); render(); void board.offsetWidth; board.classList.remove('noanim');
  }

  function candyClass(t) {
    if (t.kind === 'ingredient') return 'tile ing';
    return 'tile' + (t.special ? ' sp-' + t.special : '');
  }
  function render() {
    game.cells.forEach(function (c, i) {
      var p = game.xy(i), el = bgEls[i];
      var cls = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '') + (c.hole ? ' hole' : '') + (c.ice === 1 ? ' ice1' : c.ice === 2 ? ' ice2' : '');
      if (el.dataset.k !== cls) { el.className = cls; el.dataset.k = cls; }
      var lk = lockEls[i];
      if (c.lock) { lk.style.display = ''; lk.classList.remove('breaking'); }
      else if (!lk.classList.contains('breaking')) lk.style.display = 'none';
    });
    var seen = new Set();
    game.cells.forEach(function (c, i) {
      if (!c.tile) return;
      var t = c.tile, p = game.xy(i); seen.add(t.id);
      var el = tileEls.get(t.id);
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<div class="candy"></div>';
        tilesL.appendChild(el); tileEls.set(t.id, el);
        var from = spawnFrom.has(t.id) ? spawnFrom.get(t.id) : p[1];
        el.style.transform = tr(p[0], from);
        void el.offsetWidth;
      }
      var cc = candyClass(t) + (selected === i ? ' sel' : '') + (born.has(t.id) ? ' born' : '');
      if (el.className !== cc) el.className = cc;
      var candy = el.firstChild, ccl = 'candy' + (t.kind === 'candy' ? ' c' + t.color : '');
      if (candy.className !== ccl) candy.className = ccl;
      if (t.kind === 'ingredient' && !candy.textContent) candy.textContent = '🌰';
      el.style.transform = tr(p[0], p[1]);
    });
    tileEls.forEach(function (el, id) { if (!seen.has(id)) { el.remove(); tileEls.delete(id); } });
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
    var mk = $('#starMarks'); if (!mk.dataset.l || mk.dataset.l != cur) {
      mk.dataset.l = cur;
      mk.innerHTML = l.stars.map(function (s) { return '<span class="mk" style="left:' + (s / top * 100) + '%">⭐</span>'; }).join('');
    }
    Array.from(mk.children).forEach(function (e, k) { var on = game.score >= l.stars[k]; if (on && !e.classList.contains('on')) { e.classList.add('on'); sfx.star(k); } else if (!on) e.classList.remove('on'); });
    $('#goalRow').innerHTML = goalsHtml(game.goals, game);
  }

  function renderBoosters() {
    [['hammer', 'bHammer'], ['shuffle', 'bShuffle'], ['moves', 'bMoves']].forEach(function (p) {
      var el = $('#' + p[1]);
      el.querySelector('.cnt').textContent = inv[p[0]];
      el.classList.toggle('empty', inv[p[0]] <= 0);
      el.classList.toggle('active', mode === p[0]);
    });
    $('#bMoves .nm').textContent = game && game.level.time ? '+15 sec' : '+5 moves';
    $('#modeHint').classList.toggle('hidden', mode !== 'hammer');
  }

  // ---------- effects ----------
  function center(i) { var p = game.xy(i); return [(p[0] + 0.5) * cs, (p[1] + 0.5) * cs]; }
  function fxEl(cls, css, life) {
    var e = document.createElement('div'); e.className = cls;
    for (var k in css) e.style.setProperty(k, css[k]);
    fxL.appendChild(e); setTimeout(function () { e.remove(); }, life || 700); return e;
  }
  function particles(i, color, n) {
    var c = center(i);
    for (var k = 0; k < (n || 6); k++) {
      var a = Math.random() * Math.PI * 2, d = cs * (0.6 + Math.random() * 0.9);
      fxEl('pt', { left: c[0] + 'px', top: c[1] + 'px', '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px',
        '--pc': color >= 0 ? COLORS[color] : ['#fff', '#ffe066', '#ff8cc0'][k % 3] }, 650);
    }
  }
  function popTile(id, i, color, collected) {
    var el = tileEls.get(id);
    if (el) { tileEls.delete(id); el.classList.add(collected ? 'collected' : 'pop'); setTimeout(function () { el.remove(); }, 520); }
    particles(i, color, collected ? 10 : 5);
  }
  function floatText(x, y, txt) { fxEl('floatScore', { left: x + 'px', top: y + 'px' }, 950).textContent = txt; }
  var COMBO_WORDS = ['', '', 'Sweet!', 'Tasty!', 'Delicious!', 'Divine!', 'Sugar Rush!'];
  function comboText(t) { var e = document.createElement('div'); e.className = 'comboTxt'; e.textContent = t; boardWrap.appendChild(e); setTimeout(function () { e.remove(); }, 1050); }
  function banner(t) { var e = document.createElement('div'); e.className = 'banner'; e.textContent = t; boardWrap.appendChild(e); setTimeout(function () { e.remove(); }, 1250); }
  function specialFx(e) {
    var p = game.xy(e.idx), c = center(e.idx), W = cs * game.w, H = cs * game.h;
    if (e.special === 'row') fxEl('beam', { left: '0px', top: (p[1] * cs + cs * 0.2) + 'px', width: W + 'px', height: cs * 0.6 + 'px' }, 450);
    else if (e.special === 'col') fxEl('beam v', { top: '0px', left: (p[0] * cs + cs * 0.2) + 'px', height: H + 'px', width: cs * 0.6 + 'px' }, 450);
    else if (e.special === 'bomb') fxEl('ring', { left: (c[0] - cs * 1.6) + 'px', top: (c[1] - cs * 1.6) + 'px', width: cs * 3.2 + 'px', height: cs * 3.2 + 'px' }, 500);
    else if (e.special === 'rainbow') { fxEl('flash', {}, 550); }
  }
  function comboFx(e) {
    var p = game.xy(e.idx), c = center(e.idx), W = cs * game.w, H = cs * game.h, k;
    if (e.kind === 'cross' || e.kind === 'bigcross') {
      var r = e.kind === 'bigcross' ? 1 : 0;
      for (k = -r; k <= r; k++) {
        fxEl('beam', { left: '0px', top: ((p[1] + k) * cs + cs * 0.15) + 'px', width: W + 'px', height: cs * 0.7 + 'px' }, 450);
        fxEl('beam v', { top: '0px', left: ((p[0] + k) * cs + cs * 0.15) + 'px', height: H + 'px', width: cs * 0.7 + 'px' }, 450);
      }
      banner(e.kind === 'bigcross' ? 'Mega Blast!' : 'Cross Burst!');
    } else if (e.kind === 'star') {
      fxEl('ring', { left: (c[0] - cs * 2.6) + 'px', top: (c[1] - cs * 2.6) + 'px', width: cs * 5.2 + 'px', height: cs * 5.2 + 'px' }, 500);
      banner('Star Crusher!');
    } else { fxEl('flash', {}, 600); banner(e.kind === 'mega' ? 'Colour Blast!' : 'Rainbow Magic!'); }
    sfx.combo();
  }
  function shake() { boardWrap.classList.remove('shake'); void boardWrap.offsetWidth; boardWrap.classList.add('shake'); buzz(35); }

  function drain() {
    var evs = game.events.splice(0), sh = false, sp = false;
    evs.forEach(function (e) {
      switch (e.type) {
        case 'match':
          sfx.match(e.cascade);
          if (e.cascade >= 2) comboText(COMBO_WORDS[Math.min(e.cascade, 6)]);
          e.groups.forEach(function (g) {
            var sx = 0, sy = 0; g.cells.forEach(function (i) { var c = center(i); sx += c[0]; sy += c[1]; });
            floatText(sx / g.cells.length, sy / g.cells.length, '+' + g.cells.length * 60 * e.cascade);
          });
          break;
        case 'clear': popTile(e.id, e.idx, e.color); break;
        case 'special': specialFx(e); sh = true; sp = true; break;
        case 'combo': comboFx(e); sh = true; break;
        case 'create': born.add(e.id); sfx.create(); break;
        case 'convert': born.add(e.id); break;
        case 'spawn': spawnFrom.set(e.id, e.from); break;
        case 'collect': popTile(e.id, e.idx, -1, true); sfx.collect(); var c = center(e.idx); floatText(c[0], c[1], '+1000'); break;
        case 'unlock': var lk = lockEls[e.idx]; lk.classList.add('breaking'); setTimeout(function () { lk.classList.remove('breaking'); lk.style.display = game.cells[e.idx].lock ? '' : 'none'; }, 360); sfx.unlock(); break;
        case 'ice': var be = bgEls[e.idx]; be.classList.remove('ice-hit'); void be.offsetWidth; be.classList.add('ice-hit'); sfx.ice(); particles(e.idx, -1, 4); break;
        case 'shuffle': banner('No moves – Shuffle!'); break;
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
      game.collapse(); drain(); render(); await wait(310);
      if (!game.matchStep(null)) break;
      drain(); render(); await wait(270);
    }
    var hadShuffle = !game.isWon() && !game.hasMoves();
    game.endTurn(); drain(); render();
    if (hadShuffle) await wait(500);
    busy = false; idleReset(); checkEnd();
  }

  async function doSwap(a, b) {
    if (busy || over) return;
    if (!game.canSwap(a, b)) { sfx.bad(); return; }
    busy = true; clearHint();
    var ta = game.cells[a].tile, tb = game.cells[b].tile, ea = tileEls.get(ta.id), eb = tileEls.get(tb.id);
    var pa = game.xy(a), pb = game.xy(b);
    sfx.swap();
    ea.style.transform = tr(pb[0], pb[1]); eb.style.transform = tr(pa[0], pa[1]);
    await wait(180);
    var res = game.trySwap(a, b);
    if (!res.ok) { sfx.bad(); buzz(15); render(); await wait(200); busy = false; idleReset(); return; }
    await resolveLoop(res.combo ? null : [a, b], res.combo);
  }

  function checkEnd() {
    if (over || busy) return;
    if (game.isWon()) finishWin();
    else if (game.isLost()) showLose();
  }

  async function finishWin() {
    over = true; stopTimers(); clearHint();
    var left = game.level.time ? 0 : game.moves;
    if (left > 0) { banner('Sugar Rush Bonus!'); game.score += left * 250; renderHud(); await wait(900); }
    var stars = game.stars();
    var prev = progress.stars[cur] || 0;
    progress.stars[cur] = Math.max(prev, stars);
    if (cur >= progress.unlocked && cur < LEVELS.length) progress.unlocked = cur + 1;
    var gift = '';
    if (stars === 3 && prev < 3) { var keys = ['hammer', 'shuffle', 'moves'], k = keys[Math.floor(Math.random() * 3)]; inv[k]++; gift = '<p>🎁 3-star gift: +1 ' + ({ hammer: 'Sweet Hammer', shuffle: 'Shuffle Magic', moves: 'Extra Moves' })[k] + '</p>'; }
    save(); sfx.win(); confetti();
    var isLast = cur === LEVELS.length;
    var worldDone = WORLDS.filter(function (w) { return w.to === cur; })[0];
    showModal({
      title: worldDone ? worldDone.name + ' saved!' : 'Level ' + cur + ' complete!',
      body: '<div class="bigStars"><span>⭐</span><span>⭐</span><span>⭐</span></div><p style="font-size:26px;font-weight:900">' + game.score.toLocaleString() + '</p>' + gift +
        (isLast ? '<p>🧚 Pip has brought every magic sweet home. Grumble promises to share from now on. More worlds coming soon!</p>' : ''),
      buttons: (isLast ? [] : [{ label: 'Next level', cls: 'green', fn: function () { show('map'); renderMap(); openIntro(cur + 1); } }])
        .concat([{ label: 'Replay', cls: 'blue', fn: function () { startLevel(cur); } }, { label: 'World map', cls: '', fn: goMap }]),
      onClose: goMap,
      after: function (m) { m.querySelectorAll('.bigStars span').forEach(function (s, i) { if (i < stars) setTimeout(function () { s.classList.add('on'); sfx.star(i); }, 350 + i * 300); }); }
    });
  }
  function showLose() {
    over = true; clearHint(); sfx.lose(); buzz([40, 60, 40]);
    var timed = !!game.level.time;
    var btns = [];
    if (inv.moves > 0) btns.push({ label: (timed ? '+15 seconds' : '+5 moves') + ' (' + inv.moves + ' left)', cls: 'gold', fn: function () { inv.moves--; save(); game.addMoves(); over = false; renderHud(); renderBoosters(); idleReset(); } });
    btns.push({ label: 'Try again', cls: 'green', fn: function () { startLevel(cur); } });
    btns.push({ label: 'World map', cls: 'blue', fn: goMap });
    showModal({ title: timed ? 'Time’s up!' : 'Out of moves!',
      body: '<p>So close! Still to do:</p><div class="row">' + goalsHtml(game.goals, game) + '</div>', buttons: btns, onClose: goMap });
  }
  function goMap() { stopTimers(); show('map'); renderMap(); }
  function confetti() {
    for (var k = 0; k < 60; k++) {
      var c = document.createElement('div'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = COLORS[k % 6];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; c.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(c); setTimeout((function (c) { return function () { c.remove(); }; })(c), 3800);
    }
  }

  // ---------- hints ----------
  function clearHint() { if (hintId) clearTimeout(hintId); hintId = null; tilesL && tilesL.querySelectorAll('.hint').forEach(function (e) { e.classList.remove('hint'); }); }
  function idleReset() {
    clearHint();
    hintId = setTimeout(function () {
      if (busy || over || !game) return;
      var mv = game.findMove(); if (!mv) return;
      mv.forEach(function (i) { var t = game.cells[i].tile, el = t && tileEls.get(t.id); if (el) el.classList.add('hint'); });
    }, 6000);
  }

  // ---------- input ----------
  function cellAt(ev) {
    var r = board.getBoundingClientRect();
    var x = Math.floor((ev.clientX - r.left) / cs), y = Math.floor((ev.clientY - r.top) / cs);
    if (x < 0 || y < 0 || x >= game.w || y >= game.h) return null;
    var i = game.idx(x, y); return game.cells[i].hole ? null : i;
  }
  function adjacent(a, b) { var pa = game.xy(a), pb = game.xy(b); return Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) === 1; }
  function setSel(i) { selected = i; render(); }
  function bindInput() {
    board.addEventListener('pointerdown', function (ev) {
      ac();
      if (busy || over) return;
      var i = cellAt(ev); if (i == null) return;
      down = { i: i, x: ev.clientX, y: ev.clientY, moved: false };
      try { board.setPointerCapture(ev.pointerId); } catch (e) {}
      idleReset();
    });
    board.addEventListener('pointermove', function (ev) {
      if (!down || down.moved || busy || mode) return;
      var dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      if (Math.hypot(dx, dy) < cs * 0.35) return;
      down.moved = true;
      var p = game.xy(down.i), nx = p[0], ny = p[1];
      if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
      if (nx < 0 || ny < 0 || nx >= game.w || ny >= game.h) return;
      selected = null;
      doSwap(down.i, game.idx(nx, ny));
    });
    board.addEventListener('pointerup', function () {
      if (!down) return;
      var d = down; down = null;
      if (d.moved || busy || over) return;
      if (mode === 'hammer') { useHammer(d.i); return; }
      if (selected != null && selected !== d.i && adjacent(selected, d.i)) { var s = selected; selected = null; render(); doSwap(s, d.i); }
      else if (selected === d.i) { selected = null; render(); }
      else { setSel(d.i); }
    });
    board.addEventListener('pointercancel', function () { down = null; });
  }

  // ---------- boosters ----------
  async function useHammer(i) {
    if (inv.hammer <= 0) return;
    if (!game.hammer(i)) { sfx.bad(); return; }
    inv.hammer--; mode = null; save(); renderBoosters();
    sfx.special(); shake();
    var c = center(i); fxEl('ring', { left: (c[0] - cs * 0.8) + 'px', top: (c[1] - cs * 0.8) + 'px', width: cs * 1.6 + 'px', height: cs * 1.6 + 'px' }, 500);
    await resolveLoop(null, true);
  }
  function bindBoosters() {
    $('#bHammer').onclick = function () {
      if (busy || over) return; sfx.click();
      if (inv.hammer <= 0) { emptyBooster('Sweet Hammer'); return; }
      mode = mode === 'hammer' ? null : 'hammer'; selected = null; render(); renderBoosters();
    };
    $('#bShuffle').onclick = function () {
      if (busy || over) return; sfx.click();
      if (inv.shuffle <= 0) { emptyBooster('Shuffle Magic'); return; }
      inv.shuffle--; save(); mode = null; game.shuffle(); game.events.length = 0; banner('Shuffle Magic!'); sfx.special(); render(); renderBoosters(); idleReset();
    };
    $('#bMoves').onclick = function () {
      if (busy || over) return; sfx.click();
      if (inv.moves <= 0) { emptyBooster('Extra Moves'); return; }
      inv.moves--; save(); game.addMoves(); banner(game.level.time ? '+15 seconds!' : '+5 moves!'); sfx.create(); renderHud(); renderBoosters();
    };
  }
  function emptyBooster(name) {
    showModal({ title: 'Out of ' + name, body: '<p>Earn more boosters by getting 3 stars on a level.</p><p style="opacity:.7;font-size:13px">(The shop isn’t in this prototype yet. Nothing here is for sale.)</p>', buttons: [{ label: 'OK', cls: 'green' }] });
  }

  // ---------- settings / pause ----------
  function settingsModal(onBack) {
    function row(key, label) { return '<div class="setRow">' + label + '<button class="toggle' + (settings[key] ? ' on' : '') + '" data-k="' + key + '" aria-label="' + label + '"></button></div>'; }
    showModal({
      title: 'Settings',
      body: row('sound', '🔊 Sound effects') + row('music', '🎵 Music') + row('haptics', '📳 Vibration') +
        '<p style="font-size:12px;opacity:.7;margin-top:12px">Sweetverse prototype v0.2 · 14 Nov 2026</p>',
      buttons: [{ label: 'Done', cls: 'green', fn: onBack }, { label: 'Reset progress', cls: '', fn: function () {
        confirmModal('Reset progress?', 'Do you want to delete all your stars and unlocked levels? This can’t be undone.', 'Yes, reset', function () {
          progress = { unlocked: 1, stars: {} }; inv = { hammer: 3, shuffle: 2, moves: 2 }; save(); renderMap(); show('map');
        });
      } }],
      onClose: onBack,
      after: function (m) {
        m.querySelectorAll('.toggle').forEach(function (t) {
          t.onclick = function () { var k = t.dataset.k; settings[k] = !settings[k]; t.classList.toggle('on', settings[k]); save(); if (k === 'music') { settings.music ? startMusic() : stopMusic(); } sfx.click(); };
        });
      }
    });
  }
  function pauseModal() {
    if (over) return;
    paused = true;
    var resume = function () { paused = false; };
    showModal({ title: 'Paused', body: '<div class="row" style="margin-top:6px">' + goalsHtml(game.goals, game) + '</div>',
      buttons: [{ label: 'Resume', cls: 'green', fn: resume },
        { label: 'Restart', cls: 'blue', fn: function () { confirmModal('Restart level?', 'You’ll lose your progress on this attempt.', 'Restart', function () { startLevel(cur); }, resume); } },
        { label: 'Settings', cls: 'gold', fn: function () { settingsModal(pauseModal); } },
        { label: 'Quit to map', cls: '', fn: function () { paused = false; goMap(); } }],
      onClose: resume });
  }

  // ---------- boot ----------
  function decorHome() {
    var h = $('#home');
    [[8, 12, 0, 54], [80, 8, 4, 46], [6, 78, 5, 40], [84, 72, 2, 58], [70, 40, 3, 34], [14, 45, 1, 30]].forEach(function (d, k) {
      var e = document.createElement('div'); e.className = 'deco';
      e.style.cssText = 'left:' + d[0] + '%;top:' + d[1] + '%;width:' + d[3] + 'px;height:' + d[3] + 'px;animation-delay:' + k * 0.4 + 's';
      e.innerHTML = '<div class="candy c' + d[2] + '"></div>'; h.appendChild(e);
    });
  }
  window.addEventListener('DOMContentLoaded', function () {
    board = $('#board'); tilesL = $('#tiles'); overlayL = $('#overlay'); fxL = $('#fx'); boardWrap = $('#boardWrap');
    decorHome(); bindInput(); bindBoosters();
    $('#playBtn').onclick = function () { ac(); sfx.click(); startMusic(); show('map'); renderMap(); };
    $('#homeSettings').onclick = function () { ac(); sfx.click(); settingsModal(); };
    $('#mapHome').onclick = function () { sfx.click(); show('home'); };
    $('#mapSettings').onclick = function () { sfx.click(); settingsModal(); };
    $('#pauseBtn').onclick = function () { sfx.click(); pauseModal(); };
    window.addEventListener('resize', function () { if (game && !$('#game').classList.contains('hidden')) layoutBoard(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && game && !over && !$('#game').classList.contains('hidden') && $('#modal').classList.contains('hidden')) pauseModal(); });
    window.__sv = { get game() { return game; }, startLevel: startLevel, doSwap: doSwap, get busy() { return busy; } };
  });
})();
