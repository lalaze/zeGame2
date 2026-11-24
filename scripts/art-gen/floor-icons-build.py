#!/usr/bin/env python3
"""Cut the icon sheets of assets/generated/floor-sample-v1 into the ledger icons of the floors view.

    uv run --with pillow --with numpy python scripts/art-gen/floor-icons-build.py

Each sheet (kits/icons/<sheet>/take-N/sheet.png, prompts in prompts/icons/) holds 8 separate
objects on transparency, 4 columns by 2 rows (the `upgrades` sheet 2 by 1), in the order SHEETS
lists their icon keys. The keys are the ledger's own (src/ui/panel.ts): item:<menu item>,
ing:<ingredient>, upgrade:<upgrade>; and for the dialogs, sig:<signature drink base>,
promo:<promotion platform>, wish:<Mina's route>. Every object is trimmed, centred on a square of the same margin and scaled to
SIZE pixels, so icons of one kind keep the sizes they were painted at relative to each other.

Writes build/icons/<kind>-<id>.webp and build/icons/icons.json (the keys written).
"""
import importlib.util
import json
import os
import sys

# Importing the furniture build below must not leave a __pycache__ in scripts/.
sys.dont_write_bytecode = True

from PIL import Image

LIBRARY = os.environ.get('ZEGAME_ART_LIBRARY', '/Volumes/data/zeGame2-library')


def source(path):
    return path if os.path.exists(path) else os.path.join(LIBRARY, path)


# The furniture build's sheet cutter: emptiest-line seams, and the veil cut some sheets need.
spec = importlib.util.spec_from_file_location('furniture', os.path.join(os.path.dirname(__file__), 'floor-furniture-build.py'))
furniture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(furniture)

P = 'assets/generated/floor-sample-v1'
OUT = f'{P}/build/icons'
SIZE = 160
# Square side as a share of the largest object's side on its sheet: a little room all round.
MARGIN = 1.08
# sheet: (take, columns, rows, icon keys in reading order)
SHEETS = {
    'drinks-1': (1, 4, 2, ['item:espresso', 'item:americano', 'item:latte', 'item:cappuccino', 'item:flatwhite', 'item:cortado', 'item:mocha', 'item:vienna']),
    'drinks-2': (1, 4, 2, ['item:macchiato', 'item:coldbrew', 'item:dirty', 'item:pourover', 'item:creamcoffee', 'item:affogato', 'item:blacktea', 'item:hotchoc']),
    'drinks-3': (1, 4, 2, ['item:lemontea', 'item:chai', 'item:fruittea', 'item:hojicha', 'item:matcha', 'item:frappe', 'item:smoothie', 'item:milktea']),
    'bread-1': (1, 4, 2, ['item:roll', 'item:bagel', 'item:baguette', 'item:cheesebun', 'item:pretzel', 'item:focaccia', 'item:ciabatta', 'item:raisinbread']),
    'bread-2': (1, 4, 2, ['item:sourdough', 'item:rye', 'item:chocobread', 'item:shokupan', 'item:brioche', 'item:fruitbrioche', 'item:matchafloat', 'ing:beans']),
    'pastry-1': (1, 4, 2, ['item:donut', 'item:scone', 'item:cookie', 'item:croissant', 'item:painchoc', 'item:brownie', 'item:cinnamon', 'item:muffin']),
    'pastry-2': (1, 4, 2, ['item:creampuff', 'item:melonpan', 'item:eggtart', 'item:cake', 'item:swissroll', 'item:cheesecake', 'item:macaron', 'item:garlicbread']),
    'pantry-1': (1, 4, 2, ['ing:milk', 'ing:flour', 'ing:butter', 'ing:eggs', 'ing:sugar', 'ing:tea', 'ing:spice', 'ing:cocoa']),
    'pantry-2': (1, 4, 2, ['ing:cream', 'ing:fruit', 'ing:matcha', 'upgrade:barista', 'upgrade:server', 'upgrade:cook', 'upgrade:machine', 'upgrade:marketing']),
    'upgrades': (1, 2, 1, ['upgrade:tables', 'upgrade:pass']),
    # A signature drink by its base, the two promotion platforms, and Mina's map with either route.
    'extras-1': (1, 4, 2, ['sig:coffee', 'sig:tea', 'sig:milk', 'sig:fruit', 'promo:flash', 'promo:orange', 'wish:quiet', 'wish:milky']),
}


def main():
    import numpy as np
    os.makedirs(OUT, exist_ok=True)
    written = []
    for sheet_name, (take, cols, rows, keys) in SHEETS.items():
        path = source(f'{P}/kits/icons/{sheet_name}/take-{take}/sheet.png')
        if not os.path.exists(path):
            print(sheet_name, 'missing, skipped')
            continue
        pieces = furniture.cells(np.asarray(Image.open(path).convert('RGBA')), cols, rows)
        side = round(max(max(p.shape[:2]) for p in pieces if p is not None) * MARGIN)
        for key, piece in zip(keys, pieces):
            if piece is None:
                raise SystemExit(f'{sheet_name}: no object for {key}')
            square = Image.new('RGBA', (side, side))
            image = Image.fromarray(piece, 'RGBA')
            square.alpha_composite(image, ((side - image.width) // 2, (side - image.height) // 2))
            square.resize((SIZE, SIZE), Image.LANCZOS).save(f"{OUT}/{key.replace(':', '-')}.webp", 'WEBP', quality=90, alpha_quality=100, method=6)
            written.append(key)
        print(sheet_name, 'take', take, len(keys))
    with open(f'{OUT}/icons.json', 'w') as f:
        json.dump(sorted(written), f, indent=1)
        f.write('\n')
    print(len(written), 'icons')


if __name__ == '__main__':
    main()
