# Korea Flash Card

このフォルダは、VSCodeでそのまま開いて編集できて、Cloudflare Pagesへ公開しやすい静的サイト構成に整えた版です。

## 追加した主なファイル

- `index.html`
- `assets/styles.css`
- `assets/app.js`
- `assets/config.js`

## 使い方

1. このフォルダをVSCodeで開く
2. `index.html` を起点に編集する
3. `assets/config.js` の `googleSheetCsvUrl` に、公開済みGoogleスプレッドシートのCSV URLを入れる
4. ブラウザで `index.html` を確認する

## Googleスプレッドシート側の想定列

ヘッダーは次の形にしてください。

```csv
id,ko_word,word_en,example_ko_display,example_ko_tts,example_en,example_jp
```

例:

```csv
1,이름,name,제 이름은 유나예요.,제 이름은 유나예요.,My name is Yuna.,私の名前はユナです。
2,뭐,what,이거 뭐예요?,이거 뭐예요?,What is this?,これは何ですか？
```

## Googleスプレッドシート公開URLの作り方

1. スプレッドシートで `ファイル` -> `共有` -> `ウェブに公開`
2. 対象シートを公開
3. CSV形式の公開URLを使う

URL例:

```text
https://docs.google.com/spreadsheets/d/e/XXXXXXXXXXXXXXXXXXXXXXXX/pub?gid=0&single=true&output=csv
```

それを `assets/config.js` の `googleSheetCsvUrl` に入れてください。

```js
window.APP_CONFIG = {
  appTitle: "韓国語単語 6択テスト",
  appSubtitle: "公開Googleスプレッドシートの内容を更新すると、次回読込時に表示内容も変わります。",
  googleSheetCsvUrl: "ここに公開CSV URLを入れる",
  fallbackCsvPath: "./korean_words_examples_112.csv",
  memoStorageKey: "korean-flashcard-memo",
  modeStorageKey: "korean-flashcard-mode"
};
```

## Cloudflare Pages で公開する流れ

1. このフォルダをGitHubへ置く
2. Cloudflare Pagesで対象リポジトリを接続
3. Build command は空欄
4. Output directory は `/` か空欄
5. デプロイ

静的ファイルだけなので、特別なビルドは不要です。

## ローカル確認

VSCodeの `Live Server` 拡張を使うか、ターミナルで次を実行します。

```bash
python3 -m http.server 8080
```

その後、`http://localhost:8080` を開きます。

## 補足

- `googleSheetCsvUrl` が空なら、ローカルの `korean_words_examples_112.csv` を使います
- スプレッドシートの内容を更新すると、ページ再読込時に新しい内容が反映されます
- もしGoogle側の制限で直接取得できない場合は、Cloudflare Workersを中継にする構成へ拡張できます
