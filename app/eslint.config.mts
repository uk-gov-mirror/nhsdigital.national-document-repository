import eslintReact from '@eslint-react/eslint-plugin';
import { ESLint } from 'eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginCypress from 'eslint-plugin-cypress';
import pluginImport from 'eslint-plugin-import';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';


export default defineConfig([
    tseslint.configs.recommended,
    pluginJsxA11y.flatConfigs.recommended,
    eslintConfigPrettier,
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        ignores: [
            'eslint.config.mts',
            'react-build-env-checker.js',
            'vite-env.d.ts',
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
        ],
        extends: [
            pluginCypress.configs.recommended, 
            eslintReact.configs['recommended-typescript'],
            testingLibrary.configs['flat/dom'],
            testingLibrary.configs['flat/react'],
        ],
        plugins: {
            import: pluginImport,
            prettier: pluginPrettier,
            '@typescript-eslint': tseslint.plugin,
            'unused-imports': pluginUnusedImports,
            'react-hooks': pluginReactHooks as ESLint.Plugin,
        },
        languageOptions: {
            ecmaVersion: 2020,
            parser: tseslint.parser,
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.es2020,
                ...globals.node,
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // eslint-react rules
            '@eslint-react/no-missing-key': 'off',
            '@eslint-react/no-nested-component-definitions': 'off',
            '@eslint-react/purity': 'off',
            '@eslint-react/no-context-provider': 'off',
            '@eslint-react/use-state': 'off',
            '@eslint-react/component-hook-factories': 'off',
            '@eslint-react/web-api-no-leaked-timeout': 'off',
            '@eslint-react/no-forward-ref': 'off',
            '@eslint-react/no-array-index-key': 'off',
            '@eslint-react/exhaustive-deps': 'off', // 36
            '@eslint-react/set-state-in-effect': 'off', // 31
            '@eslint-react/naming-convention-ref-name': 'off',
            '@eslint-react/no-children-to-array': 'off',
            '@eslint-react/web-api-no-leaked-event-listener': 'off',
            '@eslint-react/no-unnecessary-use-prefix': 'off',
            '@eslint-react/no-use-context': 'off',

            '@eslint-react/jsx-no-leaked-semicolon': 'off',

            'prefer-const': 'off',
            'no-var': 'off',
            'cypress/no-unnecessary-waiting': 'warn',
            'object-curly-spacing': ['warn', 'always'],

            // typescript-eslint rules
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'none',
                },
            ],
            '@typescript-eslint/no-explicit-any': [
                'off',
                {
                    ignoreRestArgs: true,
                },
            ],
            'max-len': [
                'warn',
                {
                    code: 100,
                    tabWidth: 4,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreComments: true,
                },
            ],
            'no-plusplus': [
                'error',
                {
                    allowForLoopAfterthoughts: true,
                },
            ],
            'import/no-extraneous-dependencies': [
                'error',
                {
                    devDependencies: [
                        '**/*.test.js',
                        '**/*.test.jsx',
                        '**/*.test.ts',
                        '**/*.test.tsx',
                        'src/tests/**/*',
                        '**/cypress/**',
                        '**/cypress.config.ts',
                    ],
                },
            ],
            'react/jsx-props-no-spreading': 'off',
            'import/prefer-default-export': 'off',
            'react/jsx-boolean-value': 'off',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            'react/jsx-one-expression-per-line': 'off',
            'react/jsx-wrap-multilines': 'off',
            'react/destructuring-assignment': 'off',
            'no-console': 'warn',
            'prettier/prettier': 'error',
            'react-hooks/exhaustive-deps': 'off',
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],
            'unused-imports/no-unused-imports': 'error',
        },
    },
    {
        files: ['**/*.test.tsx', '**/*.test.ts'],
        extends: [
            pluginCypress.configs.recommended, 
            eslintReact.configs['recommended-typescript'],
            testingLibrary.configs['flat/dom'],
            testingLibrary.configs['flat/react'],
        ],
        plugins: {
            import: pluginImport,
            prettier: pluginPrettier,
            '@typescript-eslint': tseslint.plugin,
            'unused-imports': pluginUnusedImports,
            'react-hooks': pluginReactHooks as ESLint.Plugin,
        },
        rules: {
            'jsx-a11y/anchor-has-content': 'off',
            'jsx-a11y/no-redundant-roles': 'off',
            'no-throw-literal': 'off',
            'max-len': 'off',
            'prefer-const': 'off',
            'no-var': 'off',

            // testing-library rules
            'testing-library/prefer-screen-queries': 'off',
            'testing-library/no-node-access': 'off', // 123
            'testing-library/no-unnecessary-act': 'off', // 59
            'testing-library/no-container': 'off',
            'testing-library/await-async-events': 'off', // 16
            'testing-library/render-result-naming-convention': 'off',
            'testing-library/no-wait-for-multiple-assertions': 'off',
            'testing-library/prefer-presence-queries': 'off',
            'testing-library/no-render-in-lifecycle': 'off',
            'testing-library/await-async-utils': 'off',
            'testing-library/no-wait-for-side-effects': 'off',

            // eslint-react rules
            '@eslint-react/purity': 'off',
            '@eslint-react/use-state': 'off',
            '@eslint-react/jsx-no-leaked-semicolon': 'off',
            '@eslint-react/component-hook-factories': 'off',

            // typescript-eslint rules
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off', 
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],

            // disable jsx-a11y rules on test files.
            ...Object.fromEntries(              
                Object.keys(pluginJsxA11y.rules!).map((ruleName) => [`jsx-a11y/${ruleName}`, 'off'])
            ),
        },
    },
    {
        files: ['cypress/**/*.{ts,js}'],
        rules: {
            'import/no-extraneous-dependencies': [
                'error',
                {
                    devDependencies: true,
                },
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    {
        files: ['src/vite-env.d.ts'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        files: ['src/main.tsx'],
        rules: {
            '@typescript-eslint/no-namespace': 'off',
        },
    },
    {
        files: ['react-build-env-checker.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    }
]);
