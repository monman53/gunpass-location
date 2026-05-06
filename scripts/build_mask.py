"""
municipalities.geojson の全自治体を union して群馬県外をマスクする
gunma_mask.geojson を生成する。
出力ポリゴンは「世界全体の矩形 - 群馬県境界」の穴あきポリゴン。
"""
from pathlib import Path
import json
from shapely.geometry import shape, mapping, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).parent.parent
SRC  = ROOT / 'municipalities.geojson'
DEST = ROOT / 'gunma_mask.geojson'

with open(SRC, encoding='utf-8') as f:
    data = json.load(f)

shapes = [shape(feat['geometry']) for feat in data['features']]
gunma = unary_union(shapes)

# 群馬県全体を包む大きな矩形（外枠）
world = Polygon([[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]])
mask = world.difference(gunma)

out = {
    'type': 'FeatureCollection',
    'features': [{
        'type': 'Feature',
        'properties': {},
        'geometry': mapping(mask),
    }]
}

with open(DEST, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

print(f'出力: {DEST} ({DEST.stat().st_size / 1024:.0f} KB)')
