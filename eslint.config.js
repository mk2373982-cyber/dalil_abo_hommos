import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tseslint from 'typescript-eslint';

const [tsBase, tsEslintRecommended, tsRecommended] = tseslint.configs.recommended;

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'public/**/*'],
  },
  // TypeScript linting for app sources (parser + recommended rules).
  // Scoped to src/** so the TS parser never touches firestore.rules.
  {
    name: 'typescript-eslint/src',
    ...tsBase,
    ...tsEslintRecommended,
    ...tsRecommended,
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
