const envApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = (envApiUrl !== undefined && envApiUrl !== '')
  ? envApiUrl.replace(/\/$/, '')
  : (import.meta.env.PROD ? '' : 'http://localhost:8000');

