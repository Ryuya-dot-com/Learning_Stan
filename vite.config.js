import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base はリポジトリ名と完全一致させる（大文字・アンダースコア含む）。
// 誤ると GitHub Pages で真っ白になる。dev サーバもこの base 配下で配信するため
// (http://localhost:5173/Learning_Stan/ で開く。ルートは302で転送される)、
// パスの誤りは dev でも preview でも同じように現れる。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  oxc: { jsx: { runtime: "automatic" } },
  base: "/Learning_Stan/",
});
