# L41 自分のモデルを設計・診断・報告する

> このレッスンはStanベータ編の総仕上げです。L34からL40で学んだ設計、実行、診断、予測、比較を一つの分析へまとめます。

L34からL40までに、RとStanの境界、生成過程、再現可能な実行、HMC診断、事後予測、予測比較、再パラメータ化を一つずつ扱いました。L41では、それらを自分の研究課題へ統合し、第三者が「何を意図し、何を実行し、どの証拠から何を主張したか」を追跡できる卒業制作にします。

Stanコード1本が動いただけでは卒業制作になりません。研究質問と推定対象、データ契約、事前分布の根拠、事前予測、初回run、計算診断、事後予測、感度分析、主張の限界、再実行手順を同じ成果物へ結びます。うまくいかなかった初回結果も削除せず、判断が変わった理由の証拠として残します。

## このレッスンのゴール

終了時には、次のことができるようになります。

1. 研究課題を、研究質問、対象母集団、観測単位、estimand、prediction taskへ分解する。
2. コードを書く前に、データ契約、生成過程、prior predictive check、診断停止規則、事後予測統計量を固定する。
3. Stanソース、入力、実行設定、CSV、診断、図表、感度分析、報告をartifact manifestで対応付ける。
4. 構文成功、sampling成功、計算診断、Monte Carlo精度、予測妥当性、相対比較が支える主張を区別する。
5. 計算上の再パラメータ化と、prior・likelihood・分析対象を変える実質的な感度分析を分ける。
6. claim–evidence–limitの形で、支持された結論と未確認の一般化・因果主張を分離する。
7. clean environmentで第三者再実行を行い、再生成できたものと外部依存を記録する。

### このレッスンで作るもの

- コード前に作る研究質問・estimand・予測課題・停止規則・成果物対応表
- 意図的な問題または初回失敗を発見し、結果解釈を止めて修正した監査記録
- 自分の研究とは異なる未見文脈で、Stan実装から限定付き報告までを再構成した成果物

完成版だけでなく、計画、初回コード、初回出力、修正版、途中で参照した資料や受けた助けも分けて保存します。結論だけでなく、判断が変わった過程まで説明できる成果物を目指しましょう。

## 1. 最初に研究質問を計算可能な問いへ分ける

「介入は効いたか」「どのモデルがよいか」だけでは、Stanが計算すべき量も評価方法も決まりません。コードの前に次を1ページで定義します。

| 項目 | 書く内容 | 例 |
|---|---|---|
| 研究質問 | 研究上知りたい関係 | 条件Bで反応成功率は条件Aより高いか |
| 対象母集団 | 結論を及ぼしたい範囲 | この募集基準を満たす学生 |
| 観測単位 | 尤度の1寄与を作る単位 | 参加者内の1試行 |
| estimand | posteriorから要約する量 | 標準化年齢での平均成功確率差 |
| prediction task | 未観測とみなす対象 | 既存参加者の次試行、または新規参加者 |
| 利用可能な設計情報 | 無作為化、群、時点、欠測、測定上限 | 参加者内無作為順、参加者IDあり |

estimandとprediction taskは同じとは限りません。係数`beta`のposteriorを推定する問い、新しい参加者の応答を予測する問い、介入の因果効果を同定する問いは、必要な仮定と検証が違います。

観察データの回帰係数を報告できても、それだけで因果効果とは呼びません。処置割付、交絡、欠測、測定、干渉、対象母集団への一般化は、Stanのsampling診断では確認できない研究設計上の条件です。

## 2. コード前プロトコルを作る

結果を見てから都合のよい統計量や比較を選ばないため、少なくとも次を実行前に書きます。

1. 入力ファイル、観測単位、ID、型、大きさ、値域、欠測処理。
2. 生成過程と条件付き独立の仮定。
3. parameterの意味、単位、支持範囲。
4. priorの根拠とprior predictiveで許容するデータ範囲。
5. sampling設定と保存先。
6. 診断停止規則。
7. 事後予測へ使う全体・条件付き統計量。
8. 比較するなら候補モデル、予測対象、holdout単位。
9. 感度分析で一度に変える仮定。
10. 報告するestimand、予測量、区間、MCSE。

これは計画を永久に変更禁止にするためではありません。変更したときに、何を見て、どの仮定を、なぜ変えたかを追跡できるようにするためです。探索的な変更と確認的な分析を同じラベルで報告しません。

