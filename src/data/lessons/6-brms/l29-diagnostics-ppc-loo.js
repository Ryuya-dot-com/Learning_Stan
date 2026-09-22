export default {
  id: "l29",
  title: "計算診断・PPC・LOOを分ける",
  tag: "R-hat・事後予測・予測比較",
  pages: [
    {
      t: "三つの問いは別の問い",
      b: [
        "このレッスンでは、計算診断、事後予測チェック、予測比較が答える問いを分け、根拠の範囲を限定して報告できるようになります。",
        "候補Aは実験条件だけ、候補Bは条件と基礎得点で平均反応時間を予測します。まず計算診断は「指定した事後分布を十分に探索できたか」、PPCは「重要なデータの特徴を再現できるか」、LOOは「同じ予測課題で候補間の予測性能がどう違うか」を問います。どれも因果効果やモデルの真実を保証しません。",
      ],
      code: "# 先にダウンロードしたstep5_data.RをProject直下から読み込む\nsource(\"step5_data.R\")\nlibrary(brms)\n\nrt_priors <- c(\n  prior(normal(550, 150), class = Intercept),\n  prior(normal(0, 75), class = b),\n  prior(exponential(1.0 / 100), class = sigma)\n)\n\nfit_a <- brm(\n  mean_rt_ms ~ condition, data = people, family = gaussian(),\n  prior = rt_priors, seed = 2026\n)\nfit_b <- brm(\n  mean_rt_ms ~ condition + baseline_z, data = people, family = gaussian(),\n  prior = rt_priors, seed = 2026\n)\n\nsummary(fit_b)\nnuts_params(fit_b)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["`summary()`ではR-hatとESSを確認します。divergenceは`nuts_params()`などで確認します。これらは指定した事後分布を計算できたかの確認で、次のPPCとは別の問いです。"],
    },
    {
      t: "条件別の中心を、一問一図で確かめる",
      b: [
        "ここでの研究上の問いは「各条件の典型的な反応時間を、モデルは再現できるか」です。この問いには、条件別の中央値を観測値と複製値で比べる一枚のPPCを使います。全体の`dens_overlay`だけでは、二条件の中心が別々に合っているかは読みにくいからです。",
        "反応時間の裾や二峰性そのものが研究上の問いなら、分布形を比べる別のPPCを事前に選びます。中心を確かめたいだけなのに、見栄えのための密度図を追加する必要はありません。",
      ],
      code: "pp_check(\n  fit_b,\n  type = \"stat_grouped\",\n  group = \"condition\",\n  stat = \"median\"\n)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["各条件で、観測された中央値が複製された中央値の分布と比べてどこにあるかを読みます。複製中央値はparameter drawそのものではなく、そこから再生成した応答の要約です。一方の条件だけ外れていれば、その条件の中心をモデルが再現できていない疑いがあります。"],
    },
    {
      t: "LOOは同じ予測課題で比べる",
      b: ["LOOは各観測を順に外したとみなして、まだ見ていない観測への予測を比べる近似です。比較する候補は同じデータ、同じ観測単位、同じ将来予測課題に答えている必要があります。Pareto kが大きい観測があれば、近似の信頼性とその観測の意味を調べます。"],
      code: "loo_a <- loo(fit_a)\nloo_b <- loo(fit_b)\nloo_compare(loo_a, loo_b)\n\nplot(loo_b)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["LOOの順位だけを読むのではなく、差と不確実性、Pareto k、PPCで失敗した特徴を一緒に記録します。新しい参加者を予測したい反復測定では、試行を一つ外す評価が研究質問に合うとは限りません。"],
    },
  ],
  ex: [
    { id: "l29-q01", revision: 1, k: "choice", q: "divergenceが確認されたfitについて、最初に避けるべきことはどれですか。", opts: ["推定値をそのまま結論に使う", "どのparameter付近で起きるか調べる", "モデルの尺度とpriorを確認する", "再現可能なseedを記録する"], ans: 0, why: "divergenceは事後分布の探索が不十分な可能性を示します。推定値を解釈する前に、モデル化と計算を調べます。", hint: "計算が十分に探索できたか不明なとき、結論を先に出せるでしょうか。" },
    { id: "l29-q02", revision: 1, k: "choice", q: "条件別中央値のPPCで、一方の条件の複製中央値だけが観測中央値より一貫して低いと分かりました。最も直接いえることはどれですか。", opts: ["その条件の中央値をモデルが十分に再現していない疑いがある", "条件効果は因果効果である", "全体の平均は必ず正しい", "chain数を増やせば中央値は自動的に合う"], ans: 0, why: "このPPCは選んだ統計量である条件別中央値の再現を検査しています。因果性やほかの特徴を直接保証しません。", hint: "PPCは、あらかじめ選んだどの特徴を比べているかに答えます。" },
    { id: "l29-q03", revision: 1, k: "reflect", q: "LOOで候補Bが少し良かったが、差の標準誤差も大きく、条件別PPCではBが遅い反応を再現できませんでした。比較結果を二文で報告してください。", minLength: 80, rubric: ["LOOの差に不確実性があることを述べている", "PPCで再現できない特徴を具体的に述べている", "順位だけで真のモデルや因果効果と結論していない"], example: "同じ観測単位への予測では候補Bがわずかに良かったが、LOO差には大きな不確実性があった。さらにBは条件別の遅い反応を再現できなかったため、Bを唯一の正しいモデルとは扱わず、予測目的に照らして改良または併記を検討する。" },
    { id: "l29-q04", revision: 1, k: "reflect", q: "次の比較コードをレビューしてください。なぜ`loo_compare()`を実行する前に止めますか。", code: "fit_a <- brm(rt_ms ~ condition, data = people_2025)\nfit_b <- brm(rt_ms ~ condition + baseline_z, data = people_2026)\nloo_compare(loo(fit_a), loo(fit_b))", lang: "R", verify: { mode: "manual", reason: "レビュー用の比較不能なコードを含むため" }, minLength: 70, rubric: ["二つのfitが異なるデータを使っていると指摘している", "同じ観測単位と予測課題をそろえる必要を述べている", "年度差はモデル差と区別できないと説明している"], example: "二つのモデルが別年度の別データでfitされているので、LOO差は式の違いだけを表さない。同じ対象・同じ観測単位・同じ予測課題でfitし直してから比較する。" },
    { id: "l29-q05", revision: 1, k: "reflect", q: "LOOで候補Aより候補Bの予測性能が良好でした。「基礎得点を加えることが反応時間を変えた」と書けるか説明してください。", minLength: 70, rubric: ["LOOが予測性能の比較であると述べている", "予測子を加える行為と因果介入を区別している", "因果主張には設計または追加仮定が必要と述べている"], example: "書けない。LOOは基礎得点を含む候補が未見データをよりよく予測したことを示すにとどまる。基礎得点を操作する因果効果には、交絡や時間順序を扱う設計・仮定が別に必要である。" },
  ],
  practice: { title: "成果物チェック", intro: "三つの検査を別の証拠として残し、何が分かるかも一緒に書きます。", items: [
    { id: "diagnostic-note", label: "計算診断メモ", criterion: "R-hat、ESS、divergenceの確認結果と、問題があった場合の次の行動を書く" },
    { id: "ppc-plan", label: "研究質問に対応するPPC", criterion: "条件別の中心または事前に決めた分布形のどちらを問うかを選び、一問に一図で観測値と複製値を比べる" },
    { id: "comparison-note", label: "予測比較メモ", criterion: "同じデータ・観測単位・予測課題を明記し、LOO差、Pareto k、限界を記録する" },
  ] },
  practiceLadder: { title: "4段階の反復練習", intro: "今回くり返す技能は「計算・再現・比較の証拠を混ぜないこと」です。各段階は、実際にRで確かめてからチェックしてください。", steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "一つのfitで`summary()`、`nuts_params()`、条件別PPCを順に確認します。", criterion: "三つが答える問いを別々に説明できたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "PPCの統計量を中央値から90%分位点へ一つだけ替えます。", criterion: "変えた特徴と、変えなかった予測課題を記録できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "二候補を同じデータでfitし、診断、PPC、LOOまでを書きます。", criterion: "比較前にデータと観測単位がそろっているか確認できたら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "一人20試行の反復測定で、新参加者を予測する評価単位を設計します。", criterion: "試行を外す評価と参加者を外す評価が別の問いだと説明できたら完了です。" },
  ] },
  challenge: { title: "比較表を設計する", scenario: "二つの反応時間モデルを比較し、研究チームへ推薦を出す必要があります。", task: "計算診断、条件別中央値、遅い反応の割合、LOO、Pareto kを一枚の比較表へ置き、推薦に必要な判断文を書いてください。", hints: ["表の各行に『何を問う証拠か』を添えます。", "PPCの特徴は研究質問から選びます。", "順位だけで推薦せず、再現できない特徴も書きます。"], rubric: ["三種類の証拠が混ざらずに整理されている", "PPCの統計量が研究上の意味を持つ", "因果・真実性への過剰な結論を避けている"], example: "候補Bを予測の出発点として推薦するが、LOO差の不確実性と遅い反応のPPC失敗を併記する。Bが真のモデル、または条件の因果効果を示すとは書かない。" },
};
