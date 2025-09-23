import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills(), // Buffer 등 자동 처리
  ],
  build: {
    lib: {
      entry: "./main.js",
      name: "MyBundle", // 이 이름이 전역 변수가 됨
      fileName: "bundle",
      formats: ["iife"],
    },
  },
});
