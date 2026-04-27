import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
    "exact/index": "src/exact/index.ts",
    "exact/client/index": "src/exact/client/index.ts",
    "exact/server/index": "src/exact/server/index.ts",
    "exact/facilitator/index": "src/exact/facilitator/index.ts",
    "exact/v1/index": "src/exact/v1/index.ts",
    "exact/v1/client/index": "src/exact/v1/client/index.ts",
    "exact/v1/facilitator/index": "src/exact/v1/facilitator/index.ts",
    "client/index": "src/client/index.ts",
    "client/exact/index": "src/client/exact/index.ts",
    "server/index": "src/server/index.ts",
    "server/exact/index": "src/server/exact/index.ts",
    "facilitator/index": "src/facilitator/index.ts",
    "facilitator/exact/index": "src/facilitator/exact/index.ts",
    "protocol/index": "src/protocol/index.ts",
    "protocol/schemes/index": "src/protocol/schemes/index.ts",
    "protocol/schemes/exact/index": "src/protocol/schemes/exact/index.ts",
    "siwx/index": "src/siwx/index.ts",
    "v1/index": "src/v1/index.ts",
    "v1/exact/index": "src/v1/exact/index.ts",
    "v1/exact/client/index": "src/v1/exact/client/index.ts",
    "v1/exact/facilitator/index": "src/v1/exact/facilitator/index.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "es2020",
};

export default defineConfig([
  {
    ...baseConfig,
    format: "esm",
    outDir: "dist/esm",
    clean: true,
  },
  {
    ...baseConfig,
    format: "cjs",
    outDir: "dist/cjs",
    clean: false,
  },
]);
