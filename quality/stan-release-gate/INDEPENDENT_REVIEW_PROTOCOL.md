# Stan独立レビュー実施手順

## 目的と現在状態

この手順は、Stan Release Gateの`SRG06`（独立専門レビュー）と`SRG09`（公開範囲の独立確認）を、固定した公開候補に対して第三者が実施するためのものです。レビュー対象は[`f7276e235ed36d39c016982a2b34b5cc87d98af3`](https://github.com/Ryuya-dot-com/Learning_Stan/commit/f7276e235ed36d39c016982a2b34b5cc87d98af3)です。

パックの状態は`ready-not-reviewed`です。手順・記録票・自動証拠が揃ったことを表し、独立レビューが完了したことや教材公開の`PASS`を表しません。

## レビュー者の適格性

- レビュー者コードは主実装者コード`CODEX`と異なる、不透明な識別コードにする。
- Stan言語・統計モデル・学習原稿の3 scopeを、自分の判断として確認できる人が実施する。複数人で分担する場合はscopeごとの担当コードを記録する。
- 自動テストの成功、主実装者の説明、既存のmodel answerをそのまま独立判断として転記しない。
- 氏名、メール、所属などの直接識別子を公開記録へ書かない。

## 1. パックと対象候補を分離する

レビュー手順は対象候補より後に追加されています。現在のブランチでパックを読み、対象候補は別worktreeへ展開します。

```bash
npm run test:stan-review-plan
git fetch origin
git worktree add ../Learning_Stan-srg-review f7276e235ed36d39c016982a2b34b5cc87d98af3
cd ../Learning_Stan-srg-review
```

既存の同名worktreeを上書きしません。別の安全な場所を使う場合も、`git rev-parse HEAD`が対象SHAと完全一致し、`git status --short`が空であることを記録します。

## 2. 対象SHAで自動証拠を再確認する

```bash
npm ci
npm test
npm run test:stan-content
npm run build
npm run audit:stan-public-scope
```

既存CI証拠は[run 31325892271](https://github.com/Ryuya-dot-com/Learning_Stan/actions/runs/31325892271)です。コマンドが失敗した場合は、結果を`PASS`へ丸めず、環境要因か教材要因かを問題票へ分けて記録します。長時間runtimeを独立再実行する必要があると判断した場合は、固定版CmdStanの導入手順と保存済み環境・source hashを先に照合します。

## 3. SRG06の3 scopeを確認する

確認対象の正本一覧は[review-plan.json](review-plan.json)に固定しています。

### Stan language

- 構文エラー8組について、診断断片、原因、修正、転移課題がStan 2.39.0の型・scope・ブロック・関数契約と整合する。
- コンパイル成功レビュー6組について、candidateとreferenceの差を構文上の正誤だけで説明していない。
- 制約、切断、打ち切り、Jacobian、`target`、`generated quantities`、`_lpdf` / `_lpmf`、`_rng`の説明に誤りがない。
- 数値安定性やcentered / non-centeredの選択を、コンパイラが保証する事柄へ格上げしていない。

### Statistical model

- 生成過程、支持範囲、尤度の正規化、変数変換、リンク尺度、offset、予測単位がコードと一致する。
- 単回帰、切断、リンク・LOO、L40比較の保存証拠がsource hash・環境・診断・教材結論を十分に支える。
- divergence、treedepth、E-BFMI、R-hat、ESS、MCSE、Pareto k、ELPD差、stackingの解釈が支える範囲を越えない。
- runtime未実測の主張を、構文成功や別ケースの結果から一般化していない。

### Learner material

- L34〜L41の目標、本文、よくある誤り、40問、直接評価が`curriculum.json`と対応する。
- 「まねる・変更・想起・転移」と、構文修正・正しく動く誤モデルの診断・未見転移が区別される。
- 自動正解、自己申告、最終コードだけを理解や保持の証拠にしていない。
- 初学者に不要な断定、未定義語、手順の飛躍、公式資料と衝突する説明を問題として記録する。

各scopeは`PASS`、`FAIL`、`BLOCKED`のいずれかで判定します。一つでも未確認なら`SRG06`全体を`PASS`にしません。

## 4. SRG09の手動確認を行う

- GitHubソース公開、アプリ掲載、参加者配布の3境界が[公開範囲ポリシー](../../PUBLICATION_SCOPE.md)どおり分離される。
- 入力済み観察記録、直接識別子、生ログ、credential、未見variant・採点鍵が誤って追跡されていない。
- `dist/`の通常導線へL34〜L41が入らず、`roadmap.html`だけが公開予定を説明する例外である。
- `draft-unpublished`がGitHub上の秘密を意味する、という誤解を招く表現がない。
- 自動監査が判断できない研究データの公開権限、自由記述の匿名性、配布権限を人が確認する。

3つの自動監査が成功していても、この手動確認と独立署名がなければ`SRG09`は`NOT RUN`のままです。

## 5. 問題と署名を記録する

1. [独立レビュー記録票](INDEPENDENT_REVIEW_RECORD.md)をコピーし、`reviews/SRG-CURRENT-<reviewer-code>.md`として記入する。
2. P0〜P3を観察事実として記録する。未解決P0・P1があれば`FAIL`、未確認項目があれば`BLOCKED`とする。
3. 未解決P2には所有者、期限、再検証条件を付ける。
4. 公開可能な記録にはレビュー者コードだけを書き、直接識別子や非公開原本を含めない。
5. 記録PRが受理された後にだけ`status.json`の`independentReview`、`publicScopeReview`、`SRG06`、`SRG09`を更新する。

`SRG06`と`SRG09`の完了は、Foundation Gate、初学者観察、遅延保持、最終公開判断を代替しません。