### データ契約を表にする

```text
name       Stan type              unit                  range / rule
N          int<lower=1>           observations          nrow(analysis_data)
J          int<lower=1>           participants          max(participant_index)
group      array[N] int            participant index     1..J, no missing
condition  vector[N]               centered predictor    documented levels
y          array[N] int            trial response        0 or 1
```

R側の名前とStanの`data`ブロックを照合し、分析対象行を作る処理を保存します。生データを手で上書きして解析用データにしません。実研究データに個人情報や公開制限がある場合、GitHubへ置くのはソース、合成例、データschema、hash、再現手順までとし、生データは承認された保管場所に残します。

## 3. 生成過程とpriorをデータを見る前に検査する

Stanコードへ移る前に、応答の支持範囲と観測過程を文章・数式で書きます。二値反応のvarying-intercept例なら、概念上の生成過程は次のようになります。

\[
\begin{aligned}
z_j &\sim \operatorname{Normal}(0,1),\\
\alpha_j &= \mu_\alpha + \tau_\alpha z_j,\\
\eta_n &= \alpha_{g[n]} + \beta x_n,\\
y_n &\sim \operatorname{Bernoulli}(\operatorname{logit}^{-1}(\eta_n)).
\end{aligned}
\]

この段階で問うのは次です。

- `y`は本当に0/1か。成功回数／試行回数ではないか。
- 同じ参加者の試行を条件付き独立としてよいか。
- `x`の0は何を意味し、interceptのpriorはその基準で妥当か。
- 新規参加者予測には群分布から新しい効果を生成する必要があるか。
- 欠測や選択が応答・予測子に依存していないか。

### prior predictive checkをsampling前のgateにする

priorからparameterを生成し、まだ観測`y`で条件付けずに複製データを作ります。成功率、群間差、極端な群数など、研究上意味のある統計量を確認します。

「広いpriorだから無情報」という判断はしません。logit係数の大きな標準偏差は、ほぼ0または1の確率を大量に生み得ます。現実にあり得ないデータを頻繁に生成するなら、尺度、リンク、中心化、priorの根拠を見直し、初回のprior predictive結果と変更理由を保存します。

prior predictiveが研究領域で明らかに不可能な観測を大量に生む場合、正式なデータfitへ進む前に停止します。警告がないStanコードでも、このgateは通過していません。

## 4. 実行成果物をrun単位で分離する

卒業制作の最小ディレクトリ契約は次です。

```text
capstone/
├── README.md
├── protocol.md
├── data-contract.md
├── models/
│   ├── primary.stan
│   └── sensitivity-likelihood.stan
├── scripts/
│   ├── 01-prepare-data.R
│   ├── 02-prior-predictive.R
│   ├── 03-fit.R
│   ├── 04-diagnostics.R
│   ├── 05-predictive-checks.R
│   └── 06-report.R
├── outputs/
│   ├── run-primary/
│   └── run-sensitivity/
├── report.md
└── artifact-manifest.csv
```

同じ出力先へ複数runを上書きしません。各runへ次を保存します。

- Stanソースと入力データの内容指紋。
- OS、R、CmdStanR、CmdStan、使用パッケージの版。
- seed、chain ID、warmup、sampling、`adapt_delta`、`max_treedepth`。
- CmdStan CSV、入力JSON、fit object、metadata。
- HMC診断、R-hat、bulk/tail ESS、報告量のMCSE。
- 事前予測・事後予測の表と図。
- LOOを使う場合はpointwise対応、Pareto k、比較表。
- 実行開始・終了時刻、終了状態、変更理由。

`fit$metadata()`は実際のCSVに記録された版・設定を確認するために使い、スクリプトへ書いた予定値だけを実行証拠にしません。`fit$save_output_files()`、`fit$save_data_file()`、`fit$save_object()`で一時成果物を永続化します。

## 5. artifact manifestで対応関係を固定する

artifact manifestは、「ファイルがある」という一覧ではなく、どの入力・ソース・run・主張に使ったかを示す索引です。

