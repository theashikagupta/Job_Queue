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

export default function Register({ onAuthSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
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
      const data = await requestAuth('/api/auth/register', form);
      onAuthSuccess(data);
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="register-heading">
      <div className="auth-panel__intro">
        <h1 id="register-heading">Agentic Job Queue</h1>
        <p>Create your account to keep resumes, preferences, and applications separate.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Register</h2>
        {error && <div className="auth-card__error" role="alert">{error}</div>}
        <label>
          Name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            required
          />
        </label>
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
            minLength="6"
            onChange={(event) => updateField('password', event.target.value)}
            required
          />
        </label>
        <button className="job-queue-dashboard__button" type="submit" disabled={loading}>
          {loading ? 'Creating account' : 'Create Account'}
        </button>
        <button className="auth-card__link" type="button" onClick={onSwitchToLogin}>
          I already have an account
        </button>
      </form>
    </section>
  );
}
