module.exports = {
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
    'no-console': ['warn', { 
      allow: ['warn', 'error', 'info', 'debug'] 
    }],
    'react-hooks/exhaustive-deps': 'warn',
    'no-case-declarations': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
  ],
};
