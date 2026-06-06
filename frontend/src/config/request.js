import API_BASE_URL from './api.js';

function buildRequestUrl(pathOrUrl) {
  if (String(pathOrUrl).startsWith('http')) {
    return pathOrUrl;
  }

  const normalizedPath = String(pathOrUrl || '').startsWith('/')
    ? pathOrUrl
    : `/${pathOrUrl || ''}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

export async function apiRequest(pathOrUrl, options = {}) {
  const {
    authToken,
    onSessionExpired,
    headers,
    ...fetchOptions
  } = options;
  const requestUrl = buildRequestUrl(pathOrUrl);
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const requestHeaders = {
    ...(headers || {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  console.log('API request:', {
    url: requestUrl,
    method,
  });

  let response;

  try {
    response = await fetch(requestUrl, {
      ...fetchOptions,
      headers: requestHeaders,
    });
  } catch (error) {
    console.error('API fetch failed:', {
      url: requestUrl,
      method,
      error: error.message,
    });
    throw new Error('Unable to reach backend. Please check Railway deployment or CORS.');
  }

  const data = await readResponseBody(response);

  console.log('API response:', {
    url: requestUrl,
    method,
    status: response.status,
    body: data,
  });

  if (response.status === 401 && onSessionExpired) {
    onSessionExpired();
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}
