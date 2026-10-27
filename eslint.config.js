import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// El motor y la config son TS puro (AGENTS.md §3): sin React, DOM ni librerías de render.
const PURE_TS_IMPORTS = {
  patterns: [
    {
      group: ['react', 'react-*', 'react/*', 'pixi.js', 'pixi.js/*', 'i18next'],
      message: 'El motor y la config no pueden depender de React, Pixi ni i18n.',
    },
    {
      group: ['**/render/**', '**/app/**', '**/input/**'],
      message: 'El motor no lee el render, la UI ni la entrada.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'sim.js', 'make-manifest.mjs', 'atomic-ash-proto.html', 'assets'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['src/engine/**/*.ts', 'src/config/**/*.ts'],
    languageOptions: { globals: {} },
    rules: { 'no-restricted-imports': ['error', PURE_TS_IMPORTS] },
  },
  {
    files: ['tools/**/*.ts', 'tests/**/*.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
);
