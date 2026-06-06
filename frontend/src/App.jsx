import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clearStoredAuth, getStoredAuth, saveAuth } from './auth.js';
import JobQueueDashboard from './components/JobQueueDashboard.jsx';
import LandingPage from './components/LandingPage.jsx';
import Login from './components/Login.jsx';
import PublicNavbar from './components/PublicNavbar.jsx';
import Register from './components/Register.jsx';

const THEME_KEY = 'theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (_error) {
    return 'light';
  }
}

function getCurrentRoute() {
  const path = window.location.pathname;

  if (path === '/register') {
    return '/signup';
  }

  if (path === '/login' || path === '/signup') {
    return path;
  }

  return '/';
}

export default function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [route, setRoute] = useState(() => getCurrentRoute());
  const [authMessage, setAuthMessage] = useState('');
  const [theme, setTheme] = useState(() => getStoredTheme());

  useEffect(() => {
    function handlePopState() {
      setRoute(getCurrentRoute());
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = useCallback((path = '/', sectionId = '') => {
    const normalizedPath = path === '/register' ? '/signup' : path;
    const nextPath = normalizedPath === '/login' || normalizedPath === '/signup' ? normalizedPath : '/';
    const nextUrl = sectionId ? `${nextPath}#${sectionId}` : nextPath;

    window.history.pushState({}, '', nextUrl);
    setRoute(nextPath);

    if (sectionId && nextPath === '/') {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAuthSuccess = useCallback((data) => {
    saveAuth(data.token, data.user);
    setAuth({
      token: data.token,
      user: data.user,
    });
    setAuthMessage('');
    window.history.pushState({}, '', '/dashboard');
  }, []);

  const handleLogout = useCallback((message = '') => {
    clearStoredAuth();
    setAuth(null);
    setAuthMessage(message);
    window.history.pushState({}, '', '/login');
    setRoute('/login');
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
    if (route === '/') {
      return (
        <main className={`app-shell app-shell--landing ${theme === 'dark' ? 'dark' : ''}`}>
          <PublicNavbar
            activeRoute={route}
            theme={theme}
            onNavigate={handleNavigate}
            onThemeToggle={handleThemeToggle}
          />
          <LandingPage theme={theme} onNavigate={handleNavigate} />
        </main>
      );
    }

    const isSignup = route === '/signup';
    const isStandaloneAuth = route === '/login' || isSignup;

    return (
      <main className={`app-shell app-shell--auth ${isStandaloneAuth ? 'app-shell--standalone-auth' : ''} ${theme === 'dark' ? 'dark' : ''}`}>
        {!isStandaloneAuth && (
          <PublicNavbar
            activeRoute={route}
            theme={theme}
            onNavigate={handleNavigate}
            onThemeToggle={handleThemeToggle}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            className="auth-motion-wrap"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          >
            {isSignup ? (
              <Register
                compact
                theme={theme}
                onAuthSuccess={handleAuthSuccess}
                onSwitchToLogin={() => {
                  setAuthMessage('');
                  handleNavigate('/login');
                }}
              />
            ) : (
              <Login
                compact
                theme={theme}
                message={authMessage}
                onAuthSuccess={handleAuthSuccess}
                onSwitchToRegister={() => {
                  setAuthMessage('');
                  handleNavigate('/signup');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
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
