import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';

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

export default function Login({ compact = false, theme, message, onAuthSuccess, onSwitchToRegister }) {
  const isDarkMode = theme === 'dark';
  const logoSrc = isDarkMode ? '/assets/logo-dm.png' : '/assets/logo-lm.png';
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
    <section className={`auth-panel ${compact ? 'auth-panel--solo' : ''}`} aria-labelledby="login-card-heading">
      {!compact && (
        <div className="auth-panel__intro">
          <motion.div
            className="auth-panel__mark"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, delay: 0.05 }}
          >
            <img src={logoSrc} alt="Job Queue logo" />
          </motion.div>
          <p className="auth-panel__eyebrow">
            <Sparkles size={15} />
            AI job workflow
          </p>
        
          <p>Sign in to manage resume matches, saved roles, and application status in one focused workspace.</p>
          <div className="auth-panel__trust">
            <span><ShieldCheck size={15} /> JWT secured</span>
            <span><BriefcaseBusiness size={15} /> User-specific data</span>
          </div>
        </div>
      )}

      <motion.form
        className={`auth-card ${compact ? 'auth-card--solo' : ''}`}
        onSubmit={handleSubmit}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        {compact && (
          <div className="auth-card__logo">
            <img src={logoSrc} alt="Job Queue logo" />
          </div>
        )}
        <div className="auth-card__heading">
          <h2 id="login-card-heading">Login</h2>
          <span>Welcome back</span>
        </div>
        {error && <div className="auth-card__error" role="alert">{error}</div>}
        <label>
          Email
          <span className="auth-card__field">
            <Mail size={17} />
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              required
            />
          </span>
        </label>
        <label>
          Password
          <span className="auth-card__field">
            <Lock size={17} />
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              required
            />
          </span>
        </label>
        <button className="job-queue-dashboard__button" type="submit" disabled={loading}>
          {loading ? 'Logging in' : 'Login'}
          <ArrowRight size={17} />
        </button>
        <button className="auth-card__link" type="button" onClick={onSwitchToRegister}>
          Create an account
        </button>
      </motion.form>
    </section>
  );
}
