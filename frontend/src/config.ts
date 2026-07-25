const envApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = (envApiUrl && envApiUrl.trim() !== '')
  ? envApiUrl.replace(/\/$/, '')
  : '';
