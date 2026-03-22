import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: true, // Permite acesso via IP e domínios do hosts
        allowedHosts: true, // Permite qualquer host no ambiente de dev
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        // Preserva o host original para resolução multi-tenant no servidor
                        proxyReq.setHeader('x-forwarded-host', req.headers.host || '');
                    });
                }
            },
            '/uploads': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        proxyReq.setHeader('x-forwarded-host', req.headers.host || '');
                    });
                }
            }
        },
        watch: {
            ignored: ['**/server/**', '**/dev.db', '**/dev.db-journal']
        }
    }
});
