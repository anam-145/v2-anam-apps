import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills()],

  build: {
    lib: {
      entry: "./main.js",
      name: "MyBundle",
      // 일반적인 관례: format 뒤에 .min
      fileName: (format) => `bundle.${format}.min.js`,
      formats: ["iife"],
    },

    minify: "terser", // JS 코드를 압축 및 최적화 (공백 제거, 변수 축소 등)

    // console.log 제거 설정, 개발중에 디버그 할때 false 두면 됨
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },

    // 출력 디렉토리
    outDir: "dist",

    // 기존 파일 정리
    emptyOutDir: true,
  },
});
