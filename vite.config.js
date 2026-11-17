import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function patchResponse(res) {
  if (!res.status) {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function (obj) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(obj));
      return this;
    };
  }
}

function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/api/generate-quiz') {
          try {
            const { default: handler } = await import('./api/generate-quiz.js');
            patchResponse(res);
            await handler(req, res);
          } catch (err) {
            console.error('[API Dev] Error in /api/generate-quiz:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: err.message }));
          }
          return;
        }
        if (url === '/api/quota') {
          try {
            const { default: handler } = await import('./api/quota.js');
            patchResponse(res);
            await handler(req, res);
          } catch (err) {
            console.error('[API Dev] Error in /api/quota:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: err.message }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
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
