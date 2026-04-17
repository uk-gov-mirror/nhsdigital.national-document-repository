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
            '@eslint-react/no-missing-key': 'off', // 1
            '@eslint-react/no-nested-component-definitions': 'off', // 4
            '@eslint-react/purity': 'off', // 7
            '@eslint-react/no-context-provider': 'off', // 8
            '@eslint-react/use-state': 'off', // 7
            '@eslint-react/component-hook-factories': 'off', // 10
            '@eslint-react/web-api-no-leaked-timeout': 'off', // 3
            '@eslint-react/no-forward-ref': 'off', // 3
            '@eslint-react/no-array-index-key': 'off', // 2
            '@eslint-react/exhaustive-deps': 'off', // 36
            '@eslint-react/set-state-in-effect': 'off', // 31
            '@eslint-react/naming-convention-ref-name': 'off', // 16
            '@eslint-react/no-children-to-array': 'off', // 1
            '@eslint-react/web-api-no-leaked-event-listener': 'off', // 1
            '@eslint-react/no-unnecessary-use-prefix': 'off', // 1
            '@eslint-react/no-use-context': 'off', // 6

            '@eslint-react/jsx-no-leaked-semicolon': 'off', // 1

            'prefer-const': 'off', // 12
            'no-var': 'off', // 1

            // typescript-eslint rules
            '@typescript-eslint/no-unused-expressions': 'off', // 1
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'off', // 6
            '@typescript-eslint/ban-ts-comment': 'off', // 6
            '@typescript-eslint/no-unsafe-function-type': 'off', // 0
            
            '@typescript-eslint/no-explicit-any': [ // 141
                'off',
                {
                    ignoreRestArgs: true,
                },
            ],
            
            'import/prefer-default-export': 'off', // 20
            'react/jsx-props-no-spreading': 'off',
            'react/jsx-boolean-value': 'off',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            'react/jsx-one-expression-per-line': 'off',
            'react/jsx-wrap-multilines': 'off',
            'react/destructuring-assignment': 'off',
            'react-hooks/exhaustive-deps': 'off', // 39
            
            // general rules
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],
            'no-console': 'warn',
            'prettier/prettier': 'error',


            'unused-imports/no-unused-imports': 'error',
            'cypress/no-unnecessary-waiting': 'warn',
            'object-curly-spacing': ['warn', 'always'],

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
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'none',
                },
            ],
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
            'jsx-a11y/anchor-has-content': 'off', // 19
            'jsx-a11y/no-redundant-roles': 'off', // 2
            'no-throw-literal': 'off', // 2
            'prefer-const': 'off', // 12
            'no-var': 'off', // 1

            // testing-library rules
            'testing-library/prefer-screen-queries': 'off', // 1
            'testing-library/no-node-access': 'off', // 123
            'testing-library/no-unnecessary-act': 'off', // 59
            'testing-library/no-container': 'off', // 36
            'testing-library/await-async-events': 'off', // 16
            'testing-library/render-result-naming-convention': 'off', // 15
            'testing-library/no-wait-for-multiple-assertions': 'off', // 4
            'testing-library/prefer-presence-queries': 'off', // 3
            'testing-library/no-render-in-lifecycle': 'off', // 1
            'testing-library/await-async-utils': 'off', // 1
            'testing-library/no-wait-for-side-effects': 'off', // 10

            // eslint-react rules
            '@eslint-react/purity': 'off', // 7
            '@eslint-react/use-state': 'off', // 7
            '@eslint-react/jsx-no-leaked-semicolon': 'off', // 1
            '@eslint-react/component-hook-factories': 'off', // 10

            // typescript-eslint rules
            '@typescript-eslint/ban-ts-comment': 'off', // 6
            '@typescript-eslint/no-unsafe-function-type': 'off', // 0
            '@typescript-eslint/no-unused-vars': 'off', // 13
            '@typescript-eslint/no-explicit-any': 'off', // 141
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],

            'max-len': [
                'off', // 10
                {
                    code: 100,
                    tabWidth: 4,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreComments: true,
                },
            ],

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
            '@typescript-eslint/explicit-function-return-type': 'off', // 0
        },
    },
    {
        files: ['src/vite-env.d.ts'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off', // 1
        },
    },
    {
        files: ['src/main.tsx'],
        rules: {
            '@typescript-eslint/no-namespace': 'off', // 1
        },
    },
    {
        files: ['react-build-env-checker.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off', // 1
        },
    }
]);
