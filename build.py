# Builds the single-file game: sweetverse.html (2026-11-14)
# 2026-11-14: also writes index.html (same file) for GitHub Pages
import pathlib
d=pathlib.Path(__file__).parent
t=(d/'template.html').read_text()
for k,f in [('/*CSS*/','style.css'),('/*ENGINE*/','engine.js'),('/*LEVELS*/','levels.js'),('/*UI*/','ui.js')]:
    t=t.replace(k,(d/f).read_text())
(d/'sweetverse.html').write_text(t)
(d/'index.html').write_text(t)
print('built', len(t), 'bytes')
