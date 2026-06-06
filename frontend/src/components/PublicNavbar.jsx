import { motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';

export default function PublicNavbar({
  activeRoute,
  theme,
  onNavigate,
  onThemeToggle,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDarkMode = theme === 'dark';
  const logoSrc = isDarkMode ? '/assets/logo-dm.png' : '/assets/logo-lm.png';

  function handleNavigate(path, sectionId) {
    setMenuOpen(false);
    onNavigate(path, sectionId);
  }

  const links = [
    { label: 'Home', path: '/' },
    { label: 'Features', path: '/', sectionId: 'features' },
    { label: 'How It Works', path: '/', sectionId: 'how-it-works' },
    { label: 'Login', path: '/login' },
  ];

  return (
    <motion.header
      className="public-navbar"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
    >
      <button
        className="public-navbar__brand"
        type="button"
        aria-label="Job Queue home"
        onClick={() => handleNavigate('/')}
      >
        <img src={logoSrc} alt="Job Queue logo" />
      </button>

      <nav className={`public-navbar__links ${menuOpen ? 'public-navbar__links--open' : ''}`}>
        {links.map((link) => (
          <button
            className={activeRoute === link.path && !link.sectionId ? 'public-navbar__link public-navbar__link--active' : 'public-navbar__link'}
            key={`${link.label}-${link.sectionId || link.path}`}
            type="button"
            onClick={() => handleNavigate(link.path, link.sectionId)}
          >
            {link.label}
          </button>
        ))}
        <button className="public-navbar__link public-navbar__link--signup" type="button" onClick={() => handleNavigate('/signup')}>
          Get Started
        </button>
      </nav>

      <div className="public-navbar__actions">
        <button className="theme-toggle public-navbar__theme" type="button" onClick={onThemeToggle}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button className="job-queue-dashboard__button public-navbar__cta" type="button" onClick={() => handleNavigate('/signup')}>
          Get Started
        </button>
        <button
          className="public-navbar__menu"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </motion.header>
  );
}
