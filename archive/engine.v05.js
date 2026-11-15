/* SWEETVERSE – Match & Magic : core match-3 engine (pure logic, no DOM)
 * 2026-11-14  v0.1  initial engine: board, matching, specials, combos, gravity,
 *                   ice, locks, ingredients, reshuffle, boosters, goals, stars.
 * 2026-11-14  v0.3  chocolate blockers (1-2 layers, spreading), goals for making
 *                   specials / firing combos / clearing chocolate, Colour Blast and
 *                   Magic Swap boosters, goalLeft() helper.
 * 2026-11-15  v0.4  candy crates (1-3 layers, never spread), fizz bombs (countdown
 *                   tiles: lose if one reaches 0), Sugar Rush finale (leftover moves
 *                   become rockets), start boosters. Previous: archive/engine.v03.js
 * 2026-11-15  v0.5  scoreState() goal-aware board value; suggestMove() smart hint that
 *                   simulates candidate moves (cascades included) and picks the best one
 *                   for the level's goals. Previous: archive/engine.v04.js
 */
(function (root) {
  'use strict';
  var ROW = 'row', COL = 'col', BOMB = 'bomb', RAINBOW = 'rainbow';

  function Rng(seed) { this.s = seed >>> 0; }
  Rng.prototype.next = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (n) { return Math.floor(this.next() * n); };

  var NEXT_ID = 1;
  function tile(color, special, kind) {
    return { id: NEXT_ID++, color: color, special: special || null, kind: kind || 'candy' };
  }

  function Game(level, seed) {
    this.level = level;
    this.w = level.w; this.h = level.h;
    this.colors = level.colors || 6;
    this.rng = new Rng(seed == null ? (Math.random() * 4294967296) >>> 0 : seed);
    this.moves = level.time ? Infinity : level.moves;
    this.timeLeft = level.time || 0;
    this.score = 0; this.cascade = 0; this.events = [];
    this.cells = [];
    var layout = level.layout || [], ice = 0, locks = 0, chocs = 0, crates = 0;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var ch = (layout[y] && layout[y][x]) || '.';
      var c = {
        hole: ch === '#',
        choc: ch === 'C' ? 1 : ch === 'D' ? 2 : 0,
        crate: ch === 'X' ? 1 : ch === 'Y' ? 2 : ch === 'Z' ? 3 : 0,
        ice: (ch === 'i' || ch === 'K') ? 1 : ch === 'I' ? 2 : 0,
        lock: (ch === 'L' || ch === 'K') ? 1 : 0,
        tile: null
      };
      if (c.ice) ice++;
      if (c.choc) chocs++;
      if (c.crate) crates++;
      locks += c.lock;
      this.cells.push(c);
    }
    this.goals = (level.goals || []).map(function (g) {
      var o = Object.assign({}, g, { progress: 0 });
      if (g.type === 'ice') o.target = ice;
      if (g.type === 'locks') o.target = locks;
      if (g.type === 'chocolate') o.target = chocs;
      if (g.type === 'crates') o.target = crates;
      return o;
    });
    var ing = this.goals.filter(function (g) { return g.type === 'ingredients'; })[0];
    this.ingredientsPending = ing ? ing.target : 0;
    this.chocSpread = chocs > 0 && level.chocSpread !== false;
    this.chocHitThisTurn = false; this.moveUsed = false;
    this.fuse = level.fuse || null; this.exploded = false;
    this.fill();
  }
  var P = Game.prototype;

  P.idx = function (x, y) { return y * this.w + x; };
  P.xy = function (i) { return [i % this.w, Math.floor(i / this.w)]; };
  P.colorAt = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    var c = this.cells[y * this.w + x];
    if (c.hole || !c.tile) return -1;
    var t = c.tile;
    if (t.kind !== 'candy' || t.special === RAINBOW) return -1;
    return t.color;
  };
  P.blocked = function (c) { return c.hole || c.choc > 0 || c.crate > 0; };
  P.randomColor = function () { return this.rng.int(this.colors); };

  P.fill = function () {
    for (var attempt = 0; attempt < 300; attempt++) {
      for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
        var c = this.cells[this.idx(x, y)];
        if (this.blocked(c)) { c.tile = null; continue; }
        var col, guard = 0;
        do { col = this.randomColor(); guard++; }
        while (guard < 60 && ((this.colorAt(x - 1, y) === col && this.colorAt(x - 2, y) === col) ||
                              (this.colorAt(x, y - 1) === col && this.colorAt(x, y - 2) === col)));
        c.tile = tile(col);
      }
      if (this.findGroups().length === 0 && this.hasMoves()) break;
    }
    var n = Math.min(this.ingredientsPending, 2), tops = this.topCells();
    while (n > 0 && tops.length) {
      var i = tops.splice(this.rng.int(tops.length), 1)[0];
      this.cells[i].tile = tile(-1, null, 'ingredient');
      this.ingredientsPending--; n--;
    }
    if (this.fuse) {
      var cands = [], self = this;
      this.cells.forEach(function (c, i) { if (!self.blocked(c) && !c.lock && c.tile && c.tile.kind === 'candy' && self.xy(i)[1] < self.h - 2) cands.push(i); });
      for (var f = 0; f < this.fuse.n && cands.length; f++) this.cells[cands.splice(this.rng.int(cands.length), 1)[0]].tile.fuse = this.fuse.start;
    }
    if (!this.hasMoves()) this.shuffle();
    this.events.length = 0;
  };

  P.topCells = function () {
    var out = [];
    for (var x = 0; x < this.w; x++) for (var y = 0; y < this.h; y++) {
      var i = this.idx(x, y), c = this.cells[i];
      if (this.blocked(c)) continue;
      if (!c.lock) out.push(i);
      break;
    }
    return out;
  };

  P.findGroups = function () {
    var runs = [], w = this.w, h = this.h, x, y, e, c, k, cells;
    for (y = 0; y < h; y++) {
      x = 0;
      while (x < w) {
        c = this.colorAt(x, y);
        if (c < 0) { x++; continue; }
        e = x + 1; while (e < w && this.colorAt(e, y) === c) e++;
        if (e - x >= 3) { cells = []; for (k = x; k < e; k++) cells.push(this.idx(k, y)); runs.push({ dir: 'h', cells: cells, color: c }); }
        x = e;
      }
    }
    for (x = 0; x < w; x++) {
      y = 0;
      while (y < h) {
        c = this.colorAt(x, y);
        if (c < 0) { y++; continue; }
        e = y + 1; while (e < h && this.colorAt(x, e) === c) e++;
        if (e - y >= 3) { cells = []; for (k = y; k < e; k++) cells.push(this.idx(x, k)); runs.push({ dir: 'v', cells: cells, color: c }); }
        y = e;
      }
    }
    var groups = [], owner = new Map();
    runs.forEach(function (r) {
      var hit = new Set();
      r.cells.forEach(function (i) { if (owner.has(i)) hit.add(owner.get(i)); });
      var g;
      if (hit.size === 0) { g = { cells: new Set(), runs: [], color: r.color }; groups.push(g); }
      else {
        var arr = Array.from(hit); g = arr[0];
        for (var m = 1; m < arr.length; m++) {
          var o = arr[m];
          o.cells.forEach(function (i) { g.cells.add(i); owner.set(i, g); });
          g.runs = g.runs.concat(o.runs);
          groups.splice(groups.indexOf(o), 1);
        }
      }
      r.cells.forEach(function (i) { g.cells.add(i); owner.set(i, g); });
      g.runs.push(r);
    });
    return groups;
  };

  P.specialFor = function (g, preferred) {
    var maxLen = 0, hasH = false, hasV = false, longest = null;
    g.runs.forEach(function (r) {
      if (r.cells.length > maxLen) { maxLen = r.cells.length; longest = r; }
      if (r.dir === 'h') hasH = true; else hasV = true;
    });
    var special = null;
    if (maxLen >= 5) special = RAINBOW;
    else if (hasH && hasV) special = BOMB;
    else if (maxLen === 4) special = longest.dir === 'h' ? ROW : COL;
    if (!special) return null;
    var at = null;
    if (preferred) for (var p = 0; p < preferred.length; p++) if (g.cells.has(preferred[p])) { at = preferred[p]; break; }
    if (at == null && special === BOMB) {
      var counts = new Map();
      g.runs.forEach(function (r) { r.cells.forEach(function (i) { counts.set(i, (counts.get(i) || 0) + 1); }); });
      counts.forEach(function (n, i) { if (n > 1 && at == null) at = i; });
    }
    if (at == null) at = longest.cells[Math.floor(longest.cells.length / 2)];
    return { at: at, special: special, color: g.color };
  };

  P.matchStep = function (preferred) {
    var groups = this.findGroups();
    if (!groups.length) return false;
    this.cascade++;
    var set = new Set(), spawns = [], self = this;
    groups.forEach(function (g) {
      g.cells.forEach(function (i) { set.add(i); });
      var s = self.specialFor(g, preferred);
      if (s) spawns.push(s);
    });
    this.events.push({ type: 'match', cascade: this.cascade,
      groups: groups.map(function (g) { return { cells: Array.from(g.cells), color: g.color }; }) });
    this.clearCells(set);
    spawns.forEach(function (s) {
      var c = self.cells[s.at];
      if (!c.tile) {
        c.tile = tile(s.color, s.special);
        self.score += s.special === RAINBOW ? 500 : s.special === BOMB ? 300 : 200;
        self.events.push({ type: 'create', idx: s.at, special: s.special, id: c.tile.id });
        self.bumpMake(s.special);
      }
    });
    return true;
  };

  P.square = function (x, y, r) {
    var out = [];
    for (var yy = y - r; yy <= y + r; yy++) for (var xx = x - r; xx <= x + r; xx++)
      if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h) out.push(this.idx(xx, yy));
    return out;
  };
  P.lineArea = function (x, y, r) {
    var out = [], k, d;
    for (d = -r; d <= r; d++) {
      if (y + d >= 0 && y + d < this.h) for (k = 0; k < this.w; k++) out.push(this.idx(k, y + d));
      if (x + d >= 0 && x + d < this.w) for (k = 0; k < this.h; k++) out.push(this.idx(x + d, k));
    }
    return out;
  };
  P.mostCommonColor = function () {
    var counts = [], best = 0, bestN = -1;
    this.cells.forEach(function (c) {
      var t = c.tile;
      if (t && t.kind === 'candy' && t.special !== RAINBOW) counts[t.color] = (counts[t.color] || 0) + 1;
    });
    counts.forEach(function (n, col) { if (n > bestN) { bestN = n; best = col; } });
    return best;
  };
  P.colorCells = function (col) {
    var out = [];
    this.cells.forEach(function (c, k) {
      var t = c.tile;
      if (t && t.kind === 'candy' && t.color === col && t.special !== RAINBOW) out.push(k);
    });
    return out;
  };

  P.effectArea = function (i, t) {
    var p = this.xy(i), x = p[0], y = p[1], out = [], k;
    if (t.special === ROW) for (k = 0; k < this.w; k++) out.push(this.idx(k, y));
    else if (t.special === COL) for (k = 0; k < this.h; k++) out.push(this.idx(x, k));
    else if (t.special === BOMB) out = this.square(x, y, 1);
    else if (t.special === RAINBOW) out = this.colorCells(t.target != null ? t.target : this.mostCommonColor());
    return out;
  };

  P.bump = function (type) {
    this.goals.forEach(function (g) { if (g.type === type && g.progress < g.target) g.progress++; });
  };
  P.bumpMake = function (sp) {
    var key = (sp === ROW || sp === COL) ? 'rocket' : sp;
    this.goals.forEach(function (g) { if (g.type === 'make' && (g.special === key || g.special === 'any') && g.progress < g.target) g.progress++; });
  };
  P.chocCount = function () { var n = 0; this.cells.forEach(function (c) { if (c.choc) n++; }); return n; };
  P.fuseCount = function () { var n = 0; this.cells.forEach(function (c) { if (c.tile && c.tile.fuse) n++; }); return n; };
  P.goalLeft = function (g) {
    if (g.type === 'score') return Math.max(0, g.target - this.score);
    if (g.type === 'chocolate') return this.chocCount();
    return Math.max(0, g.target - g.progress);
  };
  P.hitChoc = function (i) {
    var c = this.cells[i];
    if (c && c.crate) {
      c.crate--; this.score += 80;
      if (c.crate === 0) this.bump('crates');
      this.events.push({ type: 'crate', idx: i, left: c.crate });
      return;
    }
    if (!c || !c.choc) return;
    c.choc--; this.chocHitThisTurn = true; this.score += 100;
    this.events.push({ type: 'choc', idx: i, left: c.choc });
  };
  P.bumpColor = function (color) {
    this.goals.forEach(function (g) { if (g.type === 'color' && g.color === color && g.progress < g.target) g.progress++; });
  };

  P.clearCells = function (initial) {
    var cleared = new Set(), queue = Array.from(initial), self = this;
    while (queue.length) {
      var i = queue.pop();
      if (cleared.has(i)) continue;
      var c = this.cells[i];
      if (!c || c.hole) continue;
      cleared.add(i);
      var t = c.tile;
      if (t && t.special && !t.used) {
        t.used = true;
        var area = this.effectArea(i, t);
        this.events.push({ type: 'special', idx: i, special: t.special, area: area });
        for (var a = 0; a < area.length; a++) queue.push(area[a]);
      }
    }
    var n = 0, chocHit = new Set();
    cleared.forEach(function (i) {
      var c = self.cells[i];
      if (c.choc || c.crate) { chocHit.add(i); return; }
      if (c.tile) {
        var p = self.xy(i);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var x = p[0] + d[0], y = p[1] + d[1];
          var nc = (x >= 0 && y >= 0 && x < self.w && y < self.h) ? self.cells[self.idx(x, y)] : null;
          if (nc && (nc.choc || nc.crate)) chocHit.add(self.idx(x, y));
        });
      }
    });
    chocHit.forEach(function (i) { self.hitChoc(i); });
    cleared.forEach(function (i) {
      var c = self.cells[i];
      if (c.choc || c.crate) return;
      if (c.lock) { c.lock = 0; self.bump('locks'); self.events.push({ type: 'unlock', idx: i }); }
      if (c.ice > 0) { c.ice--; if (c.ice === 0) self.bump('ice'); self.events.push({ type: 'ice', idx: i, left: c.ice }); }
      var t = c.tile;
      if (!t || t.kind === 'ingredient') return;
      if (t.color >= 0) self.bumpColor(t.color);
      if (t.fuse) { self.bump('fuses'); self.events.push({ type: 'defuse', idx: i }); }
      self.events.push({ type: 'clear', idx: i, id: t.id, color: t.color, special: t.special });
      c.tile = null; n++;
    });
    this.score += n * 60 * Math.max(1, this.cascade);
    return cleared;
  };

  P.canSwap = function (a, b) {
    if (a == null || b == null || a === b) return false;
    var pa = this.xy(a), pb = this.xy(b);
    if (Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) !== 1) return false;
    var ca = this.cells[a], cb = this.cells[b];
    return !(this.blocked(ca) || this.blocked(cb) || !ca.tile || !cb.tile || ca.lock || cb.lock);
  };
  P.swapTiles = function (a, b) { var t = this.cells[a].tile; this.cells[a].tile = this.cells[b].tile; this.cells[b].tile = t; };
  P.isCombo = function (a, b) {
    var ta = this.cells[a].tile, tb = this.cells[b].tile;
    if (ta.kind !== 'candy' || tb.kind !== 'candy') return false;
    if (ta.special === RAINBOW || tb.special === RAINBOW) return true;
    return !!(ta.special && tb.special);
  };
  P.useMove = function () { if (isFinite(this.moves)) this.moves--; this.moveUsed = true; };

  P.trySwap = function (a, b) {
    if (this.moves <= 0 || !this.canSwap(a, b)) return { ok: false };
    this.cascade = 0; this.chocHitThisTurn = false;
    if (this.isCombo(a, b)) { this.swapTiles(a, b); this.useMove(); this.fireCombo(b, a); return { ok: true, combo: true }; }
    this.swapTiles(a, b);
    if (!this.matchAt(a) && !this.matchAt(b)) { this.swapTiles(a, b); return { ok: false }; }
    this.useMove();
    return { ok: true, combo: false };
  };

  P.fireCombo = function (at, other) {
    this.cascade = 1;
    var ta = this.cells[at].tile, tb = this.cells[other].tile;
    var p = this.xy(at), x = p[0], y = p[1], area = [], kind, self = this;
    var rA = ta.special === RAINBOW, rB = tb.special === RAINBOW;
    if (rA && rB) {
      ta.used = tb.used = true; kind = 'mega';
      area = this.cells.map(function (c, i) { return i; });
    } else if (rA || rB) {
      var rb = rA ? ta : tb, o = rA ? tb : ta;
      rb.used = true;
      if (o.special) {
        kind = 'rainbow-' + o.special;
        area = this.colorCells(o.color);
        area.forEach(function (k) {
          var tt = self.cells[k].tile;
          if (!tt.special) {
            tt.special = (o.special === ROW || o.special === COL) ? (self.rng.next() < 0.5 ? ROW : COL) : o.special;
            self.events.push({ type: 'convert', idx: k, id: tt.id, special: tt.special });
          }
        });
      } else {
        kind = 'rainbow';
        area = this.colorCells(o.color);
      }
    } else {
      ta.used = tb.used = true;
      var s = [ta.special, tb.special];
      var rockets = s.filter(function (v) { return v === ROW || v === COL; }).length;
      var bombs = s.filter(function (v) { return v === BOMB; }).length;
      if (rockets === 2) { kind = 'cross'; area = this.lineArea(x, y, 0); }
      else if (rockets === 1 && bombs === 1) { kind = 'bigcross'; area = this.lineArea(x, y, 1); }
      else { kind = 'star'; area = this.square(x, y, 2); } // Star Crusher (bomb + bomb)
    }
    area.push(at, other);
    this.bump('combo');
    this.events.push({ type: 'combo', kind: kind, idx: at, area: area });
    this.clearCells(new Set(area));
  };

  P.countIngredients = function () {
    var n = 0;
    this.cells.forEach(function (c) { if (c.tile && c.tile.kind === 'ingredient') n++; });
    return n;
  };
  P.spawnTile = function () {
    if (this.ingredientsPending > 0) {
      var onBoard = this.countIngredients();
      if (onBoard === 0 || (onBoard < 2 && this.rng.next() < 0.12)) {
        this.ingredientsPending--;
        return tile(-1, null, 'ingredient');
      }
    }
    var t = tile(this.randomColor());
    if (this.fuse && this.fuseCount() < this.fuse.n && this.rng.next() < (this.fuse.rate || 0.05)) t.fuse = this.fuse.start;
    return t;
  };

  P.gravity = function () {
    for (var x = 0; x < this.w; x++) {
      var col = [], tiles = [], y, k;
      for (y = 0; y < this.h; y++) { var i = this.idx(x, y); if (!this.blocked(this.cells[i])) col.push(i); }
      for (k = 0; k < col.length; k++) if (this.cells[col[k]].tile) tiles.push(this.cells[col[k]].tile);
      var empty = col.length - tiles.length;
      if (!empty) continue;
      for (k = 0; k < col.length; k++) this.cells[col[k]].tile = k >= empty ? tiles[k - empty] : null;
      for (k = empty - 1; k >= 0; k--) {
        var t = this.spawnTile();
        this.cells[col[k]].tile = t;
        this.events.push({ type: 'spawn', idx: col[k], id: t.id, from: this.xy(col[0])[1] + k - empty });
      }
    }
  };
  P.collectIngredients = function () {
    var any = false;
    for (var x = 0; x < this.w; x++) for (var y = this.h - 1; y >= 0; y--) {
      var i = this.idx(x, y), c = this.cells[i];
      if (this.blocked(c)) continue;
      if (c.tile && c.tile.kind === 'ingredient') {
        this.events.push({ type: 'collect', idx: i, id: c.tile.id });
        c.tile = null; this.bump('ingredients'); this.score += 1000; any = true;
      }
      break;
    }
    return any;
  };
  P.collapse = function () {
    var guard = 0;
    do { this.gravity(); } while (this.collectIngredients() && ++guard < 20);
  };

  P.matchAt = function (i) {
    var p = this.xy(i), x = p[0], y = p[1], c = this.colorAt(x, y);
    if (c < 0) return false;
    var l = x, r = x, u = y, d = y;
    while (this.colorAt(l - 1, y) === c) l--;
    while (this.colorAt(r + 1, y) === c) r++;
    if (r - l >= 2) return true;
    while (this.colorAt(x, u - 1) === c) u--;
    while (this.colorAt(x, d + 1) === c) d++;
    return d - u >= 2;
  };
  P.validMoves = function (limit) {
    var out = [];
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var a = this.idx(x, y), dirs = [[1, 0], [0, 1]];
      for (var d = 0; d < 2; d++) {
        var bx = x + dirs[d][0], by = y + dirs[d][1];
        if (bx >= this.w || by >= this.h) continue;
        var b = this.idx(bx, by);
        if (!this.canSwap(a, b)) continue;
        var ok = this.isCombo(a, b);
        if (!ok) { this.swapTiles(a, b); ok = this.matchAt(a) || this.matchAt(b); this.swapTiles(a, b); }
        if (ok) { out.push([a, b]); if (limit && out.length >= limit) return out; }
      }
    }
    return out;
  };
  P.findMove = function () { var m = this.validMoves(1); return m.length ? m[0] : null; };
  P.hasMoves = function () { return this.findMove() != null; };

  P.shuffle = function () {
    var idxs = [], self = this, attempt, k;
    this.cells.forEach(function (c, i) { if (!self.blocked(c) && !c.lock && c.tile && c.tile.kind === 'candy') idxs.push(i); });
    var tiles = idxs.map(function (i) { return self.cells[i].tile; });
    for (attempt = 0; attempt < 300; attempt++) {
      for (k = tiles.length - 1; k > 0; k--) { var j = this.rng.int(k + 1), t = tiles[k]; tiles[k] = tiles[j]; tiles[j] = t; }
      idxs.forEach(function (i, n) { self.cells[i].tile = tiles[n]; });
      if (this.findGroups().length === 0 && this.hasMoves()) { this.events.push({ type: 'shuffle' }); return true; }
    }
    for (attempt = 0; attempt < 300; attempt++) {
      idxs.forEach(function (i) { var t = self.cells[i].tile; if (!t.special) t.color = self.randomColor(); });
      if (this.findGroups().length === 0 && this.hasMoves()) { this.events.push({ type: 'shuffle' }); return true; }
    }
    return false;
  };

  P.spreadChocolate = function () {
    var cands = [], self = this;
    this.cells.forEach(function (c, i) {
      if (!c.choc) return;
      var p = self.xy(i);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var x = p[0] + d[0], y = p[1] + d[1];
        if (x < 0 || y < 0 || x >= self.w || y >= self.h) return;
        var j = self.idx(x, y), n = self.cells[j];
        if (!self.blocked(n) && !n.lock && n.tile && n.tile.kind === 'candy' && !n.tile.special) cands.push(j);
      });
    });
    if (!cands.length) return false;
    var j = cands[this.rng.int(cands.length)], c = this.cells[j];
    this.events.push({ type: 'chocGrow', idx: j, id: c.tile.id });
    c.tile = null; c.choc = 1;
    return true;
  };
  P.endTurn = function () {
    if (this.fuse && this.moveUsed && !this.isWon()) {
      var self = this;
      this.cells.forEach(function (c, i) {
        if (c.tile && c.tile.fuse) {
          c.tile.fuse--;
          self.events.push({ type: 'fuseTick', idx: i, left: c.tile.fuse });
          if (c.tile.fuse <= 0) { self.exploded = true; self.events.push({ type: 'fuseBoom', idx: i }); }
        }
      });
    }
    if (this.chocSpread && this.moveUsed && !this.chocHitThisTurn && !this.isWon() && this.chocCount() > 0) this.spreadChocolate();
    this.moveUsed = false; this.chocHitThisTurn = false;
    if (!this.isWon() && !this.hasMoves()) this.shuffle();
  };
  P.isWon = function () {
    var self = this;
    if (this.exploded) return false;
    return this.goals.every(function (g) { return self.goalLeft(g) <= 0; });
  };
  P.isLost = function () {
    if (this.exploded) return true;
    if (this.isWon()) return false;
    return this.level.time ? this.timeLeft <= 0 : this.moves <= 0;
  };
  P.stars = function () {
    var n = 0, s = this.score;
    (this.level.stars || []).forEach(function (t) { if (s >= t) n++; });
    return Math.max(n, this.isWon() ? 1 : 0);
  };

  // Boosters
  P.hammer = function (i) {
    var c = this.cells[i];
    if (c && (c.choc || c.crate)) { this.cascade = 1; this.hitChoc(i); return true; }
    if (!c || c.hole || !c.tile) return false;
    if (c.tile.kind === 'ingredient' && !c.ice && !c.lock) return false;
    this.cascade = 1;
    this.clearCells(new Set([i]));
    return true;
  };
  P.colourBlast = function (i) {
    var c = this.cells[i];
    if (!c || this.blocked(c) || !c.tile || c.tile.kind !== 'candy' || c.tile.special === RAINBOW) return false;
    this.cascade = 1;
    var area = this.colorCells(c.tile.color);
    this.events.push({ type: 'combo', kind: 'blast', idx: i, area: area });
    this.clearCells(new Set(area));
    return true;
  };
  P.magicSwap = function (a, b) {
    if (a == null || b == null || a === b) return { ok: false };
    var ca = this.cells[a], cb = this.cells[b];
    if (this.blocked(ca) || this.blocked(cb) || !ca.tile || !cb.tile || ca.lock || cb.lock) return { ok: false };
    this.swapTiles(a, b); this.cascade = 0;
    return { ok: true, matched: this.findGroups().length > 0 };
  };
  // Pick a plain candy (no special, lock, fuse) – used by finale and start boosters
  P.plainCandy = function () {
    var out = [], self = this;
    this.cells.forEach(function (c, i) { var t = c.tile; if (!self.blocked(c) && !c.lock && t && t.kind === 'candy' && !t.special && !t.fuse) out.push(i); });
    return out.length ? out[this.rng.int(out.length)] : null;
  };
  // Start booster: place a special before the first move
  P.placeStart = function (kind) {
    var i = this.plainCandy(); if (i == null) return null;
    var t = this.cells[i].tile;
    t.special = kind === 'rocket' ? (this.rng.next() < 0.5 ? ROW : COL) : kind === 'bomb' ? BOMB : RAINBOW;
    this.events.push({ type: 'convert', idx: i, id: t.id, special: t.special });
    return i;
  };
  // Sugar Rush finale, step 1: turn one leftover move into a rocket. Returns cell or null.
  P.finaleConvert = function () {
    if (!isFinite(this.moves) || this.moves <= 0) return null;
    var i = this.plainCandy(); if (i == null) return null;
    this.moves--;
    var t = this.cells[i].tile; t.special = this.rng.next() < 0.5 ? ROW : COL;
    this.score += 120;
    this.events.push({ type: 'convert', idx: i, id: t.id, special: t.special, finale: true });
    return i;
  };
  // Sugar Rush finale, step 2: fire every special on the board
  P.finaleFire = function () {
    var set = new Set();
    this.cells.forEach(function (c, i) { if (c.tile && c.tile.special && c.tile.special !== RAINBOW) set.add(i); });
    if (!set.size) return false;
    this.cascade = 1; this.clearCells(set);
    return true;
  };
  P.addMoves = function () { if (this.level.time) this.timeLeft += 15; else this.moves += 5; };

  // Goal-aware value of the current state (higher is better). Used by smart hints and the bot.
  P.scoreState = function () {
    var v = this.score / 100, self = this;
    this.goals.forEach(function (g) {
      if (g.type === 'score') v += Math.min(self.score, g.target) / 50;
      else v -= self.goalLeft(g) * (g.type === 'combo' ? 400 : g.type === 'make' ? 150 : 40);
    });
    if (this.isWon()) v += 100000;
    if (this.exploded) v -= 1000000;
    this.cells.forEach(function (c) {
      var t = c.tile; if (!t) return;
      if (t.fuse) v -= 400 / t.fuse;
      if (t.special) v += t.special === RAINBOW ? 30 : 15;
      if (t.kind === 'ingredient') v += self.xy(self.cells.indexOf(c))[1] * 2;
    });
    return v;
  };
  // Smart hint: simulate up to `limit` valid moves on copies of the board and return the best
  // one for this level's goals, as { move: [a, b], value }. All copies share the same refill seed
  // so moves are compared fairly.
  P.suggestMove = function (limit) {
    var mv = this.validMoves();
    if (!mv.length) return null;
    if (limit && mv.length > limit) { var step = mv.length / limit, pick = []; for (var k = 0; k < limit; k++) pick.push(mv[Math.floor(k * step)]); mv = pick; }
    var best = null, bv = -Infinity;
    for (var i = 0; i < mv.length; i++) {
      var c = this.clone(); c.rng = new Rng(987654321);
      if (!c.play(mv[i][0], mv[i][1])) continue;
      var v = c.scoreState();
      if (v > bv) { bv = v; best = mv[i]; }
    }
    return best ? { move: best, value: bv } : null;
  };

  // Full synchronous move, used by tests and the playtest bot
  P.play = function (a, b) {
    var r = this.trySwap(a, b);
    if (!r.ok) return false;
    if (!r.combo) this.matchStep([a, b]);
    for (var g = 0; g < 100; g++) { this.collapse(); if (!this.matchStep(null)) break; }
    this.endTurn();
    this.events.length = 0;
    return true;
  };
  P.clone = function () {
    var g = Object.create(Game.prototype);
    Object.assign(g, this);
    g.cells = this.cells.map(function (c) { return { hole: c.hole, choc: c.choc, crate: c.crate, ice: c.ice, lock: c.lock, tile: c.tile ? Object.assign({}, c.tile) : null }; });
    g.goals = this.goals.map(function (x) { return Object.assign({}, x); });
    g.rng = new Rng(this.rng.s);
    g.events = [];
    return g;
  };

  var api = { Game: Game, Rng: Rng, ROW: ROW, COL: COL, BOMB: BOMB, RAINBOW: RAINBOW, tile: tile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SweetEngine = api;
})(this);
