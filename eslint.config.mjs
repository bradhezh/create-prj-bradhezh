import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";

const rules = {
  eqeqeq: "warn",
  "no-cond-assign": ["error", "always"],
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

export default defineConfig([
  {
    files: ["*.{js,mjs,ts}"],
    extends: [js.configs.recommended, ts.configs.recommended],
    languageOptions: { globals: globals.node },
    rules,
  },
  {
    files: ["src/**/*.ts"],
    extends: [js.configs.recommended, ...ts.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules,
  },
]);
