import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL + '/api',
  timeout: 7000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'The server took too long to respond. Please try again.';
    } else if (!error.response && error.message === 'Network Error') {
      error.message = 'Unable to reach the server. Check your connection and try again.';
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export const checkBackendHealth = () => api.get('/health', { timeout: 5000 });

const authHeader = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// Helper functions (compatible with both patterns)
export const login = (identifier, password) =>
  api.post('/auth/login', { identifier, password });

export const fetchFarmers = (token) =>
  api.get('/farmers', authHeader(token));

export const createFarmer = (token, farmer) =>
  api.post('/farmers', farmer, authHeader(token));

export const fetchCollections = (token) =>
  api.get('/collections', authHeader(token));

export const createCollection = (token, collection) =>
  api.post('/collections', collection, authHeader(token));

export const fetchPayments = (token) =>
  api.get('/payments', authHeader(token));

export const createPayment = (token, payment) =>
  api.post('/payments', payment, authHeader(token));

export const fetchCollectors = (token) =>
  api.get('/collectors', authHeader(token));

export const createCollector = (token, collector) =>
  api.post('/collectors', collector, authHeader(token));

export const deleteCollector = (token, id) =>
  api.delete(`/collectors/${id}`, authHeader(token));

export const deleteFarmer = (token, id) =>
  api.delete(`/farmers/${id}`, authHeader(token));

export const changePassword = (token, oldPassword, newPassword) =>
  api.put('/auth/change-password', { oldPassword, newPassword }, authHeader(token));

export const getSettings = (token) =>
  api.get('/settings', authHeader(token));

export const updateSettings = (token, setting_key, setting_value) =>
  api.put('/settings', { setting_key, setting_value }, authHeader(token));

export const getLogs = (token) =>
  api.get('/logs', authHeader(token));

export const fetchReports = (token, type) =>
  api.get(`/reports/${type}`, authHeader(token));

export default api;
