import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crmcelular.app',
  appName: 'CRM Celular',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Em produção: NÃO definir 'url' — carrega do bundle local
    // Em dev com live reload: apontar para o servidor de dev
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#135bec'
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#135bec'
    }
  }
};

export default config;
