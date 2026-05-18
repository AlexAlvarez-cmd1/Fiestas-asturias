export default {
  expo: {
    name: 'Folixa',
    slug: 'folixa',
    scheme: 'folixa',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#166534',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.ansiw.fiestasasturias',
    },
    web: {
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      '@react-native-community/datetimepicker',
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#ffffff',
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
    },
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
    extra: {
      eas: {
        projectId: '310ea453-fdb7-416c-8a43-96f450311479',
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
  },
};
