import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills()],
  build: {
    lib: {
      entry: "./main.js",
      name: "MyBundle",
      fileName: (format) => `solana-bundle.${format}.min.js`,
      formats: ["iife"],
    },
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    minify: "terser",
    outDir: "dist",
    emptyOutDir: true,
  },
});
