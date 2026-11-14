/* SWEETVERSE level data – 2026-11-14 v0.1 (30 levels, 3 worlds)
 * 2026-11-14 v0.2 difficulty tuned from bot playtest (moves, targets, star thresholds)
 * Layout legend: '.' normal  '#' hole  'i' ice  'I' double ice  'L' lock  'K' lock+ice
 * Colours: 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 purple
 */
(function (root) {
  'use strict';
  var R = 0, O = 1, Y = 2, G = 3, B = 4, Pu = 5;
  function score(t) { return { type: 'score', target: t }; }
  function color(c, t) { return { type: 'color', color: c, target: t }; }
  var ICE = { type: 'ice' }, LOCKS = { type: 'locks' };
  function ing(n) { return { type: 'ingredients', target: n }; }

  var defs = [
    // ---- World 1: Sugarleaf Meadow ----
    { moves: 20, colors: 5, goals: [score(1500)], tip: 'Swipe a sweet into its neighbour to line up 3 of a kind.' },
    { moves: 20, colors: 5, goals: [score(3000)], tip: 'Line up 4 to make a Rocket Burst. It clears a whole row or column.' },
    { moves: 18, colors: 5, goals: [color(R, 20)], tip: 'Line up 5 for a Rainbow Orb. Swap it with any sweet to clear that whole colour.' },
    { moves: 16, colors: 5, goals: [ICE], tip: 'Ice sits under sweets. Make matches on top of it to melt it.',
      layout: ['........', '........', '..iiii..', '..iiii..', '..iiii..', '..iiii..', '........', '........'] },
    { moves: 20, colors: 5, goals: [score(5000)], tip: 'Match in a T or L shape to make a Magic Bomb.',
      layout: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'] },
    { moves: 25, colors: 5, goals: [ing(2)], tip: 'Bring the acorns down to the bottom row to collect them.' },
    { moves: 22, colors: 5, goals: [LOCKS], tip: 'Locked sweets can’t be swapped. Match them to break the lock.',
      layout: ['........', '........', '........', 'LLLLLLLL', 'LLLLLLLL', '........', '........', '........'] },
    { moves: 28, colors: 5, goals: [ICE], tip: 'Thick ice needs two hits.',
      layout: ['........', '........', '........', '........', 'iiiiiiii', 'IIIIIIII', 'IIIIIIII', 'IIIIIIII'] },
    { time: 60, colors: 5, goals: [score(4000)], tip: 'Timed level! Score as much as you can before the clock runs out.' },
    { w: 9, h: 9, moves: 32, colors: 5, goals: [ICE, LOCKS, ing(2)], boss: true,
      tip: 'Boss: Grumble the Gumdrop Troll has frozen the meadow bridge. Melt it all!',
      layout: ['.........', '..LLLLL..', '.........', 'iiiiiiiii', 'iiiiiiiii', 'iiiiiiiii', '.........', '..LLLLL..', '.........'] },

    // ---- World 2: Frostberry Peaks ----
    { moves: 18, colors: 5, goals: [color(B, 25), color(G, 25)], tip: 'Two colours to collect. Rainbow Orbs help a lot.' },
    { moves: 18, colors: 5, goals: [ICE],
      layout: ['...ii...', '..iiii..', '.iiiiii.', 'iiiiiiii', 'iiiiiiii', '.iiiiii.', '..iiii..', '...ii...'] },
    { moves: 22, colors: 6, goals: [score(8000)], tip: 'Six colours now: matches are rarer, so plan cascades.' },
    { moves: 28, colors: 5, goals: [ing(3)],
      layout: ['........', '........', '...##...', '...##...', '........', '........', '........', '........'] },
    { moves: 26, colors: 5, goals: [ICE, LOCKS],
      layout: ['........', '..KKKK..', '..iiii..', 'LLiiiiLL', 'LLiiiiLL', '..iiii..', '..KKKK..', '........'] },
    { time: 75, colors: 6, goals: [score(9000)] },
    { w: 7, h: 7, moves: 22, colors: 6, goals: [color(Pu, 28)], tip: 'Small board, six colours. Every swap counts.' },
    { moves: 30, colors: 5, goals: [ICE],
      layout: ['........', '........', 'IIIIIIII', 'IIIIIIII', 'IIIIIIII', 'IIIIIIII', '........', '........'] },
    { moves: 30, colors: 5, goals: [ing(3), ICE],
      layout: ['........', '........', '........', '........', '........', '........', 'iiiiiiii', 'iiiiiiii'] },
    { w: 9, h: 9, moves: 40, colors: 6, goals: [ICE, LOCKS], boss: true,
      tip: 'Boss: Grumble has chained the Frost Gate. Break every lock!',
      layout: ['LLL...LLL', 'L.......L', 'L.iiiii.L', '..iIIIi..', '..iIIIi..', '..iIIIi..', 'L.iiiii.L', 'L.......L', 'LLL...LLL'] },

    // ---- World 3: Cocoa Caverns ----
    { moves: 24, colors: 6, goals: [score(12000)],
      layout: ['...##...', '........', '........', '#......#', '#......#', '........', '........', '...##...'] },
    { moves: 16, colors: 5, goals: [color(R, 35), color(Y, 35)] },
    { moves: 30, colors: 5, goals: [ICE],
      layout: ['IIIIIIII', 'I......I', 'I......I', 'I......I', 'I......I', 'I......I', 'I......I', 'IIIIIIII'] },
    { moves: 32, colors: 5, goals: [ing(4)] },
    { moves: 20, colors: 5, goals: [LOCKS, color(O, 30)],
      layout: ['........', 'LLLLLLLL', '........', '........', '........', '........', 'LLLLLLLL', '........'] },
    { time: 90, colors: 6, goals: [score(14000)] },
    { moves: 28, colors: 5, goals: [ICE], tip: 'A sweet heart for Pip. Melt it all!',
      layout: ['#ii##ii#', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii', '#iiiiii#', '##iiii##', '###ii###'] },
    { w: 9, h: 9, moves: 34, colors: 5, goals: [ICE, LOCKS, ing(3)],
      layout: ['.........', '.........', 'LL.....LL', 'iiiiiiiii', 'iiiiiiiii', 'iiiiiiiii', 'LL.....LL', '.........', '.........'] },
    { w: 9, h: 9, moves: 25, colors: 6, goals: [score(20000)] },
    { w: 9, h: 9, moves: 38, colors: 5, goals: [ICE, LOCKS, ing(3)], boss: true,
      tip: 'Final boss: Grumble’s Cocoa Vault. Free the last magic sweets!',
      layout: ['IIIIIIIII', 'I.......I', 'I.LLLLL.I', 'I.L...L.I', 'I.L...L.I', 'I.L...L.I', 'I.LLLLL.I', 'I.......I', 'IIIIIIIII'] }
  ];

  // Difficulty labels measured by the playtest bot (node test.js --bot 24) on 2026-11-14
  var DIFF = ["Easy","Easy","Easy","Easy","Easy","Hard","Easy","Hard","Easy","Easy","Easy","Medium","Easy","Hard","Easy","Easy","Hard","Easy","Hard","Super Hard","Medium","Medium","Hard","Hard","Hard","Easy","Hard","Medium","Easy","Hard"];
  var BOTWIN = [100,100,100,100,100,63,96,58,100,92,92,83,100,46,96,100,63,92,67,29,88,79,54,63,67,100,50,79,100,63];
  var LEVELS = defs.map(function (d, i) {
    var l = Object.assign({ w: 8, h: 8 }, d);
    l.id = i + 1;
    l.difficulty = DIFF[i]; l.botWin = BOTWIN[i];
    var sg = l.goals.filter(function (g) { return g.type === 'score'; })[0];
    if (sg) l.stars = [sg.target, Math.round(sg.target * 1.35), Math.round(sg.target * 1.8)];
    else { var base = (l.moves || 25) * 250; l.stars = [base, Math.round(base * 2.5), base * 4]; }
    return l;
  });

  var WORLDS = [
    { name: 'Sugarleaf Meadow', from: 1, to: 10, cls: 'w1',
      story: 'Grumble the Gumdrop Troll has scattered the magic sweets of the Sweetverse. Pip the sugar sprite sets off across the meadow to bring them home.' },
    { name: 'Frostberry Peaks', from: 11, to: 20, cls: 'w2',
      story: 'Grumble fled into the frozen peaks. Pip follows the trail of icy berries up the mountain.' },
    { name: 'Cocoa Caverns', from: 21, to: 30, cls: 'w3',
      story: 'Deep under the mountain, Grumble guards the Cocoa Vault, where the last magic sweets are hidden.' }
  ];

  var api = { LEVELS: LEVELS, WORLDS: WORLDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SWEET_LEVELS = LEVELS; root.SWEET_WORLDS = WORLDS; }
})(this);
