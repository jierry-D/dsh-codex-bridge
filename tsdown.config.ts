import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { client: 'client/index.tsx' },
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  dts: false,
  sourcemap: false,
  clean: false,
  outDir: 'lib',
  external: ['react', 'react/jsx-runtime'],
  noExternal: (source: string) => source === 'react' || source === 'react/jsx-runtime' ? undefined : true,
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-codex-bridge", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
