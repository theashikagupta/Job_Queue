import { useState } from 'react';

const API_BASE_URL = 'http://localhost:9000';

async function requestAuth(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export default function Login({ message, onAuthSuccess, onSwitchToRegister }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState(message || '');
  const [loading, setLoading] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError('');
      const data = await requestAuth('/api/auth/login', form);
      onAuthSuccess(data);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="login-heading">
      <div className="auth-panel__intro">
        <h1 id="login-heading">Agentic Job Queue</h1>
        <p>Sign in to manage your resume, preferences, matches, and applications.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <div className="auth-card__error" role="alert">{error}</div>}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            required
          />
        </label>
        <button className="job-queue-dashboard__button" type="submit" disabled={loading}>
          {loading ? 'Logging in' : 'Login'}
        </button>
        <button className="auth-card__link" type="button" onClick={onSwitchToRegister}>
          Create an account
        </button>
      </form>
    </section>
  );
}
