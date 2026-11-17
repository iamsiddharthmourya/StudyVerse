import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) {
              return 'vendor-firebase';
            }
            if (/[\\/]node_modules[\\/](recharts|recharts-scale|victory-vendor|react-smooth)[\\/]/.test(id)) {
              return 'vendor-charts';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