| field | 意味 |
|---|---|
| `artifact_id` | run内で一意なID |
| `path` | Project rootからの相対path |
| `role` | input、source、draws、diagnostic、prediction、report |
| `run_id` | 対応する実行ID |
| `source_hash` | 作成時ソースの内容指紋 |
| `input_hash` | 対応する入力の内容指紋 |
| `created_at` | タイムゾーン付き作成時刻 |
| `supports_claim` | report内のclaim ID |
| `status` | generated、verified、superseded |

Rだけでファイル一覧とMD5を保存する最小例です。

```r
artifact_paths <- c(
  "models/primary.stan",
  "outputs/run-primary/input.json",
  "outputs/run-primary/diagnostics.csv",
  "outputs/run-primary/posterior-predictive.csv",
  "report.md"
)

stopifnot(all(file.exists(artifact_paths)))

artifact_manifest <- data.frame(
  path = artifact_paths,
  md5 = unname(tools::md5sum(artifact_paths)),
  stringsAsFactors = FALSE
)

write.csv(artifact_manifest, "artifact-manifest.csv", row.names = FALSE)
```

MD5は偶発的な内容変化の検出に使う指紋であり、真正性や機密性の証明ではありません。プロジェクトがSHA-256を標準にしているなら、その同じ計算方法を全成果物へ使います。個人情報やsecretをmanifestへ書き込まないことも確認します。

## 6. 診断停止規則を結果の前に読む

次の順序を崩しません。

```text
data contract
  ↓
syntax・compile・runtime data check
  ↓
HMC diagnostics
  ↓
R-hat・bulk/tail ESS
  ↓
報告量のMCSE
  ↓
posterior predictive check
  ↓
必要ならpredictive comparison
  ↓
sensitivity analysis
  ↓
claim–evidence–limit report
```

各段階の成功が支える範囲は異なります。

| 状態 | 直接言えること | まだ言えないこと |
|---|---|---|
| 構文成功 | stanc3の構文・型検査を通った | モデルが研究課題に正しい |
| sampling終了 | 指定runが終了しdrawを保存した | chainが同じposteriorを十分探索した |
| HMC・R-hat・ESS良好 | 指定targetの探索に明らかな診断問題がない | 尤度・prior・観測過程が妥当 |
| MCSEが目的に十分 | 報告量を必要なMonte Carlo精度で近似した | posterior不確実性が小さい |
| PPCが選択統計量を再現 | その特徴について大きな不一致を発見しなかった | モデルが真、外挿可能、因果的 |
| PSIS-LOO比較可能 | 定義した予測課題で候補を相対比較できる | 候補外モデルより良い、真実確率が高い |

### 解釈を止める条件

- データ契約違反: 修正前のデータで実行しない。
- prior predictiveが明らかに不可能: priorまたは生成過程を再検討する。
- divergence: 重要parameterの解釈を止め、幾何・尺度・parameterizationを調べる。
- R-hat・ESS・MCSEが目的に不足: 推定値の断定を止め、原因と必要精度を調べる。
- PPCで重要特徴を外す: 適合済みという主張を止め、観測モデルへ戻る。
- 高Pareto k: ELPD順位の確定を止め、影響観測、refit、K-fold等を検討する。
- clean rerun失敗: 第三者再実行可能という主張を止める。

停止は失敗を隠すためではなく、どの証拠がまだ不足しているかを明示する判断です。

## 7. posterior predictive checkを研究質問へ合わせる

`y_rep`と観測`y`の全体平均だけを比べて終了しません。研究質問とモデル仮定に対応する統計量を、結果を見る前に選びます。

| 仮定・問い | PPC統計量の例 |
|---|---|
| 平均水準 | 全体平均、条件別平均 |
| 分散 | 全体SD、条件内SD |
| tail・外れ値 | 最大値、上位分位点、閾値超過数 |
| 二値group差 | 参加者別成功率分布、0/1に近い参加者数 |
| 時間順依存 | lag相関、run length、時点別残差 |
| varying effect | 群別傾き・差の分布に敏感な要約 |

合わなかった統計量だけで修正案を一意に決めることはできません。尤度のtail、非線形性、群構造、測定誤差、欠測など複数の原因候補を挙げ、変更する仮定を一度に一つ追跡します。

PPCがよく見えることを、未観測母集団への予測性能や因果同定の証拠へ広げません。prediction taskが新規参加者なら、同じ参加者の別行を学習側へ残さない評価も必要です。

## 8. predictive comparisonは必要なときだけ行う

