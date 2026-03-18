import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crmcelular.app',
  appName: 'SGI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
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
