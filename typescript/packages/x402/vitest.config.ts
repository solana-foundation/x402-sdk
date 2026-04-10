import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/test/integrations/**", // Exclude integration tests from default run
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
      thresholds: {
        lines: 95,
      },
    },
  },
  plugins: [tsconfigPaths({ projects: ["."] })],
}));
