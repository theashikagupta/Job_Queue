const AUTH_TOKEN_KEY = 'agenticJobQueueToken';
const AUTH_USER_KEY = 'agenticJobQueueUser';

export function getStoredAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userJson = localStorage.getItem(AUTH_USER_KEY);

  if (!token || !userJson) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userJson),
    };
  } catch (_error) {
    clearStoredAuth();
    return null;
  }
}

export function saveAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}
