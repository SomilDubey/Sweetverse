# SWEETVERSE browser test – 2026-11-14 v0.3. Real input on a phone-size viewport.
# 2026-11-15 v0.4: finale, crates, fizz bombs, start boosters, tutorial hand
# 2026-11-15 v0.5: save migration + corruption recovery, smart hint button, audio voice cap
import asyncio, json
from playwright.async_api import async_playwright
R = []
def rec(name, ok, note=''):
    R.append({'test': name, 'result': 'PASS' if ok else 'FAIL', 'note': note}); print(('PASS ' if ok else 'FAIL ') + name, note)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True)
        pg = await ctx.new_page(); pg.set_default_timeout(8000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        cdp = await ctx.new_cdp_session(pg)
        await pg.goto('file:///home/claude/sweetverse/sweetverse.html'); await pg.wait_for_timeout(1800)
        await pg.screenshot(path='shot_1_splash.png')
        await pg.click('#splash'); await pg.wait_for_timeout(400)
        rec('Splash -> main menu', await pg.is_visible('#home'))
        await pg.screenshot(path='shot_2_home.png')
        # daily reward
        c0 = await pg.evaluate('__sv.S.profile.coins')
        await pg.click('#dailyBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path='shot_3_daily.png')
        await pg.click('#modal .btn.green'); await pg.wait_for_timeout(300)
        c1 = await pg.evaluate('__sv.S.profile.coins')
        rec('Daily reward claim adds coins', c1 == c0 + 50, f'{c0}->{c1}')
        await pg.click('#dailyBtn'); await pg.wait_for_timeout(200)
        rec('Daily reward cannot be claimed twice', 'Already claimed' in await pg.inner_text('#modal')); await pg.click('#modal .x')
        # shop
        await pg.click('#shopBtn'); await pg.wait_for_timeout(300)
        h0 = await pg.evaluate('__sv.S.inv.swap'); await pg.click('#shopList button[data-k=swap]'); await pg.wait_for_timeout(200)
        rec('Booster inventory: buy Magic Swap with coins', await pg.evaluate('__sv.S.inv.swap') == h0+1 and await pg.evaluate('__sv.S.profile.coins') == c1-40)
        await pg.screenshot(path='shot_4_shop.png'); await pg.click('#shopBack')
        # profile
        await pg.click('#profileBtn'); await pg.wait_for_timeout(300)
        await pg.fill('#profName', 'Somil'); await pg.press('#profName','Tab'); await pg.click('.av:nth-child(5)')
        rec('Profile: rename + avatar', await pg.evaluate('__sv.S.profile.name')=='Somil' and await pg.evaluate('__sv.S.profile.avatar')=='🧚')
        await pg.screenshot(path='shot_5_profile.png', full_page=True); await pg.click('#profBack')
        # map
        await pg.click('#playBtn'); await pg.wait_for_timeout(400); await pg.screenshot(path='shot_6_map.png')
        await pg.click('.node:nth-child(3)'); await pg.wait_for_timeout(200)
        rec('Locked level cannot be opened', not await pg.is_visible('#modal .card'))
        await pg.click('.node.current'); await pg.wait_for_timeout(300); await pg.screenshot(path='shot_7_intro.png')
        await pg.click('#modal .btn.green'); await pg.wait_for_timeout(1300)
        rec('Tutorial hand shows the first move on level 1', await pg.evaluate("!!document.getElementById('hand')"))
        await pg.evaluate('__sv.game.goals[0].target=1e9')  # keep the level open while testing mechanics
        async def geo():
            return await pg.evaluate("(()=>{const r=document.querySelector('#board').getBoundingClientRect();return [r.left,r.top,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cs'))]})()")
        async def settle():
            for _ in range(80):
                if not await pg.evaluate('__sv.busy'): return
                await pg.wait_for_timeout(100)
        async def mouse_swipe(a, b):
            L,T,cs = await geo(); ax,ay=a; bx,by=b; sx,sy=L+(ax+.5)*cs,T+(ay+.5)*cs
            await pg.mouse.move(sx,sy); await pg.mouse.down(); await pg.mouse.move(sx+(bx-ax)*cs*.8, sy+(by-ay)*cs*.8, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(250); await settle()
        async def touch_swipe(a, b):
            L,T,cs = await geo(); ax,ay=a; bx,by=b; sx,sy=L+(ax+.5)*cs,T+(ay+.5)*cs
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
            for k in range(1,7): await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':sx+(bx-ax)*cs*.8*k/6,'y':sy+(by-ay)*cs*.8*k/6}]})
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(250); await settle()
        async def tap(c):
            L,T,cs = await geo(); await pg.mouse.click(L+(c[0]+.5)*cs, T+(c[1]+.5)*cs); await pg.wait_for_timeout(120)
        mv = "(()=>{const g=__sv.game;const m=g.findMove();return [g.xy(m[0]),g.xy(m[1])]})()"
        st = "[__sv.game.moves,__sv.game.score,__sv.game.findGroups().length,__sv.game.cells.filter(c=>!c.hole&&!c.choc&&!c.tile).length,document.querySelectorAll('#tiles .tile').length]"
        # valid swap by mouse
        a,bb = await pg.evaluate(mv); s0 = await pg.evaluate(st); await mouse_swipe(a,bb); s1 = await pg.evaluate(st)
        rec('Valid swap (mouse drag)', s1[0]==s0[0]-1 and s1[1]>s0[1], f'moves {s0[0]}->{s1[0]} score {s0[1]}->{s1[1]}')
        rec('Board refilled, stable after cascades', s1[2]==0 and s1[3]==0 and s1[4]==64, f'matches left {s1[2]}, empty {s1[3]}, tiles {s1[4]}')
        # touch swipe
        a,bb = await pg.evaluate(mv); s0 = await pg.evaluate(st); await touch_swipe(a,bb); s1 = await pg.evaluate(st)
        rec('Valid swap (touch swipe)', s1[0]==s0[0]-1, f'moves {s0[0]}->{s1[0]}')
        # invalid swap
        bad = await pg.evaluate("(()=>{const g=__sv.game;for(let i=0;i<63;i++){if(i%8==7)continue;if(!g.canSwap(i,i+1))continue;g.swapTiles(i,i+1);const ok=g.matchAt(i)||g.matchAt(i+1);g.swapTiles(i,i+1);if(!ok)return [g.xy(i),g.xy(i+1)]}})()")
        s0 = await pg.evaluate(st); await mouse_swipe(*bad); s1 = await pg.evaluate(st)
        rec('Invalid swap rejected, no move used', s1[0]==s0[0] and s1[1]==s0[1])
        # tap-tap
        a,bb = await pg.evaluate(mv); s0 = await pg.evaluate(st); await tap(a); await tap(bb); await pg.wait_for_timeout(200); await settle(); s1 = await pg.evaluate(st)
        rec('Tap-to-select then tap neighbour swaps', s1[0]==s0[0]-1)
        # forced special creation: set row 7 to make a 4-match by swap
        async def setrow(y, cols, extra=''):
            await pg.evaluate(f"""(()=>{{const g=__sv.game,E=SweetEngine;const cols={json.dumps(cols)};cols.forEach((c,x)=>{{const t=E.tile(c[0],c[1]||null);g.cells[g.idx(x,{y})].tile=t}});{extra}__sv.startLevel; }})()""")
        # use engine-level injection then rerender by a no-op layout: call startLevel? no - instead inject before a swipe and rely on render
        inj = """(()=>{const g=__sv.game,E=SweetEngine;const F=[3,4,3,4,3,4,3,4];
          for(let x=0;x<8;x++){g.cells[g.idx(x,7)].tile=E.tile(F[x]);g.cells[g.idx(x,6)].tile=E.tile(F[(x+1)%8]);}
          g.cells[g.idx(0,7)].tile=E.tile(0);g.cells[g.idx(1,7)].tile=E.tile(0);g.cells[g.idx(2,6)].tile=E.tile(0);g.cells[g.idx(3,7)].tile=E.tile(0);
          window.dispatchEvent(new Event('resize'));})()"""
        await pg.evaluate(inj); await pg.wait_for_timeout(400)
        s0 = await pg.evaluate('__sv.S.stats.rockets'); await mouse_swipe((2,6),(2,7))
        specials = await pg.evaluate("__sv.game.cells.filter(c=>c.tile&&c.tile.special).length")
        rec('Four-match creates a Rocket (live UI)', await pg.evaluate('__sv.S.stats.rockets') >= s0+1, f'specials on board {specials}')
        # combo: place two rockets adjacent and swipe
        await pg.evaluate("""(()=>{const g=__sv.game,E=SweetEngine;g.cells[g.idx(3,4)].tile=E.tile(1,'row');g.cells[g.idx(4,4)].tile=E.tile(2,'bomb');window.dispatchEvent(new Event('resize'));})()""")
        await pg.wait_for_timeout(400); c0=await pg.evaluate('__sv.S.stats.combos')
        await mouse_swipe((3,4),(4,4)); await pg.screenshot(path='shot_8_after_combo.png')
        rec('Special + special combo fires (Mega Blast XL)', await pg.evaluate('__sv.S.stats.combos')==c0+1)
        # boosters
        async def board_ok(): return await pg.evaluate("__sv.game.cells.filter(c=>!c.hole&&!c.choc&&!c.tile).length==0 && __sv.game.findGroups().length==0")
        h=await pg.evaluate('__sv.S.inv.hammer'); await pg.click('#b-hammer'); await pg.screenshot(path='shot_9_hammer_mode.png'); await tap((4,4)); await settle()
        rec('Hammer booster', await pg.evaluate('__sv.S.inv.hammer')==h-1 and await board_ok())
        h=await pg.evaluate('__sv.S.inv.blast'); col=await pg.evaluate('__sv.game.cells[__sv.game.idx(2,2)].tile.color')
        await pg.click('#b-blast'); await tap((2,2)); await pg.wait_for_timeout(100)
        rec('Colour Blast booster', await pg.evaluate('__sv.S.inv.blast')==h-1); await settle()
        h=await pg.evaluate('__sv.S.inv.swap'); m0=await pg.evaluate('__sv.game.moves'); t0=await pg.evaluate('[__sv.game.cells[0].tile.id,__sv.game.cells[63].tile.id]')
        await pg.click('#b-swap'); await tap((0,0)); await tap((7,7)); await settle()
        t1=await pg.evaluate('[__sv.game.cells[0].tile&&__sv.game.cells[0].tile.id,__sv.game.cells[63].tile&&__sv.game.cells[63].tile.id]')
        rec('Magic Swap booster (no move used)', await pg.evaluate('__sv.S.inv.swap')==h-1 and await pg.evaluate('__sv.game.moves')==m0, f'tiles {t0}->{t1}')
        h=await pg.evaluate('__sv.S.inv.shuffle'); await pg.click('#b-shuffle'); await pg.wait_for_timeout(500)
        rec('Shuffle booster', await pg.evaluate('__sv.S.inv.shuffle')==h-1 and await board_ok())
        m0=await pg.evaluate('__sv.game.moves'); await pg.click('#b-moves'); await pg.wait_for_timeout(200)
        rec('Extra Moves booster', await pg.evaluate('__sv.game.moves')==m0+5)
        await pg.click('#b-hammer'); await pg.click('#modeCancel'); rec('Booster mode can be cancelled', await pg.evaluate('__sv.mode')==None)
        # pause / resume
        await pg.click('#pauseBtn'); await pg.wait_for_timeout(200); await pg.screenshot(path='shot_10_pause.png')
        await pg.click('#modal .btn.green'); rec('Pause and resume', not await pg.is_visible('#modal .card'))
        # restart (with confirm)
        await pg.click('#pauseBtn'); await pg.click('#modal .btn.blue'); await pg.wait_for_timeout(150); await pg.click('#modal .btn:not(.blue)'); await pg.wait_for_timeout(500)
        rec('Restart (with confirmation)', await pg.evaluate('__sv.game.moves')==15 and await pg.evaluate('__sv.game.score')==0)
        # win
        await pg.evaluate('__sv.game.score=99999'); a,bb = await pg.evaluate(mv); await mouse_swipe(a,bb)
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shot_11a_finale.png')
        await pg.wait_for_selector('#modal .card', timeout=30000); await pg.wait_for_timeout(600)
        rec('Sugar Rush finale uses up leftover moves', await pg.evaluate('__sv.game.moves')==0)
        await pg.screenshot(path='shot_11_win.png'); txt = await pg.inner_text('#modal')
        rec('Level completion: victory screen, stars, coins', 'complete' in txt and await pg.evaluate('__sv.S.progress.unlocked')==2 and await pg.evaluate('__sv.S.progress.stars[1]')==3)
        await pg.wait_for_timeout(1500)
        rec('Achievement unlocked on first win', 'first' in await pg.evaluate('Object.keys(__sv.S.ach.done)'))
        await pg.click('#modal .btn.green'); await pg.wait_for_timeout(300); await pg.click('#modal .btn.green'); await pg.wait_for_timeout(500)
        # lose
        await pg.evaluate('__sv.S.inv.moves=0; __sv.game.moves=1'); a,bb = await pg.evaluate(mv); await mouse_swipe(a,bb); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shot_12_lose.png'); txt = await pg.inner_text('#modal')
        rec('Level failure: defeat screen', 'Out of moves' in txt)
        await pg.click('#modal .btn.green'); await pg.wait_for_timeout(400)
        rec('Retry after failure', await pg.evaluate('__sv.game.moves')==16 and not await pg.is_visible('#modal .card'))
        # v0.4 content
        await pg.evaluate("__sv.startLevel(31)"); await pg.wait_for_timeout(600); await pg.screenshot(path='shot_L31.png')
        rec('Candy crates render (level 31)', await pg.evaluate("[...document.querySelectorAll('.crate')].filter(e=>e.style.display=='block').length")==8)
        await pg.evaluate("__sv.startLevel(42)"); await pg.wait_for_timeout(600); await pg.screenshot(path='shot_L42.png')
        rec('Fizz bomb counters render (level 42)', await pg.evaluate("document.querySelectorAll('.fz').length")==2)
        await pg.evaluate("__sv.game.cells.forEach(c=>{if(c.tile&&c.tile.fuse)c.tile.fuse=1}); __sv.game.goals[0].target=99")
        a,bb = await pg.evaluate(mv); await mouse_swipe(a,bb); await pg.wait_for_timeout(800)
        txt = await pg.inner_text('#modal'); rec('Fizz bomb reaching 0 loses the level', 'fizz bomb popped' in txt.lower(), txt[:40].replace(chr(10),' '))
        await pg.evaluate("__sv.S.progress.unlocked=60")
        await pg.click('#modal .x'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('.node[aria-label=\"Level 4\"]').click()"); await pg.wait_for_timeout(300)
        c0 = await pg.evaluate('__sv.S.profile.coins'); await pg.click('.sb input[data-k=rocket]'); await pg.screenshot(path='shot_intro_start.png')
        await pg.click('#modal .btn.green'); await pg.wait_for_timeout(900)
        rec('Start booster: Rocket placed and 30 coins spent', await pg.evaluate("__sv.game.cells.filter(c=>c.tile&&c.tile.special).length")>=1 and await pg.evaluate('__sv.S.profile.coins')==c0-30)
        await pg.click('#pauseBtn'); await pg.wait_for_timeout(200); await pg.click('#modal .btn:has-text(\"Quit\")'); await pg.wait_for_timeout(200); await pg.click('#modal .btn:not(.blue)'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#mapScroll').scrollTop=99999"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shot_map_w6.png')
        rec('Map shows 6 worlds and 60 levels', await pg.evaluate("[document.querySelectorAll('.world').length, document.querySelectorAll('.node').length]")==[6,60])
        # obstacles render
        for lv in (18, 20, 30, 40, 50, 60):
            await pg.evaluate(f'__sv.startLevel({lv})'); await pg.wait_for_timeout(600); await pg.screenshot(path=f'shot_L{lv}.png')
        rec('Chocolate visible on level 20', await pg.evaluate("[...document.querySelectorAll('.choc')].filter(e=>e.style.display=='block').length") == await pg.evaluate('__sv.game.chocCount()'))
        # particles drain
        await pg.wait_for_timeout(1500); rec('Particle pool empties when idle (no growth)', await pg.evaluate('__sv.parts')==0)
        # landscape
        await pg.set_viewport_size({'width':844,'height':390}); await pg.wait_for_timeout(500); await pg.screenshot(path='shot_13_landscape.png')
        fits = await pg.evaluate("(()=>{const r=document.querySelector('#board').getBoundingClientRect();return r.bottom<=390&&r.right<=844})()")
        rec('Landscape layout fits screen', fits)
        await pg.set_viewport_size({'width':820,'height':1180}); await pg.wait_for_timeout(500); await pg.screenshot(path='shot_14_tablet.png')
        await pg.set_viewport_size({'width':1440,'height':900}); await pg.wait_for_timeout(500); await pg.screenshot(path='shot_15_desktop.png')
        # page doesn't scroll during gameplay
        rec('No page scroll during gameplay', await pg.evaluate('document.scrollingElement.scrollTop')==0)
        # save & restore
        before = await pg.evaluate('JSON.stringify([__sv.S.progress.unlocked,__sv.S.progress.stars,__sv.S.profile.name,__sv.S.profile.coins])')
        await pg.reload(); await pg.wait_for_timeout(500)
        after = await pg.evaluate('JSON.stringify([__sv.S.progress.unlocked,__sv.S.progress.stars,__sv.S.profile.name,__sv.S.profile.coins])')
        rec('Save and restore after reload (localStorage)', before==after, after)
        # ---- v0.5 ----
        await pg.click('#splash'); await pg.wait_for_timeout(300)
        await pg.evaluate("__sv.startLevel(12); __sv.game.goals.forEach(g=>g.target=1e9)"); await pg.wait_for_timeout(700)
        await pg.click('#hintBtn'); await pg.wait_for_timeout(300)
        rec('Hint button highlights the smart move', await pg.evaluate("document.querySelectorAll('#tiles .tile.hint').length")==2)
        await pg.evaluate("__sv.game.cells[__sv.game.idx(3,4)].tile=SweetEngine.tile(0,'rainbow');__sv.game.cells[__sv.game.idx(4,4)].tile=SweetEngine.tile(1,'row');window.dispatchEvent(new Event('resize'))")
        await pg.wait_for_timeout(400)
        await pg.evaluate("window.__maxV=0;window.__vi=setInterval(()=>{window.__maxV=Math.max(window.__maxV,__sv.voices)},5)")
        await pg.evaluate("__sv.doSwap(__sv.game.idx(3,4),__sv.game.idx(4,4))")
        for _ in range(80):
            await pg.wait_for_timeout(100)
            if not await pg.evaluate('__sv.busy'): break
        mx = await pg.evaluate("clearInterval(window.__vi); window.__maxV")
        rec('Audio: never more than 14 sounds at once in a big combo', 0 < mx <= 14, f'max simultaneous {mx}')
        # migration from v0.4 per-section keys
        await pg.evaluate("""localStorage.clear();
          localStorage.setItem('sv_progress', JSON.stringify({unlocked:7,stars:{1:3,2:2,3:1,4:3,5:2,6:1},best:{1:5000}}));
          localStorage.setItem('sv_profile', JSON.stringify({name:'OldSave',avatar:'🦊',coins:999}));
          localStorage.setItem('sv_inv', JSON.stringify({hammer:9,shuffle:1,moves:4}));""")
        await pg.reload(); await pg.wait_for_timeout(600)
        st = await pg.evaluate("[__sv.S.progress.unlocked, __sv.S.profile.name, __sv.S.profile.coins, __sv.S.inv.hammer, __sv.S.inv.swap, !!localStorage.getItem('sv_save'), !!localStorage.getItem('sv_progress')]")
        rec('Save migration: v0.4 progress, coins and boosters kept; new boosters get defaults; old keys kept', st==[7,'OldSave',999,9,2,True,True], str(st))
        # corruption recovery
        await pg.evaluate("__sv.S.profile.coins=1234; __sv.saveNow(); __sv.saveNow(); localStorage.setItem('sv_save','{broken')")
        await pg.reload(); await pg.wait_for_timeout(600)
        st = await pg.evaluate("[__sv.S.profile.coins, __sv.S.progress.unlocked, Object.keys(localStorage).some(k=>k.startsWith('sv_corrupt_'))]")
        rec('Corrupted save: restored from backup, damaged copy kept', st==[1234,7,True], str(st))
        await pg.click('#splash'); await pg.wait_for_timeout(2600)
        rec('Player is told the save was restored', 'restored from the backup' in (await pg.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' ')")))
        rec('No console errors', not errs, '; '.join(errs)[:300])
        json.dump(R, open('browser-results.json','w'), indent=1)
        await b.close()
asyncio.run(main())
