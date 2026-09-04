import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // ── F1 分层边界（2026-09-03，全栈架构 §6）────────────────────────────
  // UI 层禁止 import lib/server/**（服务端专属）。
  // 通信通道仅三条：RSC props（读）/ /api/* + SWR（读写）/ Server Actions（写）；
  // 跨边界类型契约放 lib/shared/**（允许）。
  {
    files: [
      "components/**/*.{ts,tsx}",
      "hooks/**/*.ts",
      "stores/**/*.ts",
      "lib/kernel/**/*.{ts,tsx}",
      "lib/ui/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/server",
                "@/lib/server/*",
                "../lib/server/*",
                "../../lib/server/*",
                "../../../lib/server/*",
              ],
              message:
                "F1 边界：UI 层禁止 import lib/server（服务端专属）。请经 RSC props / /api/* / Server Actions 获取能力，跨边界类型放 lib/shared。",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Temp / scratch files
    ".remember/tmp/**",
    // Vendored third-party code (Cordis 4.0 / cosmokit / standard-schema)
    "src/kernel/vendor/**",
  ]),
]);

export default eslintConfig;
