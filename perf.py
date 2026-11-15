# SWEETVERSE performance benchmark – 2026-11-15
# Chrome with CPU throttled 6x (approximates a budget Android phone), phone viewport.
import asyncio, json, sys
from playwright.async_api import async_playwright
LEVEL = int(sys.argv[1]) if len(sys.argv) > 1 else 20
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        pg = await ctx.new_page()
        cdp = await ctx.new_cdp_session(pg)
        await pg.goto('file:///home/claude/sweetverse/sweetverse.html'); await pg.wait_for_timeout(1500)
        await pg.click('#splash'); await pg.wait_for_timeout(300)
        await pg.evaluate(f'__sv.startLevel({LEVEL}); __sv.game.goals.forEach(g=>g.target=1e9); __sv.game.moves=99')
        await pg.wait_for_timeout(800)
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 6})
        await pg.evaluate("""window.__ft=[];(function f(t){if(window.__last)window.__ft.push(t-window.__last);window.__last=t;window.__raf=requestAnimationFrame(f)})(performance.now())""")
        eng=[]
        for k in range(8):
            t = await pg.evaluate("(()=>{const g=__sv.game,m=g.findMove();const t0=performance.now();__sv.doSwap(m[0],m[1]);return performance.now()-t0})()")
            for _ in range(100):
                await pg.wait_for_timeout(100)
                if not await pg.evaluate('__sv.busy'): break
        ft = await pg.evaluate('cancelAnimationFrame(window.__raf); window.__ft')
        ft = ft[5:]
        ft.sort()
        avg = sum(ft)/len(ft); p95 = ft[int(len(ft)*.95)]; long = sum(1 for x in ft if x > 50)
        res = {'level': LEVEL, 'frames': len(ft), 'avg_fps': round(1000/avg,1), 'p95_ms': round(p95,1), 'long_frames_over_50ms': long, 'worst_ms': round(ft[-1],1)}
        print(json.dumps(res))
        await b.close()
asyncio.run(main())
