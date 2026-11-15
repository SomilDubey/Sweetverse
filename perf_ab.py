# A/B: which visual costs the most (2026-11-15)
import asyncio, json
from playwright.async_api import async_playwright
CASES = {
 'v04': '.x{}',

 'no_tile_shadow': '.tile{filter:none!important}',
 'no_bg_anim': '.sparkles,.deco,.env,.logo{animation:none!important;display:none}',
 'no_special_anim': '.sp-row .candy,.sp-col .candy,.sp-bomb .candy,.sp-rainbow .candy{animation:none!important}',
 'all_off': '.tile{filter:none!important}.sparkles{display:none}.sp-row .candy,.sp-col .candy,.sp-bomb .candy,.sp-rainbow .candy{animation:none!important}',
}
async def run(pg, cdp, css):
    await pg.goto('file:///home/claude/sweetverse/sweetverse.html'); await pg.wait_for_timeout(1300)
    await pg.add_style_tag(content=css)
    await pg.click('#splash'); await pg.wait_for_timeout(200)
    await pg.evaluate("window.__svSeed=12345; __sv.startLevel(20); __sv.game.goals.forEach(g=>g.target=1e9); __sv.game.moves=99; Math.random=(()=>{let s=7;return()=>{s=(s*16807)%2147483647;return s/2147483647}})()")
    await pg.wait_for_timeout(600)
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 10})
    await pg.evaluate("window.__ft=[];(function f(t){if(window.__last)window.__ft.push(t-window.__last);window.__last=t;window.__raf=requestAnimationFrame(f)})(performance.now())")
    for k in range(6):
        await pg.evaluate("(()=>{const g=__sv.game,m=g.findMove();__sv.doSwap(m[0],m[1])})()")
        for _ in range(120):
            await pg.wait_for_timeout(100)
            if not await pg.evaluate('__sv.busy'): break
    ft = sorted((await pg.evaluate('cancelAnimationFrame(window.__raf);window.__ft'))[5:])
    await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    return round(1000/(sum(ft)/len(ft)),1), round(ft[int(len(ft)*.95)],1), sum(1 for x in ft if x>34)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=3)
        pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
        for name, css in CASES.items():
            fps,p95,jank = await run(pg, cdp, css)
            print(f'{name:16} avg_fps {fps:5}  p95 {p95:5}ms  janky_frames {jank}')
        await b.close()
asyncio.run(main())
