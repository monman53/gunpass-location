# GUNMA PASSPORT スタンプ設置場所マップ

GUNMA PASSPORT のスタンプラリー設置場所を地図上に表示する非公式ウェブページです。

公開URL: https://monman53.github.io/gunpass-location/

## 機能

- 群馬県全体の地図にスタンプ設置場所（44か所）をプロット
- 自治体境界ポリゴンをオーバーレイ表示（訪問済みは緑・未訪問は白の半透明）
- 群馬県外を半透明グレーでマスク
- 地図スタイルを8種類から選択（Voyager・Positron・Dark Matter・OSM・OpenTopo・国土地理院 標準/淡色/写真）
- マーカーまたは自治体ポリゴンをクリックすると施設名・Google Maps リンク・住所（コピー可）を表示
- スタンプ記録はロケーション単位でブラウザの localStorage に保存
  - 1か所でも記録すると自治体ポリゴンが緑に塗りつぶされる
- スマートフォン対応（パネルが下部バーに切り替わる）

## データ

設置場所データは [`data.json`](data.json) で管理しています（2026年5月時点）。
情報が古い可能性があるため、必ず公式ページで最新情報をご確認ください。
公式情報: https://gunpass.pref.gunma.jp/location/

自治体境界ポリゴンは[国土数値情報（行政区域）](https://nlftp.mlit.go.jp/ksj/)（国土交通省）CC BY を利用しています。

## 開発

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

`fetch` を使用しているため、ファイルを直接開く（`file://`）と動作しません。必ず HTTP サーバー経由で開いてください。

## デプロイ

`main` ブランチへの push で GitHub Actions が自動的に GitHub Pages へデプロイします。
