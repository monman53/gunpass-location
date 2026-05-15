# 概要

群馬県が発行している「GUNMA PASSPORT」という冊子に、スタンプラリーの項目があります。
スタンプは県内各地に設置されていますが、公式のウェブページでは場所が視覚的にわかりにくいという問題点があります。
このプロジェクトでは、設置場所を地図上にわかりやすくプロットした、使いやすいウェブページを非公式で公開します。

# 要件

- はじめに群馬県全体の地図が表示されていて、なるべく地図上ですべての操作が完結すること
- スタンプの設置箇所一覧は https://gunpass.pref.gunma.jp/location/ に記載されています
  - 同じ自治体に複数設置されている場合でも、どれも同じ柄のスタンプ（利用者はどれか1か所回れば十分）
  - Google Maps へのリンクがあること
- スタンプを押した記録をロケーション単位で管理し、localStorage に保存すること
  - 1か所でも記録があれば自治体ポリゴンを塗りつぶす
  - ポップアップ外をタップするとポップアップを閉じ、続けて別の場所のポップアップが開かないようにする
  - マーカーをタップした場合は続けて表示してよい
- 群馬県の地図のみ表示すること（県外はマスクする）
- スマートフォンでも使いやすいこと
- なるべくシンプルなページ、絵文字は使用しない
- GitHub Pages で公開すること（monman53.github.io/gunpass-location/）
  - GitHub リンクをパネルフッターに配置する
  - main ブランチへの push で自動デプロイ
- Google Analytics を導入すること（G-E9ZG1KHTVT）
- 開発用に dev server を用意すること（`npm run dev`）
- README.md を設置すること

# 実装状況

## ファイル構成

```
gunpass-location/
├── index.html              — メインページ（Google Analytics・Leaflet CDN）
├── app.js                  — メインロジック
├── style.css               — スタイル
├── data.json               — 設置場所データ（regions / municipalities / locations）
├── municipalities.geojson  — 自治体境界ポリゴン
├── gunma_mask.geojson      — 群馬県外マスクポリゴン（県外を半透明グレーで覆う）
├── package.json            — npm run dev で開発サーバー起動
├── .github/workflows/deploy.yml  — GitHub Actions（main push で GitHub Pages 自動デプロイ）
└── scripts/
    ├── geocode.py              — Plus Code から緯度経度を取得して data.json を更新
    ├── build_municipalities.py — MLIT N03 データから municipalities.geojson を生成
    ├── build_mask.py           — municipalities.geojson から gunma_mask.geojson を生成
    └── gen_colors.py           — 隣接自治体の色相差を最適化（現在は未使用）
```

`raw/` ディレクトリ（MLIT 国土数値情報の元データ）は `.gitignore` で除外しています。

## 主な機能

- 群馬県内の自治体境界ポリゴンをオーバーレイ（MLIT 国土数値情報 CC-BY）
  - 訪問済み自治体は緑で塗りつぶし、未訪問は白の半透明
  - 群馬県外を半透明グレーでマスク
- 地図スタイルを8種類から選択（デフォルト: 国土地理院 淡色）
- スタンプアイコン（SVG）をクリックするとポップアップ表示
  - 施設名・Google Maps リンク・スタンプ記録ボタン・住所コピー
  - ポップアップ外をタップすると閉じ、続けて別の場所を開かない
  - ズームレベル11以上でマーカーラベルを表示
- スタンプ記録をロケーション単位で localStorage に永続化（`gunpass_stamps_v2`）
  - 1か所でも記録があれば自治体ポリゴンを緑で塗りつぶし
- 収集状況を画像としてシェア
  - Canvas で 1080×1080px 画像を生成（自治体塗りつぶし・スタンプアイコン・市区町村名）
  - モバイル: `navigator.share` によるネイティブ共有シート
  - デスクトップ: クリップボードコピー（失敗時はダウンロード）
- スマートフォン対応（パネルを下部バーに切り替え）
- GitHub Pages での自動デプロイ（`.github/workflows/deploy.yml`）

## データ更新方法

1. `data.json` の `locations` に場所を追加・修正する
2. `plusCode` フィールドに Plus Code を記入し `python3 scripts/geocode.py` を実行すると緯度経度が更新される
3. 自治体境界を更新する場合は `scripts/build_municipalities.py` → `scripts/build_mask.py` の順に実行する

## バージョン管理

semver（`0.x.x`）に準拠する。

- `0.x.0` — 機能追加・UI の大きな変更
- `0.x.x` — バグ修正・小さな調整

リリース手順:
1. `package.json` と `index.html` の `#version` を更新する
2. `dev` → `main` にマージする
3. `main` で git tag を打つ: `git tag v0.x.x && git push origin v0.x.x`

## メンテナンスルール

- 機能を追加・変更したら、このファイル（`AGENT.md`）と `README.md` を必ず更新する
- 作業は `dev` ブランチで行い、`main` へのマージ時のみ GitHub Pages にデプロイされる
  - 普段: `dev` ブランチで作業・push
  - リリース: `git checkout main && git merge --no-ff dev && git push && git checkout dev`