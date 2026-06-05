import { motion } from 'framer-motion';

const LOGO_SRC = '/assets/job-queue-logo.png';

export default function SiteFooter() {
  return (
    <motion.footer
      className="site-footer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.1 }}
    >
      <div className="site-footer__brand">
        <img src={LOGO_SRC} alt="Job Queue logo" />
        <div>
          <strong>Job Queue</strong>
          <span>AI-matched jobs, organized for action.</span>
        </div>
      </div>
      <div className="site-footer__links" aria-label="Footer details">
        <span>Resume matching</span>
        <span>Favorites</span>
        <span>Status tracking</span>
      </div>
      <p>2026 Job Queue. Built for focused application tracking.</p>
    </motion.footer>
  );
}