卒業制作に複数モデルの順位は必須ではありません。研究質問を満たす1モデルを十分に批判・診断する方が、比較目的の曖昧な候補を増やすよりよい場合があります。

比較する場合は、次を先に固定します。

1. 同じ応答、観測集合、観測順を使う。
2. `log_lik`の列を同じ予測単位へ対応させる。
3. prediction taskに合うholdout単位を選ぶ。
4. Pareto kをELPD順位より先に確認する。
5. `elpd_diff`と`se_diff`を一緒に読む。
6. stacking weightをposterior model probabilityと呼ばない。
7. 全候補が同じPPC不一致を持つ可能性を残す。

予測比較は「研究仮説が真か」を直接判定する装置ではありません。定義した候補集合と予測課題における相対的な予測性能です。

## 9. sensitivity analysisは何を変えたかで分類する

すべての別runを同じ「感度分析」と呼ぶと、計算確認と実質的仮定変更が混ざります。

| 変更 | 分類 | 比較の目的 |
|---|---|---|
| seed、draw数、centered/non-centered | 計算上の確認 | 同じmodel-scale posteriorがMCSE内で整合するか |
| prior尺度・分布 | prior sensitivity | estimandと予測が合理的なprior候補でどう変わるか |
| NormalからStudent-tなどの尤度 | likelihood sensitivity | tail・外れ値仮定への依存 |
| 欠測・除外・分析対象 | data/target sensitivity | 結論の対象集合・前処理への依存 |
| 1行LOOからgroup holdout | prediction-task sensitivity | 予測対象を変えたときの性能差 |

一度に複数のprior、尤度、データ除外を変えると、結果差の原因を特定できません。変更は一つずつ行い、元runを残し、比較するestimand・予測統計量・診断を先に決めます。

「有意になった設定」や「期待方向になった設定」だけを残しません。結論が変わらなかったrunも、変わったrunも、事前に妥当と考えた範囲とともに報告します。parameterizationだけの変更でposteriorがMCSEを超えてずれるなら、計算問題、密度の非同値、保存量の尺度違いを疑います。

## 10. claim–evidence–limitで報告する

reportの各主要主張へIDを付け、証拠と限界を同じ行へ置きます。

| claim ID | claim | evidence | limit |
|---|---|---|---|
| C01 | 条件Bの平均成功確率がAより高い傾向 | probability differenceのposterior要約とMCSE | この標本・モデル・共変量範囲に条件付き |
| C02 | 重要な条件別成功率を概ね再現 | 観測値と`y_rep`の条件別PPC | 未確認のtail・別母集団を保証しない |
| C03 | 候補Bが1行先予測で優位 | Pareto k、ELPD差、SE | 新規参加者予測や候補外モデルへ広げない |
| C04 | prior候補内で方向が安定 | 全事前指定prior runの要約 | 検討していないprior・likelihoodは未確認 |
| C05 | 指定環境で再生成可能 | clean rerun logとartifact hash | 将来版・別OSの完全一致は未確認 |

「診断はすべて良好だったのでモデルは妥当」「95%区間が0をまたがないので因果効果が証明された」「stacking weightが0.9なのでモデルが真である確率90%」とは書きません。

### reportの必須節

1. 研究質問、対象母集団、estimand、prediction task。
2. データ由来、観測単位、除外・欠測、データ契約。
3. 生成過程、priorの根拠、prior predictive。
4. Stan実装、環境、run設定、成果物保存。
5. HMC診断、R-hat、ESS、MCSEと停止判断。
6. posterior要約とposterior predictive check。
7. 必要な場合の予測比較とPareto k。
8. sensitivity analysis。
9. claim–evidence–limit表。
10. 再実行手順、変更履歴、未解決事項。

## 11. clean environmentで第三者再実行する

自分のGlobal Environment、作業履歴、絶対path、既存のコンパイル済み実行ファイルに依存しないことを確認します。

```text
新しい一時Projectを作る
  ↓
必要な公開可能ソースと合成・許可済み入力だけを複製
  ↓
READMEの入口コマンドだけを実行
  ↓
Stanソースを構文確認・コンパイル
  ↓
入力JSON、複数chain CSV、診断、PPC、reportを再生成
  ↓
manifestの必須path・hash・run IDを照合
  ↓
元入力が不変であることを確認
```

