import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { clearStoredAuth, getStoredAuth, saveAuth } from './auth.js';
import JobQueueDashboard from './components/JobQueueDashboard.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import SiteFooter from './components/SiteFooter.jsx';

const THEME_KEY = 'theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (_error) {
    return 'light';
  }
}

export default function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [authMode, setAuthMode] = useState('login');
  const [authMessage, setAuthMessage] = useState('');
  const [theme, setTheme] = useState(() => getStoredTheme());

  const handleAuthSuccess = useCallback((data) => {
    saveAuth(data.token, data.user);
    setAuth({
      token: data.token,
      user: data.user,
    });
    setAuthMessage('');
  }, []);

  const handleLogout = useCallback((message = '') => {
    clearStoredAuth();
    setAuth(null);
    setAuthMode('login');
    setAuthMessage(message);
  }, []);

  const handleUserLogout = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const handleSessionExpired = useCallback(() => {
    handleLogout('Session expired. Please login again.');
  }, [handleLogout]);

  const handleThemeToggle = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, nextTheme);
      return nextTheme;
    });
  }, []);

  if (!auth) {
    return (
      <main className={`app-shell app-shell--auth ${theme === 'dark' ? 'dark' : ''}`}>
        <button className="theme-toggle theme-toggle--auth" type="button" onClick={handleThemeToggle}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={authMode}
            className="auth-motion-wrap"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          >
            {authMode === 'login' ? (
              <Login
                message={authMessage}
                onAuthSuccess={handleAuthSuccess}
                onSwitchToRegister={() => {
                  setAuthMode('register');
                  setAuthMessage('');
                }}
              />
            ) : (
              <Register
                onAuthSuccess={handleAuthSuccess}
                onSwitchToLogin={() => {
                  setAuthMode('login');
                  setAuthMessage('');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
        <SiteFooter />
      </main>
    );
  }

  return (
    <JobQueueDashboard
      authToken={auth.token}
      user={auth.user}
      onLogout={handleUserLogout}
      onSessionExpired={handleSessionExpired}
      theme={theme}
      onThemeToggle={handleThemeToggle}
    />
  );
}
