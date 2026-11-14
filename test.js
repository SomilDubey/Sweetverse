// SWEETVERSE engine tests + playtest bot – 2026-11-14 (v0.3: chocolate, goals, new boosters)
const assert = require('assert');
const E = require('./engine.js');
const { LEVELS } = require('./levels.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const plain = { w: 8, h: 8, moves: 20, colors: 6, goals: [{ type: 'score', target: 1 }], stars: [1, 2, 3] };
// Build a board from a colour grid (digits), '.' = random non-matching filler handled by caller
function fromGrid(rows, extra) {
  const g = new E.Game(Object.assign({}, plain, extra || {}), 1);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const c = g.cells[g.idx(x, y)];
    if (ch === '#') { c.hole = true; c.tile = null; return; }
    if (ch === 'a') { c.tile = E.tile(-1, null, 'ingredient'); return; }
    if (ch === 'R') { c.tile = E.tile(0, E.RAINBOW); return; }
    if (ch === 'H') { c.tile = E.tile(0, E.ROW); return; }
    if (ch === 'V') { c.tile = E.tile(1, E.COL); return; }
    if (ch === 'X') { c.tile = E.tile(2, E.BOMB); return; }
    c.tile = E.tile(+ch);
  }));
  return g;
}
// filler with no accidental matches: alternating pattern of colours 3,4,5
const F = ['34534534', '45345345', '53453453', '34534534', '45345345', '53453453', '34534534', '45345345'];
function grid(overrides) { return F.map((r, y) => overrides[y] ? overrides[y] : r); }

