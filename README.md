# PhantomWords

> The Unwritten Dictionary / 書かれざる辞書
> 
`PhantomWords` は、まだ誰も知らない「幻の言葉」を発見し、収集するためのWebアプリケーションです。マルコフ連鎖アルゴリズムによって、実在しないながらもどこかに存在していそうな、不思議な響きを持つ単語とその定義を無限に生成します。


---

## ✨ Features / 主な機能

*   **無限の単語生成**: スクロールするだけで、新しい幻の言葉が次々と「発見」されます。
*   **高速な初期表示**: 軽量版データベースを最初に読み込むことで、ユーザーを待たせることなく即座にコンテンツを表示します。
*   **検索 & サジェスト**: 接頭辞を入力すると、それに続く幻の言葉をリアルタイムで生成・検索できます。入力中のサジェスト機能も搭載。
*   **共有機能**: 気に入った言葉を簡単にSNSなどで共有できます（モバイルではWeb Share API、PCではクリップボードにコピー）。
*   **モダンなUI/UX**:
    *   無限スクロール
    *   Pull-to-Refresh（モバイル）
    *   完全レスポンシブデザイン
*   **パフォーマンス最適化**: Web Workerを利用して重い処理をバックグラウンドで行うため、UIが固まることなく快適に操作できます。

---

## 🛠️ How It Works / 仕組み

このプロジェクトは、以下の技術を組み合わせて実現されています。

*   **コアロジック**: **マルコフ連鎖 (Markov Chain)** を利用しています。
    1.  **単語生成**: 約10万語の辞書データから文字の出現パターンを学習し、新しい綴りの単語を生成します。
    2.  **定義文生成**: 全ての定義文を単語単位で学習し、辞書らしい文体の新しい文章を生成します。
*   **データソース**: **Webster's Unabridged Dictionary (1913)** (Project Gutenberg) を `parser.py` で整形して利用しています。
*   **翻訳**: **Google Apps Script (GAS)** で自作したAPIエンドポイントを利用し、サーバーレスかつ安全にリアルタイム翻訳を行っています。
*   **フロントエンド**:
    *   フレームワークを使わない、素のHTML, CSS, JavaScript (ES Modules)
    *   `pulltorefresh.js`

---

## 🚀 Getting Started / 開発環境のセットアップ

このプロジェクトをあなたのローカル環境で動かすには、以下の手順に従ってください。

1.  **リポジトリをクローンする:**
    ```bash
    git clone https://github.com/AruihaYoru/PhantomWords.git
    cd PhantomWords
    ```

2.  **データベースを生成する:**
    `db/` ディレクトリに移動し、Pythonスクリプトを実行して辞書データベース (`markov_db.json` と `markov_db_lite.json`) を生成します。
    ```bash
    cd db
    python parser.py
    cd ..
    ```

3.  **ローカルサーバーを起動する:**
    このプロジェクトはES Modulesを利用しているため、`file://` プロトコルでは動作しません。ローカルサーバーが必要です。VS Codeの拡張機能である [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) を使うのが最も簡単です。
    ....ぶっちゃけ、server.batにpython -m http.server 8000って書くのが楽ですけど
    Live Serverをインストール後、`index.html` ファイルを右クリックして「Open with Live Server」を選択してください。

4.  **翻訳APIを設定する:**
    `js/main.js` ファイル内の `GAS_TRANSLATE_URL` を、あなた自身で作成したGoogle Apps ScriptのURLに置き換えてください。

---

## 🙏 Acknowledgements / 謝辞

*   **Dictionary Data:** [WebstersEnglishDictionary](https://github.com/matthewreagan/WebstersEnglishDictionary)
*   **Pull-to-Refresh Library:** [pulltorefresh.js](https://github.com/BoxFactura/pulltorefresh.js)

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
