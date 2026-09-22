// STEP 4: MCMCへの橋渡しとStan環境
const ladder = {
  title: "4段階の反復練習",
  intro: "今回くり返す技能は「MCMCの役割を理解し、Stanを再現可能に実行する準備をすること」です。各段階は、実際にRで確かめてからチェックしてください。",
  steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "brmsとcmdstanrを読み込み、toolchainとCmdStan版を確認します。", criterion: "Rパッケージ、CmdStan、C++コンパイラの役割を区別できたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "chain数を2と4で比べ、warmup後のdraw数を実行前に計算します。", criterion: "chain数、iteration、warmupのどれを変えたかと、残るdraw数を説明できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "連続応答の最小`brm()`を、family、prior、seed、chains、iter、warmupを含めて書きます。", criterion: "実行設定と`summary()`、`nuts_params()`を見ずに再現できたら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "二値の正答データについて、Bernoulli familyを使う最小モデルの設定と、実行後に確認する順序を設計します。", criterion: "応答の支持範囲、family、計算診断、予測検査を混同せずに説明できたら完了です。" },
  ],
};

export default {
  id: "l26",
  title: "MCMCで事後分布を近似する",
  tag: "draw・chain・Stan環境",
  practiceLadder: ladder,
  pages: [
    {
      t: "格子が難しくなると、drawで近似する",
      b: [
        "前の回では未知の平均muを細かい格子に並べました。しかし回帰ではintercept、複数の傾き、残差尺度など未知量が増えます。各parameterを2000通りずつ並べると、二つで400万通り、三つで80億通りとなり、格子を全部計算する方法はすぐ難しくなります。",
        "StanとbrmsはHamiltonian Monte Carlo（HMC）を使い、事後分布を代表するdrawを作ります。drawを十分に集めることで、平均、区間、予測確率などを近似します。drawは単独で正解かどうかを判定する値ではなく、分布全体として読みます。",
        "このレッスンでは、MCMCのwarmup・chain・drawの役割を区別し、brmsとStanを手元で実行する準備と、実行後に最初に確認する診断を説明できるようになります。",
      ],
      code: `grid_points <- 2000
grid_points^2
grid_points^3`,
      out: "[1] 4e+06\n[1] 8e+09",
      a: ["格子近似は小さなモデルの仕組みを見るには有用です。一方、多parameterの回帰で必要なのは、全格子を総当たりせず、事後確率が高い領域を効率よく探索する方法です。"],
    },
    {
      t: "warmup、chain、drawを混同しない",
      b: [
        "MCMCでは複数のchainを異なる出発点から動かします。各chainの最初のwarmupでは、HMCが探索に使うstep sizeなどを調整します。warmupのdrawは通常、事後要約には使いません。その後のsampling drawを合わせて事後分布を近似します。",
        "chainが同じ分布を探索できたか、drawが研究上必要な精度を持つか、HMCが難しい形で止まっていないかを確認してから推定値を読みます。R-hat、ESS、divergenceは別の問いに答えるため、R-hatだけで終了しません。",
      ],
      code: `library(brms)

fit <- brm(
  score ~ sleep_c,
  data = dat,
  family = gaussian(),
  prior = priors,
  chains = 4,
  iter = 2000,
  warmup = 1000,
  seed = 2026,
  backend = "cmdstanr"
)
summary(fit)
nuts_params(fit)`,
      verify: { mode: "manual", reason: "brms・CmdStan環境で行うMCMC実行と診断確認のため" },
      a: ["この指定では4 chainを各2000 iteration動かし、各chainの最初の1000をwarmupに使います。summaryでR-hatとESSを確認し、nuts_paramsでdivergenceを調べます。診断が良くても尤度、prior、観測過程が正しいとは限りません。"],
    },
    {
      t: "brmsとCmdStanを手元に準備する",
      b: [
        "brmsはRからモデルを指定するパッケージで、Stanはその背後で確率モデルをコンパイルしsamplingします。ここではbrmsからCmdStanを使う準備をします。RとRStudioの導入は済んでいる前提です。",
        "install.packagesはPCへ一度入れる作業で、libraryは新しいRセッションごとに行う読込です。CmdStanの導入にはC++コンパイラも必要です。まず公式の診断を実行し、問題があれば表示された案内に従います。",
      ],
      code: `install.packages("brms")
install.packages(
  "cmdstanr",
  repos = c("https://stan-dev.r-universe.dev", getOption("repos"))
)

library(brms)
library(cmdstanr)
check_cmdstan_toolchain()
install_cmdstan()
cmdstan_version()`,
      verify: { mode: "manual", reason: "パッケージ導入・コンパイラ確認・CmdStanビルドは利用者のPCとネットワークを変更するため" },
      a: ["install_cmdstanはCmdStanをダウンロードしてコンパイルするため時間がかかります。失敗したら、エラーメッセージ、OS、R版、check_cmdstan_toolchainの結果を残し、設定を無作為に変えず失敗した工程を分けて確認します。"],
    },
    {
      t: "実行できたことと、分析できることを分ける",
      b: [
        "コードの構文確認、C++コンパイル、samplingの完走、計算診断、事後予測、研究上の妥当性は別々の確認です。たとえばiterationを増やしても、divergenceの原因であるparameterizationやpriorの尺度を自動で直すわけではありません。",
        "再現のために、Rとパッケージの版、CmdStan版、seed、chain数、iteration、入力データを記録します。seedを固定してもOSや版が異なればdrawが完全に同じになるとは限りません。",
      ],
      code: `sessionInfo()
cmdstan_version()
run_record <- list(seed = 2026, chains = 4,
                   iter = 2000, warmup = 1000)
run_record`,
      verify: { mode: "manual", reason: "利用者の環境情報を表示・記録するコードのため" },
      a: ["分析結果だけでなく、どの環境と設定で得たかを残します。警告を隠すために設定を変えるのではなく、変更前後の診断と理由を記録します。"],
    },
  ],
  ex: [
    { id: "imitate-q01", revision: 1, k: "choice", q: "warmupの主な役割として最も適切なのはどれですか?", opts: ["最終報告に使うdrawを増やす", "HMCが探索に使う設定を調整する", "観測データを追加する", "priorを自動で選ぶ"], ans: 1, why: "warmupはstep sizeなどを適応させる期間です。通常はwarmup後のsampling drawを事後要約に用います。", hint: "warmupはsamplingの前に探索の準備をする期間です。" },
    { id: "imitate-q02", revision: 1, k: "choice", q: "4 chain、iter = 2000、warmup = 1000を指定したとき、warmup後のdrawは合計でいくつですか?", opts: ["1000", "2000", "4000", "8000"], ans: 2, why: "各chainは2000回のうち1000回をwarmupに使うため、sampling drawは1000回です。4 chainで4000 drawになります。", hint: "1 chainに残るdraw数を出してからchain数を掛けます。" },
    { id: "imitate-q03", revision: 1, k: "reflect", q: "R-hatが1.00でも、推定値を直ちに研究結論へ使えない理由を二つ書いてください。", minLength: 55, rubric: ["R-hatがchain間の整合性に関する指標だと述べている", "divergence、ESS、またはMonte Carlo精度を別に確認すると述べている", "観測過程、prior、PPCなどモデル妥当性の確認を挙げている"], example: "R-hatはchainが同じ分布を探索しているかの一指標であり、divergenceやESSを代替しない。また、良いR-hatは指定した尤度やpriorが研究上妥当である証拠ではないので、PPCと観測過程も確認する。" },
    { id: "imitate-q04", revision: 1, k: "reflect", q: "install_cmdstanが失敗したとき、再試行前に残すべき情報と、避けるべき行動を短く書いてください。", minLength: 55, rubric: ["エラーメッセージまたは失敗した工程を残している", "OS、R版、パッケージ版、toolchain診断の情報を挙げている", "原因を確認せず設定を無作為に変えないと述べている"], example: "エラーメッセージ、OS、R版、cmdstanr版、check_cmdstan_toolchainの結果を残す。どの工程で失敗したかを分け、原因を確認せずコンパイラ設定やsampling設定を次々に変えない。" },
    { id: "imitate-q05", revision: 1, k: "choice", q: "samplingが最後まで完走し、警告もなかったときに直接言えることはどれですか?", opts: ["因果効果が確認された", "モデルが真である", "指定した計算が完走した。診断とモデル検査は別に続ける", "priorの影響がない"], ans: 2, why: "完走は必要な段階ですが、計算診断、PPC、予測比較、研究設計の妥当性を保証しません。", hint: "実行できたことと研究上正しいことを分けます。" },
  ],
  practice: {
    title: "成果物チェック",
    intro: "実行できたという事実と、診断・モデルの妥当性を別々に記録します。",
    items: [
      { id: "environment-record", label: "実行環境の記録", criterion: "R・brms・CmdStanの版とtoolchain確認結果を残す" },
      { id: "sampling-plan", label: "sampling設定表", criterion: "chain・iter・warmup・seedと、残るdraw数を記録する" },
      { id: "first-diagnostics", label: "最初の診断メモ", criterion: "R-hat・ESS・divergenceの役割を分け、問題時の次の確認を書く" },
    ],
  },
  challenge: {
    title: "R-hatだけでは見逃す失敗を考える",
    scenario: "すべてのR-hatが1.00でdivergenceも0ですが、事後予測では観測データの最大値をほとんど再現できません。",
    task: "このfitを『問題なし』としない理由を説明し、計算・モデル・データの三方向で次に確認する項目を一つずつ挙げてください。",
    hints: ["サンプラーが安定したことと、モデルがデータを表すことは別です。", "PPCで再現できない特徴を生成過程へ戻します。"],
    rubric: ["計算診断とモデル適合を区別している", "最大値を再現しない原因となる尤度や階層構造を検討している", "データの単位・外れ値・記録過程も確認している"],
    example: "R-hatとdivergenceは計算の手掛かりであり、最大値を再現できないモデルを正当化しない。ESSとtrace、裾を表す尤度や参加者差、単位・入力ミス・打切りの有無を分けて確認する。",
  },
};
