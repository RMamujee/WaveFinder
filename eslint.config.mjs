import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Disallow stray console.log; allow console.warn/console.error everywhere.
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // The monitoring helper, scripts, and the Prisma seed script intentionally
  // use all console methods (CLI/dev tooling, not application source).
  {
    files: ["lib/monitoring.ts", "scripts/**", "prisma/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
