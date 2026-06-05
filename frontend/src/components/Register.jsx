import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';

const API_BASE_URL = 'http://localhost:9000';
const LOGO_SRC = '/assets/job-queue-logo.png';

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
        <motion.div
          className="auth-panel__mark"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, delay: 0.05 }}
        >
          <img src={LOGO_SRC} alt="Job Queue logo" />
        </motion.div>
        <p className="auth-panel__eyebrow">
          <Sparkles size={15} />
          AI job workflow
        </p>
        <h1 id="register-heading">Job Queue</h1>
        <p>Create your account to keep resumes, preferences, saved roles, and applications cleanly separated.</p>
        <div className="auth-panel__trust">
          <span><ShieldCheck size={15} /> JWT secured</span>
          <span><BriefcaseBusiness size={15} /> User-specific data</span>
        </div>
      </div>

      <motion.form
        className="auth-card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <div className="auth-card__heading">
          <h2>Register</h2>
          <span>Start your queue</span>
        </div>
        {error && <div className="auth-card__error" role="alert">{error}</div>}
        <label>
          Name
          <span className="auth-card__field">
            <User size={17} />
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              required
            />
          </span>
        </label>
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
              minLength="6"
              onChange={(event) => updateField('password', event.target.value)}
              required
            />
          </span>
        </label>
        <button className="job-queue-dashboard__button" type="submit" disabled={loading}>
          {loading ? 'Creating account' : 'Create Account'}
          <ArrowRight size={17} />
        </button>
        <button className="auth-card__link" type="button" onClick={onSwitchToLogin}>
          I already have an account
        </button>
      </motion.form>
    </section>
  );
}
