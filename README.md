# 暴力的にカワイイ 非公式タイムテーブル

2026/9/26・9/27、3 FLOORの静的タイムテーブル。公式画像をもとにした非公式サイトです。

## GitHub Pages

Settings → Pages → Build and deployment で **Deploy from a branch**、**main / (root)** を指定します。以後mainへのpush・マージで更新されます。独自のGitHub Actions workflow、ビルド、npm installは不要です。

公開URL: https://hashiserver.github.io/boukawa-unofficial-timetable-2026/

## ローカル確認・テスト

```sh
python3 -m http.server 8000
# http://localhost:8000
npm test
```

Node.js 18以上。アプリ自体は依存ライブラリなしのHTML/CSS/JavaScriptです。

## 初回案内

初回アクセス時に使い方と非公式サイトである旨を表示します。案内を閉じるとブラウザ内に記録し、次回以降は表示しません。保存データを削除すると再表示されます。

## 操作

- カードを約0.54秒長押しするとピンを追加・解除。通常タップでは変化しません。
- キーボードではカードをTabで選び、Enter/Spaceでピンを切り替えます。
- ピンは同じ端末・ブラウザに保存。重複する公演も登録できます。
- NOW/NEXTは選択している日のピンが対象。同時公演をすべて表示します。
- 時刻判定はAsia/Tokyo固定。現在時刻へ追従し、手動操作で解除。NOWへで再開します。
- 3FLOOR共通の時間軸を文字量に合わせて調整し、カードの補足が切れないようにしています。

## ファイル

- `index.html`, `styles.css`: 画面
- `src/app.js`: 表示・保存・現在時刻への追従
- `src/schedule.js`: JST・NOW/NEXT・公演状態
- `src/layout.js`: 共通時間軸の可読性調整
- `src/longpress.js`: 長押し・スクロール時のキャンセル
- `data/schedule.json`: 2日間74公演。IDはピン保存に使用するため変更しないでください。
- `assets/official-day*.jpeg`: 提供された公式画像。ロゴ表示・照合用。画像の権利は各権利者に帰属します。

## データの扱い

出演者・開始時刻・FLOOR・VJ・補足は提供画像に準拠。終了時刻は次の公演開始から算出し、各FLOOR最終公演は依頼仕様に従い20:30終了としています（画像上のFLOOR 2・3最終枠とは異なります）。ロゴは画像を表示領域で切り出し、背景はCSSで再現しています。

## 検証

`npm test`で日付/JST、開始・終了境界、NOW/NEXTの同時公演、長押し/移動キャンセル、全74公演の構造・終了時刻、文字量に応じた時間軸調整を確認します。Android Chrome・iPhone Safariの実機検証は別途必要です。
