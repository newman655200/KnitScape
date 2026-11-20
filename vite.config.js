import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";

export default defineConfig(({ command }) => ({
  base: "./",
  build: { rollupOptions: { input: { editor: "index.html", swatch: "swatch.html" } } },
  define: {
    // Code Guide opens the checkout used by the local dev server.
    // Only the dev server gets the real path; production builds (web/Electron
    // installer) must not embed the developer's local folder path.
    "import.meta.env.CODE_GUIDE_ROOT": JSON.stringify(
      command === "serve"
        ? normalizePath(fileURLToPath(new URL(".", import.meta.url))).replace(/\/$/, "")
        : ""
    ),
  },
}));
