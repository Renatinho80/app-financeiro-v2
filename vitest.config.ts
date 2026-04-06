import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Ambiente de testes — jsdom para código que usa APIs do browser
    environment: "jsdom",
    // Inclui apenas os testes de segurança (evita puxar outros)
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
    // Exclui node_modules
    exclude: ["node_modules/**"],
    // Timeout conservador — testes de segurança devem ser rápidos
    testTimeout: 5000,
    // Reporter compacto no CI, verboso localmente
    reporters: process.env.CI ? ["junit"] : ["verbose"],
    outputFile: process.env.CI ? { junit: "test-results/security.xml" } : undefined,
    // Cobertura apenas das libs de segurança
    coverage: {
      provider: "v8",
      include: ["src/lib/security/**", "src/lib/validations/**"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
      thresholds: {
        // Exige cobertura alta nas libs de segurança
        lines: 85,
        functions: 85,
        branches: 80,
      },
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
