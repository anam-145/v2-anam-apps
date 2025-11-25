import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      vm: resolve(__dirname, 'shims/vm.js'),
    },
  },
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'stellarSDK',
      formats: ['iife'],
      fileName: () => 'stellar-bundle.iife.js',
    },
    // CommonJS/ESM 상호 운용성 개선
    commonjsOptions: {
      requireReturnsDefault: 'auto',
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [],
      output: {
        // default export를 전역 변수로 직접 노출
        exports: 'default',
        // CommonJS 상호 운용성
        interop: 'auto',
        globals: {},
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  define: {
    'process.env': {},
  },
});
