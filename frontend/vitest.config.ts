import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environmentMatchGlobs: [["src/test/**/*.dom.test.ts?(x)", "jsdom"]],
    setupFiles: [path.resolve(dirname, "src/test/setup.ts")],
    exclude: ["src/test/e2e/**", "node_modules/**", "dist/**", ".next/**"],
  },
});
