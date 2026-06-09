import nx from '@nx/eslint-plugin';
import baseConfig from '../../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'tommy',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'tommy',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // Structural directives (FlowStep, FlowIntro, FlowReceipt) use bare camelCase
    // attribute selectors (no prefix) following Angular's own ngIf/ngFor convention,
    // and must alias inputs so the attribute name matches the input name.
    files: ['**/engine/flow-step.ts', '**/engine/flow-slots.ts'],
    rules: {
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/no-input-rename': 'off',
      // The ngTemplateContextGuard `_ctx` param is used only in its type predicate,
      // which tseslint counts as unused — honour the leading-underscore convention.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
