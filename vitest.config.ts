import {defineConfig} from 'vitest/config';

export default defineConfig({
    // Solid Router ships browser and server builds; tests need the browser one.
    resolve: {
        conditions: ['module', 'browser', 'development'],
        alias: {
            'solid-js/web': 'solid-js/web/dist/web.js',
        },
    },
    ssr: {
        resolve: {
            conditions: ['module', 'browser', 'development'],
        },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts'],
            thresholds: {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100,
            },
        },
        server: {
            deps: {
                inline: [/@solidjs\/router/, /solid-js/],
            },
        },
    },
});
