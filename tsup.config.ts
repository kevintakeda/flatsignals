import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  treeshake: true,
  clean: true,
  bundle: true,
  target: "esnext"
});