var _a;
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
var allowedHosts = ((_a = process.env.VITE_ALLOWED_HOSTS) !== null && _a !== void 0 ? _a : 'localhost,127.0.0.1')
    .split(',')
    .map(function (value) { return value.trim(); })
    .filter(Boolean);
export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: allowedHosts
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        css: true
    }
});