console.log('Engine rules');
test('new boards have no matches and at least one move (all 30 levels x 20 seeds)', () => {
  LEVELS.forEach(l => { for (let s = 1; s <= 20; s++) { const g = new E.Game(l, s * 7919);
    assert.strictEqual(g.findGroups().length, 0, 'level ' + l.id); assert.ok(g.hasMoves(), 'no move level ' + l.id); } });
});
test('horizontal match of 3 detected and cleared', () => {
  const g = fromGrid(grid({ 0: '00134534' }));
  // swap (2,0)<->(2,1)? simpler: place 0 at (2,1) and swap up
  g.cells[g.idx(2, 1)].tile = E.tile(0);
  assert.ok(g.trySwap(g.idx(2, 0), g.idx(2, 1)).ok);
  g.matchStep([g.idx(2, 0), g.idx(2, 1)]);
  assert.strictEqual(g.cells[0].tile, null); assert.strictEqual(g.cells[1].tile, null); assert.strictEqual(g.cells[2].tile, null);
});
test('invalid swap is rejected and reverted, no move used', () => {
  const g = fromGrid(grid({}));
  const before = g.cells[0].tile.id;
  assert.strictEqual(g.trySwap(0, 1).ok, false);
  assert.strictEqual(g.cells[0].tile.id, before); assert.strictEqual(g.moves, 20);
});
test('match 4 creates Rocket at swapped cell', () => {
  const g = fromGrid(grid({ 0: '00304534', 1: '45045345' }));
  const a = g.idx(2, 1), b = g.idx(2, 0);
  assert.ok(g.trySwap(a, b).ok); g.matchStep([a, b]);
  const t = g.cells[b].tile; assert.ok(t && t.special === E.ROW, 'got ' + (t && t.special));
});
test('match 5 creates Rainbow Orb', () => {
  const g = fromGrid(grid({ 0: '00300534', 1: '45045345' }));
  const a = g.idx(2, 1), b = g.idx(2, 0);
  assert.ok(g.trySwap(a, b).ok); g.matchStep([a, b]);
  assert.strictEqual(g.cells[b].tile.special, E.RAINBOW);
});
test('L shape creates Magic Bomb', () => {
  const g = fromGrid(grid({ 0: '00345345', 1: '45045345', 2: '53053453', 3: '34034534' }));
  // vertical 0s at x=2 rows1-3; horizontal 0,0 at row0 x0-1; swap (2,0) '3' with nothing: put 0 via swap from (3,0)? place 0 at (3,0) and swap with (2,0)
  g.cells[g.idx(2, 0)].tile = E.tile(3); g.cells[g.idx(3, 0)].tile = E.tile(0);
  const a = g.idx(3, 0), b = g.idx(2, 0);
  assert.ok(g.trySwap(a, b).ok); g.matchStep([a, b]);
  assert.strictEqual(g.cells[b].tile.special, E.BOMB);
});
test('Rocket clears full row when triggered', () => {
  const g = fromGrid(grid({ 3: 'H00' + F[3].slice(3) }));
  g.cascade = 1; g.clearCells(new Set([g.idx(0, 3)]));
  for (let x = 0; x < 8; x++) assert.strictEqual(g.cells[g.idx(x, 3)].tile, null);
});
test('Rainbow + candy clears every candy of that colour', () => {
  const g = fromGrid(grid({ 0: 'R3' + F[0].slice(2) }));
  const n3 = g.cells.filter(c => c.tile && c.tile.color === 3 && !c.tile.special).length;
  assert.ok(g.trySwap(0, 1).ok);
  assert.strictEqual(g.cells.filter(c => c.tile && c.tile.color === 3).length, 0);
  assert.ok(n3 > 5);
});
test('Bomb + Bomb = Star Crusher clears 5x5', () => {
  const g = fromGrid(grid({ 4: '345XX534' }));
  assert.ok(g.trySwap(g.idx(3, 4), g.idx(4, 4)).ok);
  for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) assert.strictEqual(g.cells[g.idx(x, y)].tile, null, x + ',' + y);
});
test('Rocket + Rocket clears row and column', () => {
  const g = fromGrid(grid({ 4: '345HV534' }));
  assert.ok(g.trySwap(g.idx(3, 4), g.idx(4, 4)).ok);
  for (let k = 0; k < 8; k++) { assert.strictEqual(g.cells[g.idx(k, 4)].tile, null); assert.strictEqual(g.cells[g.idx(4, k)].tile, null); }
});
test('gravity + refill leaves no empty playable cell', () => {
  const g = new E.Game(LEVELS[4], 3);
  g.clearCells(new Set([0, 9, 18, 27, 36]));
  g.collapse();
  g.cells.forEach(c => { if (!c.hole && !c.choc) assert.ok(c.tile); });
});
test('ice: single hit melts ice, double ice needs two', () => {
  const g = new E.Game(LEVELS[16], 5);
  const i = g.idx(0, 7); assert.strictEqual(g.cells[i].ice, 2);
  g.clearCells(new Set([i])); assert.strictEqual(g.cells[i].ice, 1);
  g.collapse(); g.clearCells(new Set([i])); assert.strictEqual(g.cells[i].ice, 0);
  assert.strictEqual(g.goals[0].progress, 1);
});
test('locked tiles cannot be swapped; clearing breaks the lock', () => {
  const g = new E.Game(LEVELS[6], 9);
  const i = g.idx(0, 3);
  assert.strictEqual(g.canSwap(i, g.idx(0, 2)), false);
  g.clearCells(new Set([i])); assert.strictEqual(g.cells[i].lock, 0);
  assert.strictEqual(g.goals[0].progress, 1);
});
test('ingredient reaching bottom row is collected', () => {
  const g = fromGrid(grid({ 6: 'a' + F[6].slice(1) }), { goals: [{ type: 'ingredients', target: 1 }] });
  g.clearCells(new Set([g.idx(0, 7)])); g.collapse();
  assert.strictEqual(g.goals[0].progress, 1); assert.ok(g.isWon());
});
test('ingredients are immune to matches and specials', () => {
  const g = fromGrid(grid({ 3: 'Ha' + F[3].slice(2) }));
  g.cascade = 1; g.clearCells(new Set([g.idx(0, 3)]));
  assert.strictEqual(g.cells[g.idx(1, 3)].tile.kind, 'ingredient');
});
test('shuffle produces a board with no matches and a valid move', () => {
  for (let s = 1; s < 30; s++) { const g = new E.Game(LEVELS[12], s); g.shuffle(); assert.strictEqual(g.findGroups().length, 0); assert.ok(g.hasMoves()); }
});
test('hammer clears a tile; refuses bare ingredient', () => {
  const g = fromGrid(grid({ 0: 'a' + F[0].slice(1) }));
  assert.strictEqual(g.hammer(0), false); assert.ok(g.hammer(1)); assert.strictEqual(g.cells[1].tile, null);
});
test('extra moves booster adds 5 moves (15s on timed)', () => {
  const g = new E.Game(LEVELS[0], 1); g.addMoves(); assert.strictEqual(g.moves, LEVELS[0].moves + 5);
  const tl = LEVELS.find(l => l.time); const t = new E.Game(tl, 1); t.addMoves(); assert.strictEqual(t.timeLeft, tl.time + 15);
});
test('cascade multiplier increases score per tile', () => {
  const g = fromGrid(grid({}));
  g.cascade = 1; g.clearCells(new Set([0])); const s1 = g.score;
  g.cascade = 3; g.clearCells(new Set([1])); assert.strictEqual(g.score - s1, 180);
});
test('chocolate: blocks swaps, is damaged by adjacent clears, two layers need two hits', () => {
  const g = new E.Game({ w: 8, h: 8, moves: 20, colors: 6, goals: [{ type: 'chocolate' }], layout: ['........','........','........','...D....','........','........','........','........'] }, 4);
  const c = g.idx(3, 3); assert.strictEqual(g.cells[c].choc, 2); assert.strictEqual(g.cells[c].tile, null);
  assert.strictEqual(g.canSwap(c, g.idx(3, 2)), false);
  g.cascade = 1; g.clearCells(new Set([g.idx(3, 2)])); assert.strictEqual(g.cells[c].choc, 1);
  g.collapse(); g.clearCells(new Set([g.idx(2, 3)])); assert.strictEqual(g.cells[c].choc, 0);
  assert.strictEqual(g.goalLeft(g.goals[0]), 0); assert.ok(g.isWon());
  g.collapse(); assert.ok(g.cells[c].tile, 'freed cell is refilled');
});
test('chocolate spreads when a move hits none, and not when one is hit', () => {
  const lvl = { w: 8, h: 8, moves: 20, colors: 6, goals: [{ type: 'chocolate' }], layout: ['C.......','........','........','........','........','........','........','........'] };
  let spread = 0, held = 0;
  for (let s = 1; s <= 20; s++) { const g = new E.Game(lvl, s); const mv = g.validMoves().find(([a, b]) => g.xy(a)[1] > 2 && g.xy(b)[1] > 2);
    if (!mv) continue; const before = g.chocCount(); g.play(mv[0], mv[1]); if (g.chocCount() > before) spread++; else if (g.chocHitThisTurn === false) held++; }
  assert.ok(spread > 10, 'spread ' + spread);
  const g = new E.Game(lvl, 3); g.moveUsed = true; g.hitChoc(0); g.endTurn(); assert.strictEqual(g.chocCount(), 0);
});
test('goal: make specials counts rockets/bombs/rainbows', () => {
  const g = fromGrid(grid({ 0: '00304534', 1: '45045345' }), { goals: [{ type: 'make', special: 'rocket', target: 1 }] });
  const a = g.idx(2, 1), b = g.idx(2, 0); g.trySwap(a, b); g.matchStep([a, b]);
  assert.strictEqual(g.goals[0].progress, 1); assert.ok(g.isWon());
});
test('goal: combo counts special+special swaps', () => {
  const g = fromGrid(grid({ 4: '345HX534' }), { goals: [{ type: 'combo', target: 1 }] });
  assert.ok(g.trySwap(g.idx(3, 4), g.idx(4, 4)).combo); assert.ok(g.isWon());
});
test('booster Colour Blast clears a colour; refuses rainbow', () => {
  const g = fromGrid(grid({ 0: 'R' + F[0].slice(1) }));
  assert.strictEqual(g.colourBlast(0), false);
  assert.ok(g.colourBlast(1)); assert.strictEqual(g.cells.filter(c => c.tile && c.tile.color === 4 && !c.tile.special).length, 0);
});
test('booster Magic Swap swaps any two free tiles without using a move', () => {
  const g = fromGrid(grid({}));
  const t0 = g.cells[0].tile.id, t9 = g.cells[63].tile.id;
  const r = g.magicSwap(0, 63); assert.ok(r.ok); assert.strictEqual(g.cells[0].tile.id, t9); assert.strictEqual(g.cells[63].tile.id, t0); assert.strictEqual(g.moves, 20);
  g.cells[5].lock = 1; assert.strictEqual(g.magicSwap(5, 6).ok, false);
});
test('hammer chips chocolate', () => {
  const g = new E.Game({ w: 8, h: 8, moves: 20, colors: 6, goals: [{ type: 'chocolate' }], layout: ['D.......'] }, 2);
  assert.ok(g.hammer(0)); assert.strictEqual(g.cells[0].choc, 1);
});
test('fuzz: 300 random games keep invariants (stable board, no gaps, a move always exists)', () => {
  for (let s = 1; s <= 300; s++) {
    const l = LEVELS[s % LEVELS.length]; const g = new E.Game(l, s * 31);
    for (let m = 0; m < 25 && !g.isWon() && g.moves > 0; m++) {
      const mv = g.validMoves(); assert.ok(mv.length, 'no moves L' + l.id + ' seed ' + s);
      const [a, b] = mv[g.rng.int(mv.length)]; assert.ok(g.play(a, b));
      assert.strictEqual(g.findGroups().length, 0, 'unstable board');
      g.cells.forEach(c => { if (!c.hole && !c.choc) assert.ok(c.tile, 'gap L' + l.id); });
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);

// ---------- Playtest bot: greedy 1-ply lookahead ----------
if (process.argv.includes('--bot')) {
  function evalState(g) {
    let v = g.score / 100;
    g.goals.forEach(goal => { if (goal.type !== 'score') v -= g.goalLeft(goal) * (goal.type === 'combo' ? 400 : goal.type === 'make' ? 150 : 40); else v += Math.min(g.score, goal.target) / 50; });
    if (g.isWon()) v += 100000;
    return v;
  }
  const runs = +(process.argv[process.argv.indexOf('--bot') + 1] || 20);
  console.log('\nBot playtest (' + runs + ' runs per level, greedy bot; humans with planning do better)');
  const out = [];
  LEVELS.forEach(l => {
    let wins = 0, starSum = 0;
    for (let r = 0; r < runs; r++) {
      const g = new E.Game(l, 1000 + r * 97);
      let turns = 0;
      const maxTurns = l.time ? Math.round(l.time / 3) : Infinity; // ~3s per move for a human
      while (!g.isWon() && g.moves > 0 && turns < maxTurns) {
        const mv = g.validMoves(); let best = null, bv = -Infinity;
        for (const [a, b] of mv) { const c = g.clone(); c.play(a, b); const v = evalState(c) + g.rng.next(); if (v > bv) { bv = v; best = [a, b]; } }
        g.play(best[0], best[1]); turns++;
      }
      if (g.isWon()) { wins++; starSum += g.stars(); }
    }
    const rate = wins / runs;
    out.push({ id: l.id, rate, stars: wins ? (starSum / wins).toFixed(1) : '-' });
    console.log(`  L${String(l.id).padStart(2)}  win ${String(Math.round(rate * 100)).padStart(3)}%  avg stars ${wins ? (starSum / wins).toFixed(1) : '-'}`);
  });
  require('fs').writeFileSync(__dirname + '/bot-results.json', JSON.stringify(out));
}
process.exitCode = failed ? 1 : 0;
