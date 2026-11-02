import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // DTO mappers in the server layer take Prisma payloads of many shapes (include/select
    // variants); they cast each field explicitly instead of naming every payload type.
    files: ["src/server/**/*.ts", "prisma/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".uploads/**"]),
]);
