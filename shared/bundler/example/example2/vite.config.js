import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      // 브라우저 환경에서 Node.js 전용 모듈(예: crypto, buffer, stream)을 사용할 수 있도록 "대체(폴리필)" 해주는 기능
      // 코드를 분석해서 실제로 사용하는 것만 polyfill 추가
      // 방법 1: 특정 것만
      // globals: {
      //   Buffer: true
      // }
      // 방법 2: 모든 polyfill 자동 적용!
      // (Buffer, process, crypto 등 전부)
    }),
  ],
  build: {
    lib: {
      entry: "./main.js", // 시작 파일
      name: "MyBundle",
      fileName: "bundle", // 파일 이름
      formats: ["iife"], // 브라우저용 --> bundle.life.js
    },
  },
});