乱数を含む成果物は、同じseed・版・chain IDでもプラットフォーム差やツール更新でバイト単位一致しない場合があります。何を厳密一致させ、何を数値許容差または統計的整合性で比べるかを定義します。再実行者が手でファイルを補った、GUIから設定を変えた、欠落成果物を過去runからコピーした場合はPASSにしません。

第三者レビューでは、最終コードだけでなく次を確認します。

- protocolと実装が一致するか。
- 初回の停止判断が保存されているか。
- source、input、CSV、図表、claimの対応が切れていないか。
- 構文成功や診断値をモデル妥当性へ格上げしていないか。
- 公開範囲に個人情報、研究データ、secretが含まれていないか。

## 12. 修了直後の完成と、時間を置いた定着確認を分ける

卒業制作を完成した直後は、設計やコードの記憶がまだ新しい状態です。そこで一度うまくできたことと、時間がたっても別の問題へ応用できることは分けて考えます。

理解を定着させるには、1〜2週間後を目安に、卒業制作とは異なる応答型のモデルへもう一度取り組んでみましょう。最初は完成例を見ず、データ契約、生成過程、事前分布、診断、予測量を自分で計画します。その後で公式資料や過去のノートを参照し、初回案から何を変えたかを記録します。

後日の復習では、正解できたかだけでなく、迷った箇所、参照した資料、修正した理由も残します。この記録が、次に重点的に復習する内容を教えてくれます。

## 13. 6回の練習で分析全体を結びつける

### 1回目: 読む・予測する

完成済みreportのclaimを一つ読み、直接必要なsource、input、run、diagnostic、prediction artifactを予測してからmanifestを確認します。

### 2回目: 穴埋めする

空欄のprotocolへ、対象母集団、観測単位、estimand、prediction task、prior predictive統計量、停止規則を補います。コード名だけでなく研究上の意味を書きます。

### 3回目: 一部を変える

primary modelのprior尺度だけを変更し、変えていないデータ・尤度・estimandを明記したsensitivity runを追加します。結果方向だけで採否を決めません。

### 4回目: エラーを直す

構文・R-hatは良好でも、全尤度を複製した`log_lik`、重要なtailを外すPPC、またはsourceとCSVが別runという成果物を監査し、解釈を止めて修正します。

### 5回目: 見本なし

自分の研究課題について、protocol、Stan、実行、診断、PPC、感度分析、claim–evidence–limit表、manifest、再実行手順を完成例なしで構成します。

### 6回目: 別文脈へ移す

卒業制作から1〜2週間後を目安に、別の応答型へ移ります。完成コードを見る前に一度自分で計画と実装を行い、その後に参照した公式資料、受けた助け、修正内容を分けて記録します。

## よくある誤り

1. **研究質問をStan parameter名だけで書く**
   対象母集団、観測単位、estimand、prediction taskへ分けます。

2. **コンパイル成功をモデル妥当性とする**
   構文・型の証拠と、観測過程・prior・予測の証拠は別です。

3. **予定した設定を実行証拠とする**
   CSV metadataと保存成果物から実際の版、seed、chain ID、iterationを確認します。

4. **診断値を最後に付け足す**
   停止規則を先に置き、違反時はestimandの解釈へ進みません。

5. **PPCで都合のよい統計量だけを見せる**
   事前指定した全体・条件付き統計量と初回図を残します。

6. **すべての別runを感度分析と呼ぶ**
   計算上の同値性確認、prior、likelihood、データ対象、prediction taskの変更を分類します。

7. **複数の仮定を一度に変える**
   結果差の原因を追えるよう、変更を分離します。

8. **LOO順位をモデルの真実性へ広げる**
   候補集合、観測集合、holdout単位、Pareto kへ限定します。

9. **最終成功runだけを保存する**
   初回失敗、停止、修正理由、支援内容も判断証拠です。

10. **再現可能を自分のPCで再実行できる意味に限定する**
    clean environmentと第三者再実行で隠れた状態依存を調べます。

11. **修了直後にできたので、もう定着したと考える**
    1〜2週間後に別の応答型でもう一度取り組み、どこまで自力で再現できるか確かめます。

12. **公開リポジトリへ実研究データも置く**
    ソース透明性とデータ公開権限を分け、個人情報・secret・制限データはコミットしません。

