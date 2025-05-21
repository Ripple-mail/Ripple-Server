import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    { files: ['**/*.{js,mjs,cjs,ts}'], plugins: { js }, extends: ['js/recommended'], rules: { 'camelCase': 'error' } },
    { files: ['**/*.{js,mjs,cjs,ts}'], languageOptions: { globals: {...globals.browser, ...globals.node} }, rules: { 'camelCase': 'error'} },
    tseslint.configs.recommended,
]);