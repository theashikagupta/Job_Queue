const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || 'https://jobqueue-production-a8bf.up.railway.app'
).replace(/\/$/, '');

export default API_BASE_URL;
