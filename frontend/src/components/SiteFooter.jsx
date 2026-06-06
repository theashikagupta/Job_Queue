import { motion } from 'framer-motion';

export default function SiteFooter() {
  return (
    <motion.footer
      className="site-footer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.1 }}
    >
      <div className="minimal-footer__content">
        <strong>Built by Ashika Gupta</strong>
        <span>© 2026 Job Queue. All rights reserved.</span>
      </div>
    </motion.footer>
  );
}
