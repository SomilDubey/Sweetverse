# SWEETVERSE – Match & Magic (playable prototype)

**Version:** v0.3 · **Date:** 2026-11-14

An original match-3 puzzle game that runs in any modern browser, on phone, tablet or desktop.
It is one self-contained HTML file with no external assets, APIs or paid services.

## Changelog
- **2026-11-14 v0.3** Re-planned the 30 levels to the brief's six progression bands. Added chocolate blockers (1–2 layers, spreading), goals for making specials and firing combos, and two new boosters (Colour Blast, Magic Swap). New screens: splash, main menu, player profile with stats, achievements, daily reward, coins, booster inventory. Canvas particle system, volume sliders, reduced-motion mode, landscape layout, session-only storage fallback. Fixed: world background hidden behind the board; booster labels unreadable; map title wrapping.
- **2026-11-14 v0.2** Bot-tuned difficulty and star thresholds.
- **2026-11-14 v0.1** Engine, 30 levels, home/map/game screens, synthesised audio.

Earlier versions of changed files are kept in `archive/`.

---

## 1. Files

| File | What it is |
|---|---|
| `sweetverse.html` | **The game.** Built output: one file, open it in a browser. |
| `engine.js` | Game-state engine. Pure logic, no DOM: board, matching, specials, combos, gravity, obstacles, goals, boosters. Runs in Node too. |
| `levels.js` | All level data plus world definitions. Add levels here. |
| `ui.js` | Rendering, input, screens, audio, rewards, storage. |
| `style.css` | All visuals (candies, obstacles, screens). Everything is drawn with CSS gradients, clip-paths and Canvas. |
| `template.html` | Page skeleton. `build.py` inlines the CSS and JS into it. |
| `build.py` | Builds `sweetverse.html`. |
| `test.js` | 27 engine unit tests, plus the playtest bot (`--bot N`). |
| `smoke.py` | 31 browser tests in real Chrome (mouse, touch, reload). |
| `archive/` | Previous versions of replaced files. |

## 2. How to run, test and change it (step by step)

**Play:** double-click `sweetverse.html`, or open it in Chrome or Safari on your phone.

**Change something and rebuild.** In a terminal, inside the `sweetverse` folder:
```bash
# 1. edit engine.js / levels.js / ui.js / style.css
python3 build.py              # 2. rebuilds sweetverse.html
node test.js                  # 3. engine tests (needs Node 18+)
node test.js --bot 24         # 4. optional: replays every level 24 times, prints win rates
pip install playwright && playwright install chromium   # one-time setup for browser tests
python3 smoke.py              # 5. browser tests (edit the chrome path at the top if needed)
```

**Add a level.** Open `levels.js` and add an object to the `defs` array, for example:
```js
{ moves: 25, colors: 5, goals: [ICE, make('bomb', 2)], tip: 'Pip says hi',
  layout: ['........','..iiii..','..iIIi..','..iIIi..','..iiii..','.CC..CC.','LLLLLLLL','........'] }
```
Layout key: `.` normal · `#` hole · `i` ice · `I` double ice · `L` lock · `K` lock+ice · `C` chocolate · `D` dark chocolate.
Goal types: `score`, `color`, `ice`, `locks`, `ingredients`, `chocolate`, `make` (rocket/bomb/rainbow/any), `combo`.
Then run `node test.js --bot 24` to measure difficulty, and paste the new labels into `DIFF`/`BOTWIN`. Add a world to `WORLDS` for every 10 levels.

## 3. Taking it outside Claude

**A. Put it on the web (free, about 5 minutes)**
1. Create a GitHub repo, upload `sweetverse.html` and rename it to `index.html`.
2. In the repo, go to Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
3. The game goes live at `https://<your-username>.github.io/<repo>/`. Netlify Drop (drag the file onto app.netlify.com/drop) also works.

**B. Wrap it as an Android/iOS app with Capacitor**
```bash
mkdir sweetverse-app && cd sweetverse-app
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
mkdir www && cp ../sweetverse/sweetverse.html www/index.html
npx cap init Sweetverse com.yourname.sweetverse --web-dir www
npx cap add android         # then: npx cap open android → build the APK/AAB in Android Studio
npx cap add ios             # macOS + Xcode only
```
Lock the app to portrait in `AndroidManifest.xml` (`android:screenOrientation="portrait"`) and in Xcode (Deployment Info).

**C. Inside a Flutter app.** Ship `sweetverse.html` as an asset and load it in a `webview_flutter` `WebViewController` with `loadFlutterAsset`. This works, but Capacitor is less effort.

