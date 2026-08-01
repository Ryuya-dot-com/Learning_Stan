# はじめてのRとStan — 研究室のためのベイズ統計入門

プログラミング未経験の学生のための、日本語のR自習教材です。
最初はインストール不要の短い体験から始め、その後にRとRStudioを準備して、コードと実行結果を自分のPCでも確かめます。

**教材はこちら → https://ryuya-dot-com.github.io/Learning_Stan/**

- 体験 → STEP 0（環境構築）→ R基礎8レッスン → Foundation Checkの一本道を公開中
- 続編（データ操作・可視化・シミュレーション・ベイズ推定・brms・Stan）の構想は [学習ロードマップ](https://ryuya-dot-com.github.io/Learning_Stan/roadmap.html) を参照
- 品質改善・検証基盤・段階公開の実行計画は [改善・発展ロードマップ](ROADMAP.md) を参照
- 実機アクセシビリティ監査・初学者観察・公開判定の手順は [Foundation Gate実施キット](quality/foundation-gate/README.md) を参照
- Stan編は [非公開教材パック](content/stan/README.md) でL34–L41の設計と単回帰の縦切り原稿を検証中です。公開アプリにはまだ含まれません
- 理解問題と実機チェックの進みぐあいは、版付きデータとしてブラウザ内に保存されます（サーバには何も送信しません）。記述回答の本文は保存せず、JSONの書き出し・読み込み・明示的なリセットができます

## レッスンの追加方法

レッスンは 1本 = 1ファイルです。`src/data/lessons/<セクション>/` にファイルを置くだけで追加されます。

```
src/data/
├── sections.js          ← セクション定義(順序・配色)。新セクション時のみ編集
├── outcomes.js          ← 到達目標と、その評価証拠の対応表
└── lessons/
    ├── index.js         ← 自動収集。編集不要
    └── 0-basics/
        ├── l01-intro.js ← 1レッスン = 1ファイル
        └── ...
src/learningPath.js       ← 初学者に提示する段階・順序・再開規則
```

- ファイル名は `l01-`, `l02-` とゼロ埋め（名前順がレッスン順になります）
- レッスン番号は自動採番のため、ファイルには書きません
- 各レッスンの先頭ページには到達目標（「〜できるようになります」）を必ず入れます
- `src/data/outcomes.js` に、到達目標を直接測る演習または実践課題と判定基準を登録します
- 公開導線へ加えるレッスンIDを `src/learningPath.js` の該当段階へ登録します
- データの形式を間違えると `npm test` が失敗し、デプロイされません

## 開発

Node.js 22.23.1 と同梱の npm 10.9.8 を使用します（`.node-version` と `package.json` で固定）。

```bash
npm install
npm run dev      # 開発サーバ(http://localhost:5173/Learning_Stan/ で開きます)
npm test         # レッスンデータ・配色・ハイライトの検証
npm run test:r   # Rコード例と期待出力の照合（R 4.6.1が必要）
npm run test:stan-content  # 非公開Stan原稿・.stan・R実行コード・評価設計の同期検査
npm run gate:status        # Foundation Gateの現在状態を表示
npm run gate:require-pass  # 公開許可時のみ使用。現在はBLOCKEDのため失敗します
npm run build && npm run preview  # 公開と同条件での確認
```

dev・preview とも `vite.config.js` の `base`(`/Learning_Stan/`)配下で配信されます。ルートを開くとそこへ転送されます。

`main` に push すると GitHub Actions がテスト → ビルド → GitHub Pages への公開を自動で行います。

## コード例の方針

期待出力を載せるRコードと実機チェックの再現可能な例は検証器で実行し、基礎編では R 4.6.1 と照合しています。コンソール転記・未完成コード・パッケージ導入など自動実行しない例には、教材データ内の `verify.reason` で理由を明記します。
乱数やMCMCを使う例は、シードを固定しても環境やバージョンによって結果がわずかに変わることがあります。

本文とロードマップの事実主張は公式ドキュメント・CRANで裏を取っています。典拠は [SOURCES.md](SOURCES.md) にまとめました。

## ライセンス

| 対象 | ライセンス |
|---|---|
| コード（`src/` のUI・ロジック、ビルド設定） | [MIT](LICENSE) |
| レッスン本文・演習問題（`src/data/` のテキスト） | [CC BY 4.0](LICENSE-CONTENT) |

教材テキストを再利用する場合は、クレジットとして `Ryuya-dot-com` を表示してください。
