// トークナイザの言語別挙動を保証する。
// R と Stan では識別子の文字範囲・コメント記号・クォートの意味が異なる。
import { describe, it, expect } from "vitest";
import { tokenizeLine } from "./highlight.js";

const kinds = (line, lang) => tokenizeLine(line, lang).map((t) => t[0]);
const texts = (line, lang) => tokenizeLine(line, lang).map((t) => t[1]);
const rejoin = (line, lang) => texts(line, lang).join("");

describe("共通の不変条件", () => {
  it.each([
    ["x <- 10", "R"],
    ["mean(d$rt, na.rm = TRUE)  # 平均", "R"],
    ["real<lower=0> sigma;", "Stan"],
    ["y ~ normal(alpha + beta * x, sigma);  // 尤度", "Stan"],
    ["install.packages(\"tidyverse\")", "ターミナル"],
  ])("%s (%s): トークンを連結すると元の行に戻る", (line, lang) => {
    expect(rejoin(line, lang)).toBe(line);
  });
});

describe("R", () => {
  it("既定の言語は R（lang 省略時）", () => {
    expect(kinds("TRUE")).toEqual(["kw"]);
  });

  it("ドットを含む関数名が1つの識別子になる", () => {
    expect(texts("t.test(a, b)", "R")[0]).toBe("t.test");
  });

  it("引数名のドットも識別子の一部になる", () => {
    expect(texts("mean(x, na.rm = TRUE)", "R")).toContain("na.rm");
  });

  it("TRUE / FALSE / NA / NULL はキーワード", () => {
    for (const w of ["TRUE", "FALSE", "NA", "NULL"]) {
      expect(kinds(w, "R"), `${w} がキーワードでない`).toEqual(["kw"]);
    }
  });

  it("# 以降はコメント", () => {
    const t = tokenizeLine("x <- 1  # メモ", "R");
    expect(t[t.length - 1]).toEqual(["com", "# メモ"]);
  });

  it("シングルクォートも文字列", () => {
    expect(kinds("'abc'", "R")).toEqual(["str"]);
  });

  it("数値は num", () => {
    expect(tokenizeLine("543.2", "R")).toEqual([["num", "543.2"]]);
  });

  it("function はキーワード", () => {
    expect(kinds("function", "R")).toEqual(["kw"]);
  });
});

describe("Stan", () => {
  it("// 以降はコメント", () => {
    const t = tokenizeLine("alpha ~ normal(0, 5);  // 事前分布", "Stan");
    expect(t[t.length - 1]).toEqual(["com", "// 事前分布"]);
  });

  it("# はコメントではない（Stan では無効な記号）", () => {
    expect(kinds("# x", "Stan")).not.toContain("com");
  });

  it("ブロック名と型はキーワード", () => {
    for (const w of ["data", "parameters", "model", "real", "int", "vector", "lower"]) {
      expect(kinds(w, "Stan"), `${w} がキーワードでない`).toEqual(["kw"]);
    }
  });

  it("ドットは識別子に含まれない", () => {
    expect(texts("a.b", "Stan")[0]).toBe("a");
  });

  it("シングルクォートは文字列にしない（転置演算子のため）", () => {
    expect(kinds("x' * y", "Stan")).not.toContain("str");
  });
});

describe("プレーン（ターミナルなど）", () => {
  it("キーワード着色をしない", () => {
    expect(kinds("data", "ターミナル")).toEqual(["id"]);
  });
});
