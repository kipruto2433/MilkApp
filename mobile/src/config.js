import { Platform } from 'react-native';

const localBaseURL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || localBaseURL;

export const API_BASE_URL = baseURL;
export const isHostedWebWithoutApi = Platform.OS === 'web'
  && typeof window !== 'undefined'
  && !['localhost', '127.0.0.1'].includes(window.location.hostname)
  && !process.env.EXPO_PUBLIC_API_BASE_URL;
