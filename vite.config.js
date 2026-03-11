import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: true, // Permite acesso via IP e domínios do hosts
        allowedHosts: true, // Permite qualquer host no ambiente de dev
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/uploads': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        },
        watch: {
            ignored: ['**/server/**', '**/dev.db', '**/dev.db-journal']
        }
    }
});