## 内容理解問題

回答は`foundation-assessments.json`に対応します。選択問題は選択肢をシャッフルし、初回回答をフィードバック前に保存します。

1. `stan-l41-q1-prior-predictive-gate`: prior predictiveの失敗で正式fitを止められるか。
2. `stan-l41-q2-evidence-ladder`: 診断・PPC・LOOが支える主張の範囲を予測できるか。
3. `stan-l41-q3-claim-evidence-limit`: estimandをclaim・evidence・limitへ結べるか。
4. `stan-l41-q4-sensitivity-classification`: 計算確認と実質的な感度分析を分類できるか。
5. `stan-l41-q5-transfer-capstone`: 未見の群付き件数データへ統合workflowを移せるか。

理解問題は形成的支援です。直接評価では、実際のprotocol、初回成果物、修正版、run manifest、診断、予測、報告、第三者再実行記録を確認します。

## 直接評価

### A. コード前プロトコルと成果物対応表

自分の卒業制作について、コードを書く前に研究質問、対象母集団、観測単位、estimand、prediction task、データ契約、生成過程、prior、停止規則、PPC統計量、感度分析、成果物一覧を作ります。

合格の観点:

- parameter名ではなく研究上のestimandと予測対象を定義する。
- prior predictive、計算診断、PPC、LOOが答える問いを分離する。
- 解釈を止める条件を結果を見る前に記録する。
- claim IDと必要artifactを対応付ける。
- 変更時に元計画と理由を残す。

### B. 失敗を含む監査・修正記録

初回runまたは意図的に壊した成果物を監査し、構文、密度、支持範囲、計算診断、予測単位、PPC、artifact identityの少なくとも一つの問題を発見します。

合格の観点:

- 最終成功結果から遡って失敗を作らず、初回artifactを固定する。
- 問題が支障を与える主張を明示して解釈を止める。
- 一度に一つの原因を修正し、修正版を別runとして保存する。
- 修正前後の診断・posterior・predictionを同じ尺度で比較する。
- 支援内容と自己修正の範囲を記録する。

### C. 未見文脈の再現可能なStan成果物

自分の主研究と異なる未見文脈について、データ契約から限定付きreportまでを1つの入口で再生成し、第三者へ引き渡します。修了直後の成果物とは別に、1〜2週間後の再挑戦も新しい成果物として残します。

合格の観点:

- 生成過程、prior、likelihood、link、parameter尺度を説明してStanへ移す。
- 複数chain、保存CSV、metadata、HMC診断、R-hat、ESS、MCSEを追跡する。
- `y_rep`と必要ならpointwise `log_lik`を予測課題へ対応させる。
- 少なくとも一つの事前指定した感度分析を、変更理由付きで行う。
- claim–evidence–limit表とartifact manifestを作る。
- clean environmentの第三者再実行結果と未解決事項を保存する。

提出時には、完成版だけでなく、初回案、修正理由、診断結果、参照した資料もそろえます。自力でできた部分と助けを借りた部分を区別し、まだ説明できない点は今後の課題として明記します。

## 公式資料

- [Stan User's Guide: Posterior and Prior Predictive Checks](https://mc-stan.org/docs/stan-users-guide/posterior-predictive-checks.html)
- [Stan User's Guide: Posterior Prediction](https://mc-stan.org/docs/stan-users-guide/posterior-prediction.html)
- [CmdStan Guide: Diagnose utility](https://mc-stan.org/docs/cmdstan-guide/diagnose_utility.html)
- [Stan Reference Manual: Posterior Analysis](https://mc-stan.org/docs/reference-manual/analysis.html)
- [CmdStanR: Run Stan's MCMC algorithms](https://mc-stan.org/cmdstanr/reference/model-method-sample.html)
- [CmdStanR: Extract metadata](https://mc-stan.org/cmdstanr/reference/fit-method-metadata.html)
- [CmdStanR: Save output files](https://mc-stan.org/cmdstanr/reference/fit-method-save_output_files.html)
- [loo: Efficient approximate leave-one-out cross-validation](https://mc-stan.org/loo/reference/loo.html)

これでL34からL41までの学習は一区切りです。卒業制作を保存して終わりにせず、1〜2週間後に別の応答型へ再挑戦し、設計・実装・診断・報告のうち迷った部分を次の復習へつなげてください。
