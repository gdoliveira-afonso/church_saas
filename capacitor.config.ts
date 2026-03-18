import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crmcelular.app',
  appName: 'CRM Celular',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://cel.familiapaz1.com.br',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#135bec'
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#135bec',
      overlaysWebView: false
    }
  }
};

export default config;
