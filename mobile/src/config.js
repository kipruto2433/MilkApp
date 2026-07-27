import { Platform } from 'react-native';

const localBaseURL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
// Render substitutes EXPO_PUBLIC_* values when the web bundle is built. Keep the
// deployed API as a fallback so an older Render frontend deployment can connect
// even if its environment variable was not added before the build.
const hostedApiURL = 'https://milkapp-qn3a.onrender.com';
const isHostedWeb = Platform.OS === 'web'
  && typeof window !== 'undefined'
  && !['localhost', '127.0.0.1'].includes(window.location.hostname);
const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || (isHostedWeb ? hostedApiURL : localBaseURL);

export const API_BASE_URL = baseURL;
export const isHostedWebWithoutApi = false;
