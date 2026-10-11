#!/usr/bin/env python3
# Preview pixel sprites: python3 tools/sprite-sheet.py js/sprites/avatars-a.js out.png
# Sprite files are `export default { "<emoji>": ["16 chars", ...16 rows], ... };` (valid JSON inside).
import json, re, sys
from PIL import Image, ImageDraw
pal_src = open(__file__.replace('tools/sprite-sheet.py', 'js/sprites/palette.js')).read()
PAL = {k: v for k, v in re.findall(r"(\w): '(#[0-9a-f]{6})'", pal_src)}
def load(path):
    s = open(path).read()
    body = s[s.index('export default') + len('export default'):].strip().rstrip(';')
    body = re.sub(r'^\s*//.*$', '', body, flags=re.M)
    return json.loads(body)
sprites = {}
for p in sys.argv[1:-1]: sprites.update(load(p))
S, cols = 8, 6
names = list(sprites)
rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (16 * S + 20), rows * (16 * S + 34)), (40, 52, 46))
d = ImageDraw.Draw(sheet)
errs = []
for n, name in enumerate(names):
    grid = sprites[name]
    x0, y0 = (n % cols) * (16 * S + 20) + 10, (n // cols) * (16 * S + 34) + 6
    if len(grid) != 16 or any(len(r) != 16 for r in grid): errs.append(f'{name}: not 16x16')
    for y, row in enumerate(grid[:16]):
        for x, ch in enumerate(row[:16]):
            if ch == '.': continue
            if ch not in PAL: errs.append(f'{name}: unknown color {ch!r}'); continue
            d.rectangle([x0 + x * S, y0 + y * S, x0 + x * S + S - 1, y0 + y * S + S - 1], fill=PAL[ch])
    d.text((x0, y0 + 16 * S + 6), f'{n}', fill='white')
sheet.save(sys.argv[-1])
print('sprites:', len(names), '| errors:', sorted(set(errs)) or 'none')
