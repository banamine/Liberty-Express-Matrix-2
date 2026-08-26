import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, './shared'),
        '@assets': path.resolve(__dirname, './assets'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR === 'true' ? false : { clientPort: 443 },
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/pgdata/**']
      },
    },
  };
});
