import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";

const rules = {
  eqeqeq: "warn",
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-floating-promises": "off",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
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
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules,
  },
]);
