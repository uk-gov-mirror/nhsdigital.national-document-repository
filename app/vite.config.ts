import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import commonjs from 'vite-plugin-commonjs';
// @ts-ignore - Type issues with vite-plugin-eslint exports
import eslint from 'vite-plugin-eslint';

// Custom plugin to handle SPA fallback to main.html
const spaFallbackPlugin = () => {
    const fallbackMiddleware = (req: any, res: any, next: any) => {
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
        configureServer(server: any) {
            server.middlewares.use(fallbackMiddleware);
        },
        configurePreviewServer(server: any) {
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
        commonjs({
            dynamic: {
                onFiles: (files) => files.filter((f) => f !== 'viewer.html'),
            },
        }),
        eslint(),
        spaFallbackPlugin(),
    ],
    preview: {
        port: 3000,
        host: true,
    },
    build: {
        commonjsOptions: { transformMixedEsModules: true },
        chunkSizeWarningLimit: 1024,
        rollupOptions: {
            input: './main.html',
        },
        sourcemap: mode === 'development',
    },
}));
