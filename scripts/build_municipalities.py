"""
raw/N03-20240101_10.geojson から市区町村境界の GeoJSON を生成する。
- 不要なプロパティを除去し自治体名のみ残す
- 座標を小数点以下4桁に丸めてファイルサイズを削減
- 同一自治体の複数フィーチャーを MultiPolygon に統合
出力: municipalities.geojson

事前に mapshaper で raw/N03-20240101_10_GML.zip を簡略化して
raw/N03-20240101_10.geojson を生成しておくこと:
  mapshaper raw/N03-20240101_10.geojson -simplify 8% -o raw/N03-20240101_10.geojson
"""
from pathlib import Path
import json
import os
from collections import defaultdict

ROOT = Path(__file__).parent.parent
SRC  = ROOT / 'raw' / 'N03-20240101_10.geojson'
DEST = ROOT / 'municipalities.geojson'

PRECISION = 4  # 約10m 精度

def round_coords(obj):
    if isinstance(obj, list):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], PRECISION), round(obj[1], PRECISION)]
        return [round_coords(item) for item in obj]
    return obj

with open(SRC, encoding='utf-8') as f:
    src = json.load(f)

# 自治体名 → geometry リスト に集約
groups = defaultdict(list)
for feature in src['features']:
    p = feature['properties']
    # N03_004: 市区町村名、N03_003: 支庁・振興局名（郡など）
    name = p['N03_004'] or p['N03_003'] or p['N03_002'] or ''
    if not name:
        continue
    geom = feature['geometry']
    coords = round_coords(geom['coordinates'])
    if geom['type'] == 'Polygon':
        groups[name].append(coords)
    elif geom['type'] == 'MultiPolygon':
        groups[name].extend(coords)

# FeatureCollection を組み立てる
features = []
for name, polys in sorted(groups.items()):
    if len(polys) == 1:
        geometry = {'type': 'Polygon', 'coordinates': polys[0]}
    else:
        geometry = {'type': 'MultiPolygon', 'coordinates': polys}
    features.append({
        'type': 'Feature',
        'properties': {'name': name},
        'geometry': geometry,
    })

out = {'type': 'FeatureCollection', 'features': features}

with open(DEST, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

orig = os.path.getsize(SRC)
out_size = os.path.getsize(DEST)
print(f'元: {orig/1024:.0f} KB → 出力: {out_size/1024:.0f} KB ({out_size/orig*100:.0f}%)')
print(f'自治体数: {len(features)}')
for feat in features:
    print(f'  {feat["properties"]["name"]} ({feat["geometry"]["type"]})')
