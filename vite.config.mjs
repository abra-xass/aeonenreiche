import { defineConfig } from 'vite';

export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2022',
    lib: {
      entry: 'graphics/main.tsx',
      formats: ['es'],
      fileName: () => 'graphics.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
