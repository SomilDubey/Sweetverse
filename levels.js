/* SWEETVERSE level data
 * 2026-11-14 v0.1 initial 30 levels (previous version archived in archive/levels.v02.js)
 * 2026-11-14 v0.3 re-planned to brief bands: 1-5 tutorial, 6-10 obstacles & move limits,
 *                 11-15 special candies, 16-20 ice & blockers, 21-25 multi-objective,
 *                 26-30 advanced combinations. Difficulty labels measured by playtest bot.
 *
 * Layout legend: '.' normal  '#' hole  'i' ice  'I' double ice  'L' lock  'K' lock+ice
 *                'C' chocolate  'D' double chocolate
 * Colours: 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 purple
 * Goal types: score, color, ice, locks, ingredients, chocolate, make (rocket|bomb|rainbow|any), combo
 */
(function (root) {
  'use strict';
  var R = 0, Y = 2, G = 3, B = 4;
  function score(t) { return { type: 'score', target: t }; }
  function color(c, t) { return { type: 'color', color: c, target: t }; }
  function make(sp, t) { return { type: 'make', special: sp, target: t }; }
  function combo(t) { return { type: 'combo', target: t }; }
  function ing(n) { return { type: 'ingredients', target: n }; }
  var ICE = { type: 'ice' }, LOCKS = { type: 'locks' }, CHOC = { type: 'chocolate' };
  var E8 = '........', E9 = '.........';

  var defs = [
    // ---- 1-5 Tutorials: simple matching ----
    { moves: 15, colors: 5, goals: [score(1000)], tip: 'Swipe a sweet into its neighbour to line up 3 of a kind. You can also tap one sweet, then tap its neighbour.' },
    { moves: 16, colors: 5, goals: [color(R, 15)], tip: 'Collect the red sweets. Line up 4 in a row to make a Rocket: it clears a whole row or column.' },
    { w: 7, h: 7, moves: 16, colors: 5, goals: [score(2500)], tip: 'Match in a T or L shape to make a Magic Bomb. It blows up everything around it.' },
    { moves: 20, colors: 5, goals: [color(B, 18), color(Y, 18)], tip: 'Line up 5 for a Rainbow Orb. Swap it with any sweet to clear every sweet of that colour.' },
    { moves: 20, colors: 6, goals: [score(4000)], tip: 'Six colours now, so matches are rarer. Matches near the bottom make more cascades.' },

    // ---- 6-10 Obstacles & move limits ----
    { moves: 15, colors: 5, goals: [ICE], tip: 'Ice sits under the sweets. Make matches on top of it to melt it.',
      layout: [E8, E8, '..iiii..', '..iiii..', '..iiii..', '..iiii..', E8, E8] },
    { moves: 18, colors: 5, goals: [LOCKS], tip: 'Locked sweets can’t be moved. Match them where they are to break the lock.',
      layout: [E8, E8, E8, 'LLLLLLLL', 'LLLLLLLL', E8, E8, E8] },
    { moves: 22, colors: 5, goals: [ing(2)], tip: 'Bring the acorns down to the bottom row to collect them. Clear the sweets underneath.' },
    { moves: 13, colors: 5, goals: [score(4500)], tip: 'Only 13 moves on an odd-shaped board. Make every swap count.',
      layout: ['##....##', '#......#', E8, E8, E8, E8, '#......#', '##....##'] },
    { w: 9, h: 9, moves: 30, colors: 5, goals: [ICE, LOCKS], boss: true,
      tip: 'Boss: Grumble the Gumdrop Troll has frozen and chained the meadow bridge!',
      layout: [E9, '..LLLLL..', E9, 'iiiiiiiii', 'iiiiiiiii', 'iiiiiiiii', E9, '..LLLLL..', E9] },

    // ---- 11-15 Special candies ----
    { moves: 16, colors: 5, goals: [make('rocket', 3)], tip: 'Make 3 Rockets by lining up 4 sweets.' },
    { moves: 18, colors: 5, goals: [make('bomb', 2)], tip: 'Make 2 Magic Bombs with T or L shapes. Look for two lines that cross.' },
    { moves: 24, colors: 5, goals: [make('rainbow', 1), score(5000)], tip: 'Make a Rainbow Orb by lining up 5 in a row.' },
    { moves: 26, colors: 5, goals: [combo(1)], tip: 'Swap two special sweets into each other for a Mega Blast. Rainbow + anything = Colour Explosion!' },
    { w: 9, h: 9, moves: 22, colors: 5, goals: [make('any', 6), score(9000)], boss: true,
      tip: 'Boss: Grumble is hiding in the hedges. Blast him out with specials!' },

    // ---- 16-20 Ice & blockers ----
    { moves: 15, colors: 5, goals: [CHOC], chocSpread: false, tip: 'Chocolate blocks the board. Match next to it to break it.',
      layout: [E8, E8, E8, '.CC..CC.', '.CC..CC.', E8, E8, E8] },
    { moves: 28, colors: 5, goals: [ICE], tip: 'Thick ice takes two hits.',
      layout: [E8, E8, E8, E8, 'iiiiiiii', 'IIIIIIII', 'IIIIIIII', 'IIIIIIII'] },
    { moves: 24, colors: 5, goals: [CHOC], tip: 'Careful: this chocolate grows by one square every turn you don’t break any. Dark chocolate takes two hits.',
      layout: [E8, E8, E8, E8, E8, '..DDDD..', '.CCCCCC.', 'CCCCCCCC'] },
    { moves: 26, colors: 5, goals: [ICE, CHOC],
      layout: ['CC....CC', 'C......C', '..iiii..', '..iIIi..', '..iIIi..', '..iiii..', 'C......C', 'CC....CC'] },
    { w: 9, h: 9, moves: 34, colors: 5, goals: [CHOC, ICE, LOCKS], boss: true,
      tip: 'Boss: Grumble has walled himself in with dark chocolate!',
      layout: ['L.......L', '.DDDDDDD.', '.D.....D.', '.D.iii.D.', '.D.iIi.D.', '.D.iii.D.', '.D.....D.', '.DDDDDDD.', 'L.......L'] },

    // ---- 21-25 Multi-objective ----
    { moves: 24, colors: 5, goals: [color(R, 25), ICE],
      layout: [E8, E8, E8, E8, E8, 'iiiiiiii', 'iiiiiiii', 'iiiiiiii'] },
    { moves: 28, colors: 5, goals: [ing(3), CHOC],
      layout: [E8, E8, E8, 'CC....CC', E8, E8, E8, E8] },
    { time: 60, colors: 5, goals: [score(8000), make('rocket', 3)], tip: 'Timed level! Reach the score and make 3 Rockets before the clock runs out.' },
    { moves: 26, colors: 5, goals: [LOCKS, color(G, 30), ICE],
      layout: [E8, 'KKKKKKKK', E8, E8, E8, E8, 'KKKKKKKK', E8] },
    { w: 9, h: 9, moves: 28, colors: 5, goals: [ICE, CHOC, ing(2)], boss: true,
      tip: 'Boss: Grumble’s frosty storeroom. Rescue the acorns!',
      layout: [E9, E9, 'C.......C', 'iiiiiiiii', 'iiiiiiiii', 'iiiiiiiii', 'C.......C', E9, E9] },

    // ---- 26-30 Advanced combinations ----
    { moves: 26, colors: 5, goals: [combo(2)], tip: 'Fire 2 special combos. Set up specials next to each other before you trigger them.' },
    { moves: 30, colors: 5, goals: [combo(2), ICE],
      layout: ['IIIIIIII', 'I......I', 'I......I', 'I......I', 'I......I', 'I......I', 'I......I', 'IIIIIIII'] },
    { moves: 30, colors: 5, goals: [make('rainbow', 2), CHOC],
      layout: [E8, E8, E8, E8, E8, E8, 'CCCCCCCC', 'CCCCCCCC'] },
    { w: 9, h: 9, moves: 30, colors: 6, goals: [combo(2), score(15000)] },
    { w: 9, h: 9, moves: 42, colors: 5, goals: [combo(2), CHOC, ICE, ing(2)], boss: true,
      tip: 'Final boss: Grumble’s Cocoa Vault. Free the last magic sweets!',
      layout: ['IIIIIIIII', 'I.......I', 'I.DDDDD.I', 'I.D...D.I', 'I.D...D.I', 'I.D...D.I', 'I.DDDDD.I', 'I.......I', 'IIIIIIIII'] }
  ];

  // Difficulty labels measured by the playtest bot (node test.js --bot 24) on 2026-11-14
  var DIFF = ["Easy","Easy","Easy","Easy","Easy","Easy","Medium","Hard","Easy","Easy","Easy","Easy","Easy","Easy","Easy","Easy","Hard","Medium","Easy","Medium","Medium","Hard","Easy","Easy","Medium","Medium","Hard","Medium","Super Hard","Super Hard"];
  var BOTWIN = [100,100,100,100,100,100,83,58,100,96,100,100,92,92,100,100,58,83,92,83,88,58,100,92,75,75,50,79,29,33];

  var LEVELS = defs.map(function (d, i) {
    var l = Object.assign({ w: 8, h: 8 }, d);
    l.id = i + 1;
    l.difficulty = DIFF ? DIFF[i] : 'Easy'; l.botWin = BOTWIN ? BOTWIN[i] : null;
    var sg = l.goals.filter(function (g) { return g.type === 'score'; })[0];
    if (sg) l.stars = [sg.target, Math.round(sg.target * 1.35), Math.round(sg.target * 1.8)];
    else { var base = (l.moves || 25) * 250; l.stars = [base, Math.round(base * 2.5), base * 4]; }
    l.target = l.stars[0]; // target score shown in HUD
    return l;
  });

  var WORLDS = [
    { name: 'Sugarleaf Meadow', from: 1, to: 10, cls: 'w1', icon: '🌸',
      story: 'Grumble the Gumdrop Troll has scattered the magic sweets of the Sweetverse. Pip the sugar sprite sets off across the meadow to bring them home.' },
    { name: 'Frostberry Peaks', from: 11, to: 20, cls: 'w2', icon: '🏔️',
      story: 'Grumble fled into the frozen peaks, leaving walls of chocolate behind him. Pip follows the trail of icy berries.' },
    { name: 'Cocoa Caverns', from: 21, to: 30, cls: 'w3', icon: '🍫',
      story: 'Deep under the mountain, Grumble guards the Cocoa Vault, where the last magic sweets are hidden.' }
  ];

  var api = { LEVELS: LEVELS, WORLDS: WORLDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SWEET_LEVELS = LEVELS; root.SWEET_WORLDS = WORLDS; }
})(this);
