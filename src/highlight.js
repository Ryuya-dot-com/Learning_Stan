/* ---------------- R / Stan コードの簡易ハイライト ---------------- */
// 言語ごとに「キーワード集合・コメント記号・識別子の文字範囲・クォートの意味」が異なる。
// 行単位のトークナイザなので、複数行にまたがるブロックコメント(/* */)は扱わない。

const KW_R = new Set([
  "function", "if", "else", "for", "while", "repeat", "break", "next", "return",
  "in", "TRUE", "FALSE", "NA", "NULL", "Inf", "NaN", "library", "require",
]);

const KW_STAN = new Set([
  "functions", "data", "transformed", "parameters", "model", "generated", "quantities",
  "real", "int", "vector", "row_vector", "matrix", "array", "complex",
  "simplex", "ordered", "positive_ordered", "unit_vector",
  "corr_matrix", "cov_matrix", "cholesky_factor_corr", "cholesky_factor_cov",
  "lower", "upper", "offset", "multiplier",
  "for", "in", "if", "else", "while", "break", "continue", "return", "print", "target",
]);

// 言語仕様の差分。lang が未知のときは PLAIN（キーワード着色なし）
const SPEC = {
  R:     { kw: KW_R,    line: ["#"],  ident: /[A-Za-z0-9._]/, quotes: ['"', "'"] },
  Stan:  { kw: KW_STAN, line: ["//"], ident: /[A-Za-z0-9_]/,  quotes: ['"'] },
  PLAIN: { kw: new Set(), line: [],   ident: /[A-Za-z0-9._]/, quotes: ['"'] },
};

function specOf(lang) {
  if (lang == null || lang === "R") return SPEC.R;
  if (lang === "Stan") return SPEC.Stan;
  return SPEC.PLAIN;
}

function tokenizeLine(line, lang) {
  const sp = specOf(lang);
  const toks = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    // 行コメント（記号は言語ごと。以降は行末まで）
    const cm = sp.line.find((c) => line.startsWith(c, i));
    if (cm) {
      toks.push(["com", line.slice(i)]);
      break;
    }

    // 文字列（エスケープを飛ばしながら閉じクォートを探す）
    if (sp.quotes.includes(ch)) {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === "\\" ? 2 : 1;
      toks.push(["str", line.slice(i, Math.min(j + 1, line.length))]);
      i = j + 1;
      continue;
    }

    // 数値（識別子より先に判定する。先頭が数字のときだけ）
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9.eE]/.test(line[j])) j++;
      toks.push(["num", line.slice(i, j)]);
      i = j;
      continue;
    }

    // 識別子・キーワード（先頭は英字かアンダースコア。日本語は識別子に含めない）
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < line.length && sp.ident.test(line[j])) j++;
      const w = line.slice(i, j);
      toks.push([sp.kw.has(w) ? "kw" : "id", w]);
      i = j;
      continue;
    }

    toks.push(["op", ch]);
    i++;
  }
  return toks;
}

const TOK_COLOR = {
  kw: { color: "#C792EA", fontWeight: 600 },
  str: { color: "#A8D8A0" },
  com: { color: "#8F86A3", fontStyle: "italic" }, // night 背景上 4.5:1 以上
  num: { color: "#8AB4F8" },
  id: { color: "#ECEAF2" },
  op: { color: "#B8B2C8" },
};

// 日本語を含まない文字列＝コードとみなす（選択肢を等幅フォントで表示するため）
const isCodey = (s) => !/[぀-ヿ一-鿿]/.test(s);

export { KW_R, KW_STAN, tokenizeLine, TOK_COLOR, isCodey };
