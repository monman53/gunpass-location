"""
data.json の plusCode フィールドを lat/lng に変換して上書きする。
plusCode が空またはないロケーションはスキップする。

使い方: python3 scripts/geocode.py
"""
from pathlib import Path
import json
from openlocationcode import openlocationcode as olc

ROOT = Path(__file__).parent.parent

def decode_plus_code(plus_code, ref_lat, ref_lng):
    code = plus_code.split()[0]  # "6RF2+GR Shimonita, Gunma" → "6RF2+GR"
    if not olc.isFull(code):
        code = olc.recoverNearest(code, ref_lat, ref_lng)
    area = olc.decode(code)
    return round(area.latitudeCenter, 6), round(area.longitudeCenter, 6)

with open(ROOT / 'data.json', encoding='utf-8') as f:
    data = json.load(f)

updated = 0
for loc in data['locations']:
    if not loc.get('plusCode'):
        continue
    lat, lng = decode_plus_code(loc['plusCode'], loc['lat'], loc['lng'])
    loc['lat'] = lat
    loc['lng'] = lng
    print(f"[{loc['id']:2d}] {loc['name']}: {lat}, {lng}")
    updated += 1

with open(ROOT / 'data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n{updated} 件を更新しました。")
