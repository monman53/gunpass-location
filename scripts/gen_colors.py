"""
municipalities.geojson の境界座標を使って隣接関係を正確に検出し、
隣接自治体の色相差が最大になるよう HSL 色相を割り当てる。
グリーディ + ランダム再起動で近傍の最小色相差を最大化する。

使い方: python3 scripts/gen_colors.py
結果は自動的に data.json の municipalities セクションに書き込まれる。
"""
from pathlib import Path
import json
import random

ROOT = Path(__file__).parent.parent
random.seed(42)

# ---- データ読み込み ----
with open(ROOT / 'municipalities.geojson', encoding='utf-8') as f:
    geo = json.load(f)

with open(ROOT / 'data.json', encoding='utf-8') as f:
    data = json.load(f)

municipalities = list(data['municipalities'].keys())
n = len(municipalities)

# ---- 境界座標セットを構築 ----
# mapshaper は隣接自治体の共有頂点を保持するので、
# 座標セットの積集合で隣接判定できる
coord_sets = {}
for feature in geo['features']:
    name = feature['properties']['name']
    geom = feature['geometry']
    pts = set()
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for poly in polys:
        for ring in poly:
            for pt in ring:
                pts.add((pt[0], pt[1]))  # 既に4桁丸め済み
    coord_sets[name] = pts

# ---- 隣接グラフ構築 ----
adj = {m: set() for m in municipalities}
for i, m1 in enumerate(municipalities):
    for m2 in municipalities[i + 1:]:
        if m1 not in coord_sets or m2 not in coord_sets:
            continue
        if coord_sets[m1] & coord_sets[m2]:
            adj[m1].add(m2)
            adj[m2].add(m1)

print('隣接関係:')
for m in municipalities:
    print(f'  {m}: {sorted(adj[m])}')

# ---- 色相プール（35色均等間隔）----
hues = [round(i * 360 / n) for i in range(n)]

def hue_dist(a, b):
    d = abs(a - b)
    return min(d, 360 - d)

def greedy_assign(order):
    available = list(hues)
    assigned = {}
    for m in order:
        nb_hues = [assigned[nb] for nb in adj[m] if nb in assigned]
        def score(h):
            if not nb_hues:
                return (360, 360)
            dists = sorted(hue_dist(h, nh) for nh in nb_hues)
            return (dists[0], dists[1] if len(dists) > 1 else 360)
        best = max(available, key=score)
        assigned[m] = best
        available.remove(best)
    return assigned

def min_adj_dist(assigned):
    worst = 360
    for m in municipalities:
        for nb in adj[m]:
            d = hue_dist(assigned[m], assigned[nb])
            if d < worst:
                worst = d
    return worst

# ---- ランダム再起動で最良解を探す ----
TRIALS = 3000
best_score = -1
best_assigned = None

for trial in range(TRIALS):
    if trial == 0:
        order = sorted(municipalities, key=lambda m: -len(adj[m]))
    else:
        order = sorted(municipalities, key=lambda m: -len(adj[m]) + random.uniform(-1.5, 1.5))
    assigned = greedy_assign(order)
    score = min_adj_dist(assigned)
    if score > best_score:
        best_score = score
        best_assigned = dict(assigned)

print(f'\n隣接ペアの最小色相差: {best_score}°')

# ---- 確認：色相差が小さいペア上位10件 ----
pairs = []
seen = set()
for m in municipalities:
    for nb in adj[m]:
        key = tuple(sorted([m, nb]))
        if key not in seen:
            seen.add(key)
            pairs.append((hue_dist(best_assigned[m], best_assigned[nb]), m, nb))
pairs.sort()
print('色相差が小さい隣接ペア（上位10件）:')
for hdist, m, nb in pairs[:10]:
    print(f'  {m}({best_assigned[m]:3d}°) - {nb}({best_assigned[nb]:3d}°) : 色相差{hdist:3d}°')

# ---- data.json に書き込み ----
for m in municipalities:
    h = best_assigned[m]
    data['municipalities'][m] = f'hsl({h}, 70%, 48%)'

with open(ROOT / 'data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('\ndata.json を更新しました。')
