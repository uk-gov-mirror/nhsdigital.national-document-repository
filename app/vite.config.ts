import { defineConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
// @ts-ignore - Type issues with vite-plugin-eslint exports
import eslint from 'vite-plugin-eslint';
import { IncomingMessage, ServerResponse } from 'http';

// Custom plugin to handle SPA fallback to main.html
const spaFallbackPlugin = (): PluginOption => {
    const fallbackMiddleware = (req: IncomingMessage, _: ServerResponse, next: Function): void => {
        // Only handle GET requests that look like routes (not files)
        if (
            req.method === 'GET' &&
            req.url &&
            !req.url.startsWith('/assets/') &&
            !req.url.startsWith('/src/') &&
            !req.url.startsWith('/@') &&
            !req.url.includes('.') &&
            req.url !== '/main.html' &&
            req.headers.accept?.includes('text/html')
        ) {
            req.url = '/main.html';
        }
        next();
    };

    return {
        name: 'spa-fallback-main-html',
        configureServer(server: any): void {
            server.middlewares.use(fallbackMiddleware);
        },
        configurePreviewServer(server: any): void {
            server.middlewares.use(fallbackMiddleware);
        },
    };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    base: '/',
    plugins: [
        react(),
        svgr({
            svgrOptions: { exportType: 'named', ref: true, svgo: false, titleProp: true },
            include: '**/*.svg',
        }),
        eslint(),
        spaFallbackPlugin(),
    ],
    preview: {
        port: 3000,
        host: true,
    },
    build: {
        chunkSizeWarningLimit: 1024,
        rolldownOptions: {
            input: './main.html',
        },
        sourcemap: mode === 'development',
    },
}));
