import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const ignores = [
  ".next/**",
  "node_modules/**",
  "next-env.d.ts",
  "src/test/e2e/**",
  "src/types.d.ts",
];

const config = [
  { ignores },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;