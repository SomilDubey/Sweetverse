# JS CPU profile during play (2026-11-15)
import asyncio, json, collections
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=3)
        pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
        await pg.goto('file:///home/claude/sweetverse/sweetverse.html'); await pg.wait_for_timeout(1300)
        await pg.click('#splash')
        await pg.evaluate("window.__svSeed=12345; __sv.startLevel(20); __sv.game.goals.forEach(g=>g.target=1e9); __sv.game.moves=99")
        await pg.wait_for_timeout(500)
        await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 200}); await cdp.send('Profiler.start')
        for k in range(6):
            await pg.evaluate("(()=>{const g=__sv.game,m=g.findMove();__sv.doSwap(m[0],m[1])})()")
            for _ in range(120):
                await pg.wait_for_timeout(100)
                if not await pg.evaluate('__sv.busy'): break
        prof = (await cdp.send('Profiler.stop'))['profile']
        nodes = {n['id']: n for n in prof['nodes']}
        dt = collections.Counter(); 
        for sid, d in zip(prof['samples'], prof['timeDeltas']):
            n = nodes[sid]['callFrame']; dt[(n['functionName'] or '(anon)')+':'+str(n['lineNumber'])] += d
        tot = sum(dt.values())
        for k,v in dt.most_common(14): print(f'{v/1000:8.1f}ms {100*v/tot:5.1f}%  {k}')
        await b.close()
asyncio.run(main())
