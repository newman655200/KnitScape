import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";

export default defineConfig({
  base: "./",
  define: {
    // Code Guide opens the checkout used by this local dev server/build.
    "import.meta.env.CODE_GUIDE_ROOT": JSON.stringify(
      normalizePath(fileURLToPath(new URL(".", import.meta.url))).replace(/\/$/, "")
    ),
  },
});
