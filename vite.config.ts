import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Check if running in Tauri mode
    const isTauri = process.env.TAURI === 'true';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: true,
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Add Tauri flag
        '__TAURI__': JSON.stringify(isTauri),
        '__TAURI_IPC__': JSON.stringify(isTauri),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Tauri expects clearScreen: true for proper reloading
      clearScreen: false,
    };
});
