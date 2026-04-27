import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

const cocosIgnores = [
  'library/**',
  'temp/**',
  'local/**',
  'build/**',
  'profiles/**',
  'node_modules/**',
  'eslint.config.mjs',
];

/**
 * Cocos compiles from assets; other dirs are build/cache. Ignore them so
 * we only need temp/tsconfig for editor hints, not for ESLint's view of the tree.
 */
export default tseslint.config(
  { ignores: cocosIgnores },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier
);