**D. Port to a native engine later.** `engine.js` has no DOM code and emits a list of events (`match`, `clear`, `special`, `spawn`, …). That makes it a direct reference for a C#/Dart port. Keep the tests: port `test.js` alongside it.

---

## 4. Testing report (actual results, 2026-11-14)

### 4a. Engine unit tests: `node test.js` → **27 passed, 0 failed**
Covers: no matches and at least one move on every new board (30 levels × 20 seeds); horizontal/vertical matches; invalid swap rejected with no move used; 4-match → Rocket; 5-match → Rainbow Orb; L-shape → Magic Bomb; Rocket clears its row; Rainbow + candy clears that colour; Bomb + Bomb = Star Crusher (5×5); Rocket + Rocket clears row and column; gravity and refill leave no gaps; single and double ice; locks; acorns collected at the bottom and immune to blasts; shuffle always produces a playable board; hammer; extra moves (and +15 s on timed levels); cascade multiplier; chocolate (blocking, adjacent damage, two layers, spreading or not spreading); make-special and combo goals; Colour Blast; Magic Swap; hammer on chocolate. Plus a **fuzz test: 300 random games across all levels**, checking after every move that the board is stable, has no gaps and always has a valid move.

### 4b. Browser tests: `python3 smoke.py` → **31 / 31 PASS** (run twice, same result)
Real Chrome at 390×844 (phone), then 844×390 (landscape), 820×1180 (tablet) and 1440×900 (desktop). Mouse drags, CDP **touch** swipes and taps.

| Test | Result | Note |
|---|---|---|
| Splash -> main menu | PASS |  |
| Daily reward claim adds coins | PASS | 100->150 |
| Daily reward cannot be claimed twice | PASS |  |
| Booster inventory: buy Magic Swap with coins | PASS |  |
| Profile: rename + avatar | PASS |  |
| Locked level cannot be opened | PASS |  |
| Valid swap (mouse drag) | PASS | moves 15->14 score 0->180 |
| Board refilled, stable after cascades | PASS | matches left 0, empty 0, tiles 64 |
| Valid swap (touch swipe) | PASS | moves 14->13 |
| Invalid swap rejected, no move used | PASS |  |
| Tap-to-select then tap neighbour swaps | PASS |  |
| Four-match creates a Rocket (live UI) | PASS | specials on board 1 |
| Special + special combo fires (Mega Blast XL) | PASS |  |
| Hammer booster | PASS |  |
| Colour Blast booster | PASS |  |
| Magic Swap booster (no move used) | PASS | tiles [255, 88]->[88, 255] |
| Shuffle booster | PASS |  |
| Extra Moves booster | PASS |  |
| Booster mode can be cancelled | PASS |  |
| Pause and resume | PASS |  |
| Restart (with confirmation) | PASS |  |
| Level completion: victory screen, stars, coins | PASS |  |
| Achievement unlocked on first win | PASS |  |
| Level failure: defeat screen | PASS |  |
| Retry after failure | PASS |  |
| Chocolate visible on level 20 | PASS |  |
| Particle pool empties when idle (no growth) | PASS |  |
| Landscape layout fits screen | PASS |  |
| No page scroll during gameplay | PASS |  |
| Save and restore after reload (localStorage) | PASS | [2,{"1":3},"Somil",368] |
| No console errors | PASS |  |

### 4c. Playtest bot: `node test.js --bot 24`
A greedy one-move-lookahead bot plays every level 24 times. Real players who plan ahead should do better. The win rate sets each level's difficulty label (≥90% Easy, ≥70% Medium, ≥45% Hard, below that Super Hard).

