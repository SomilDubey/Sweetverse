# SWEETVERSE – Project audit and feature tracker
**Date:** 2026-11-15 · **Audited build:** v0.4 (commit d6b8181) · **Fixes shipped in:** v0.5

## 1. Architecture (as found)
| Layer | File | Notes |
|---|---|---|
| Game-state engine | `engine.js` (≈690 lines) | Pure logic, no DOM. Emits events (`match`, `clear`, `special`, `spawn`, …) that the UI animates. Seeded RNG, so boards are reproducible in tests. |
| Level data | `levels.js` | Data-driven: layout strings + goals + options. 60 levels, 6 worlds, stable ids 1–60. |
| UI / rendering | `ui.js` (≈950 lines) | DOM tiles moved with CSS transforms; Canvas only for particles. Screens, input, audio, rewards and saving all live in this one file. |
| Visuals | `style.css` | All art is CSS gradients and clip-paths (no image files). |
| Build | `build.py` → `sweetverse.html` / `index.html` | One self-contained file. |
| Tests | `test.js`, `smoke.py`, `perf*.py`, `prof.py` | Engine unit tests, playtest bot, real-browser tests, performance measurements. |

No React is used. That's deliberate and was agreed in v0.3.

## 2. Completed (implemented and tested)
Board 7×7 / 8×8 / 9×9 and shaped boards · 6 sweet colours (different shapes too, so it works for colour-blind players) · match detection H/V, L/T · Rocket, Magic Bomb, Rainbow Orb · 5 special+special combos · cascades with multiplier · no-move reshuffle · 5 in-level boosters + 3 start boosters · ice (1–2), locks, chocolate (1–2, spreading), candy crates (1–3), fizz bombs, acorns · 10 goal types · 60 levels / 6 worlds / 6 bosses · Sugar Rush finale · tutorial hand · daily reward calendar · coins · 22 achievements · player stats/profile · Web Audio sound effects + music + separate volumes · reduced motion · auto lite graphics · landscape layout · **v0.5:** versioned save with migration and backup, smart hint, audio voice cap.

## 3. Partially implemented
| Feature | What exists | What's missing |
|---|---|---|
| Failure explanation | **Done v0.6:** defeat screen names the biggest missing goal and gives one concrete tip | — |
| Visual polish | Glossy CSS sweets, particles, beams, rings | No character animation beyond emoji; no star trails |
| Audio | Generated SFX + one music loop | No world-specific ambience; one loop for all worlds |
| Level validation | Bot plays each level 24×; every level won at least sometimes | Not a formal proof of solvability (impossible for random refills) |

## 4. Missing (requested in the v0.5 brief)
Magic Garden · companion creatures · multi-stage boards · moving/changing tiles · treasure hunt · strategic path choice · worlds 7–10 and levels 61–300 · daily/weekly challenges and missions · XP and player levels · streak recovery · cosmetics · treasure chests · the 6 named new combos · leaderboards/friends/events (**need a backend; will not be faked**).

## 5. Bugs found
| # | Severity | Bug | Status |
|---|---|---|---|
| B1 | **High** | A save that failed to load was silently replaced by a blank save, then overwritten. Progress lost. | **Fixed v0.5.** Damaged data copied to `sv_corrupt_<time>`, restored from `sv_save_bak`, player told. Browser-tested. |
| B2 | Medium | Saves had no version number, so later upgrades had no safe migration path | **Fixed v0.5.** `sv_save` v2 with a migration hook; v0.1–v0.4 keys migrated and left in place. Browser-tested. |
| B3 | Medium | Hint showed the first valid move found scanning from the top-left, ignoring goals | **Fixed v0.5.** Smart hint simulates moves. Following it wins 83% vs 4% (216 games). |
| B4 | Low | Large cascades could stack dozens of overlapping sounds | **Fixed v0.5.** Max 14 voices, 45 ms per-effect rate limit. Measured max 8 in a Colour Explosion. |
| B5 | Design | Sweets fell *through* chocolate, crates and locks instead of being blocked and sliding diagonally | **Fixed v0.6.** Blockers and locks are shelves, diagonal fill, sealed-area fallback. 5 new engine tests. |
| B6 | Low | Daily reward uses the device clock, so changing the date gives extra rewards | Open. Acceptable offline; fixing it needs a server. |
| B7 | Low | Coins and progress are editable in browser dev tools | Open by design (local-only game, no purchases). Server validation needed only if real rewards are ever added. |

## 6. Performance (measured, see README)
v0.4 fixed the main bottleneck: per-tile CSS filters and repaint-heavy animations. At a 10× slower CPU: 37 → 50 fps, janky frames 25 → 6. Game logic uses under 1% of CPU time. Particle pool is capped at 260 and the rAF loop stops when idle (browser-tested). **Not yet measured on a real low-end Android phone.**

## 7. UX gaps (prioritised)
1. No "why did I fail" explanation.
2. No reason to come back after finishing the 60 levels (no missions, XP, garden or challenges yet).
3. Start-booster choice only shows on the level intro screen. Fine, but it could also appear after a loss.

## 8. Code quality
- `ui.js` is one ~950-line file. It works, but the meta systems the next phase brings (garden, companions, missions) should go into a separate `meta.js` so the core stays readable.
- Difficulty labels are pasted into `levels.js` by a script after each bot run. That's a manual step; it should run automatically in the build.
- Replaced versions of every file are kept in `archive/` (your rule).

## 9. Security and data integrity
No network calls, no keys, no tracking. The player name is only ever inserted as text (no HTML injection). Saves are local and not tamper-proof (B7). That's acceptable for an offline game and must change if any online or real-value feature is added.

---

## Feature tracker (updated 2026-11-15, after v0.6 phase 3)
| Status | Features |
|---|---|
| ✅ Done and tested | Everything in §2, plus: gravity rework (v0.6 p1), landing/press/impact/star-trail effects, failure explanation (v0.6 p2), player XP and levels, weekly missions, treasure chests, streak recovery (v0.6 p3) |
| ⚠️ Done, not tested on real hardware | Touch on a physical phone, performance on a low-end Android phone |
| ⏳ Pending | Companions · Magic Garden · multi-stage boards · moving tiles · treasure hunt · path choice · 6 new combos · daily puzzle challenge · cosmetics · worlds 7–10 / levels 61–300 · world ambience audio |
| 🚫 Needs a backend (not faked) | Friend/global leaderboards, community milestones, seasonal online events, challenge sharing between players |

## Roadmap for the rest of the brief (recommended order)
| Step | Content | Why this order | Size |
|---|---|---|---|
| **v0.6** | ✅ Gravity rework, visuals, XP/missions/chests/streak. *Moved to v0.7:* multi-stage boards, moving tiles | | Done |
| **v0.7** | Companions (4, balanced, bot-tested) + multi-stage boards + daily puzzle challenge | Companions plug into the new XP/chest economy | Large |
| **v0.8** | Magic Garden (seeds from missions/chests) + moving tiles | | Large |
| **v0.9** | The 6 new combos (Rainbow Rocket, Magic Galaxy, Sweet Storm, Golden Comet, Crystal Heart, Ultimate Fusion) | Engine work; easier after the gravity rework | Medium |
| **v1.0+** | Worlds 7–10 in batches of 30 levels, each bot-validated; ambience per world | Content is cheapest to add once the mechanics are final | Large, repeatable |
| Later | Leaderboards, friends, events | Need a backend (e.g. Firebase). Local personal bests only until then | — |

**My view:** reaching 300 levels before v0.6–v0.8 would mean designing levels on a gravity system that's about to change. That's wasted work.