| Level | Board | Limit | Goals | Difficulty | Bot win |
|---|---|---|---|---|---|
| 1 | 8x8 | 15 moves | score 1000 | Easy | 100% |
| 2 | 8x8 | 16 moves | color 15 | Easy | 100% |
| 3 | 7x7 | 16 moves | score 2500 | Easy | 100% |
| 4 | 8x8 | 20 moves | color 18 + color 18 | Easy | 100% |
| 5 | 8x8 | 20 moves | score 4000 | Easy | 100% |
| 6 | 8x8 | 15 moves | ice | Easy | 100% |
| 7 | 8x8 | 18 moves | locks | Medium | 83% |
| 8 | 8x8 | 22 moves | ingredients 2 | Hard | 58% |
| 9 | 8x8 | 13 moves | score 4500 | Easy | 100% |
| 10 | 9x9 | 30 moves | ice + locks | Easy | 96% |
| 11 | 8x8 | 16 moves | make(rocket) 3 | Easy | 100% |
| 12 | 8x8 | 18 moves | make(bomb) 2 | Easy | 100% |
| 13 | 8x8 | 24 moves | make(rainbow) 1 + score 5000 | Easy | 92% |
| 14 | 8x8 | 26 moves | combo 1 | Easy | 92% |
| 15 | 9x9 | 22 moves | make(any) 6 + score 9000 | Easy | 100% |
| 16 | 8x8 | 15 moves | chocolate | Easy | 100% |
| 17 | 8x8 | 28 moves | ice | Hard | 58% |
| 18 | 8x8 | 24 moves | chocolate | Medium | 83% |
| 19 | 8x8 | 26 moves | ice + chocolate | Easy | 92% |
| 20 | 9x9 | 34 moves | chocolate + ice + locks | Medium | 83% |
| 21 | 8x8 | 24 moves | color 25 + ice | Medium | 88% |
| 22 | 8x8 | 28 moves | ingredients 3 + chocolate | Hard | 58% |
| 23 | 8x8 | 60s | score 8000 + make(rocket) 3 | Easy | 100% |
| 24 | 8x8 | 26 moves | locks + color 30 + ice | Easy | 92% |
| 25 | 9x9 | 28 moves | ice + chocolate + ingredients 2 | Medium | 75% |
| 26 | 8x8 | 26 moves | combo 2 | Medium | 75% |
| 27 | 8x8 | 30 moves | combo 2 + ice | Hard | 50% |
| 28 | 8x8 | 30 moves | make(rainbow) 2 + chocolate | Medium | 79% |
| 29 | 9x9 | 30 moves | combo 2 + score 15000 | Super Hard | 29% |
| 30 | 9x9 | 42 moves | combo 2 + chocolate + ice + ingredients 2 | Super Hard | 33% |

### 4d. Brief §14 checklist
| Item | Status |
|---|---|
| Valid swaps / invalid swaps | ✅ unit + browser |
| Horizontal / vertical matches | ✅ unit |
| Four-match, five-match, L/T | ✅ unit (+ four-match in browser) |
| Special combinations | ✅ unit (3 kinds) + browser (Mega Blast XL) |
| Cascading matches, board refill | ✅ unit + fuzz + browser |
| No-move reshuffling | ✅ unit + fuzz (a move always exists after every turn) |
| Level completion / failure / restart | ✅ browser |
| Pause and resume | ✅ browser |
| Save and restore | ✅ browser (reload keeps progress) |
| Mobile touch input | ⚠️ tested with Chrome's touch emulation (CDP), **not yet on a physical phone**. Please try it on yours. |

---

## 5. Development tracker

**Done and tested:** engine; 8×8 plus 7×7 and 9×9 boards and shaped boards; 6 candy types; Rocket, Rainbow Orb, Magic Bomb; Mega Blast (rocket+rocket, rocket+bomb), Star Crusher (bomb+bomb), Colour Explosion (rainbow+special, rainbow+rainbow); 5 boosters; ice (1–2 layers), locks, chocolate (1–2 layers, spreading), acorn collectibles; 8 goal types; 30 levels in 3 worlds; splash, menu, map, game, pause, victory, defeat, inventory, settings, profile; daily reward; coins; 15 achievements; stats; Web Audio sound effects and music; volume sliders; haptics; reduced motion; landscape; localStorage with session fallback.

**Pending / not built:** leaderboards, friends, cloud save, accounts (each needs a backend); real-money purchases and ads (excluded by the brief); multi-language; a visual level editor (levels are edited as data in `levels.js`); more worlds.

**Known limitations:**
- Falling sweets pass *through* holes and chocolate to reach the cells below. In commercial match-3 games, blockers stop the fall and sweets slide in diagonally. Simpler, but less tactical.
- The music is a simple generated loop. Fine for a prototype; a real game needs composed music.
- "Difficulty" comes from a greedy bot, not from human playtests. Expect levels 8, 17, 22, 27 and 29–30 to feel hard.
- Tile visuals are DOM/CSS, with Canvas only for particles. Measured fine in desktop Chrome; not profiled on a low-end Android phone.
- Emoji icons (acorn, boosters, map decorations) look slightly different on Android, iOS and Windows.
- Storage is per browser and device. Clearing site data wipes progress.

**Security / privacy:** no network calls, no tracking, no keys. The player name is inserted as text, never as HTML.
