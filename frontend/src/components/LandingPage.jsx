import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileUp,
  Heart,
  LockKeyhole,
  Moon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UploadCloud,
} from 'lucide-react';

const steps = [
  {
    title: 'Upload Resume',
    text: 'Add your PDF resume so Job Queue can understand your skills, projects, and experience.',
    icon: UploadCloud,
  },
  {
    title: 'Set Preferences',
    text: 'Choose your target role, location, job type, and minimum match score.',
    icon: SlidersHorizontal,
  },
  {
    title: 'AI Matches Jobs',
    text: 'Jobs are normalized, scored, and organized around your real resume profile.',
    icon: Sparkles,
  },
  {
    title: 'Track Applications',
    text: 'Save favorites, open apply links, and update each application status.',
    icon: CheckCircle2,
  },
];

const features = [
  {
    title: 'AI Resume Matching',
    text: 'Match scores use your parsed resume data instead of generic keywords.',
    icon: Search,
  },
  {
    title: 'Smart Job Queue',
    text: 'See only the roles that are ready for review, without rejected noise.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Favorites',
    text: 'Star the opportunities you want to revisit quickly.',
    icon: Heart,
  },
  {
    title: 'Application Status Tracking',
    text: 'Move roles from queued to applied, interview, offer, or rejected.',
    icon: CheckCircle2,
  },
  {
    title: 'Dark Mode',
    text: 'Switch themes for a comfortable dashboard in any workspace.',
    icon: Moon,
  },
  {
    title: 'JWT Secured Login',
    text: 'Keep resumes, preferences, and jobs separated by user account.',
    icon: LockKeyhole,
  },
];

const workflow = ['Resume', 'Preferences', 'AI Matching', 'Job Queue', 'Apply & Track'];

const previewJobs = [
  {
    title: 'Frontend Developer',
    company: 'BluePeak Labs',
    score: '92%',
    status: 'Queued',
  },
  {
    title: 'React Engineer',
    company: 'CloudHire',
    score: '88%',
    status: 'Interview',
  },
  {
    title: 'MERN Stack Developer',
    company: 'Northstar Tech',
    score: '84%',
    status: 'Applied',
  },
];

export default function LandingPage({ onNavigate }) {
  return (
    <>
      <section className="landing-hero" id="home">
        <motion.div
          className="landing-hero__copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1>Your AI-Powered Job Search Queue</h1>
          <p className="landing-hero__subtitle">
            Discover matched jobs, save favorites, and track applications in one organized workspace.
          </p>
          <div className="landing-hero__actions">
            <motion.button
              className="job-queue-dashboard__button landing-hero__primary"
              type="button"
              onClick={() => onNavigate('/signup')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Get Started
              <ArrowRight size={18} />
            </motion.button>
            <motion.button
              className="job-queue-dashboard__button job-queue-dashboard__button--secondary landing-hero__secondary"
              type="button"
              onClick={() => onNavigate('/login')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Login
            </motion.button>
          </div>
          <div className="landing-hero__proof">
            <span><CheckCircle2 size={16} /> Resume-based scoring</span>
            <span><CheckCircle2 size={16} /> Favorites and status tracking</span>
            <span><CheckCircle2 size={16} /> Secure user workspace</span>
          </div>
        </motion.div>

        <motion.div
          className="landing-preview"
          initial={{ opacity: 0, x: 24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.38, delay: 0.08 }}
          aria-label="Dashboard preview"
        >
          <div className="landing-preview__top">
            <div>
              <span>Live Queue</span>
              <strong>Matched Jobs</strong>
            </div>
            <p>3 active</p>
          </div>
          <div className="landing-preview__stats">
            <span><FileUp size={15} /> Resume parsed</span>
            <span><Sparkles size={15} /> AI ranked</span>
          </div>
          <div className="landing-preview__jobs">
            {previewJobs.map((job, index) => (
              <motion.article
                className="landing-preview__job"
                key={job.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.18 + index * 0.07 }}
              >
                <div>
                  <h3>{job.title}</h3>
                  <p>{job.company}</p>
                </div>
                <div className="landing-preview__job-meta">
                  <span>{job.score} match</span>
                  <small>{job.status}</small>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-section__heading">
          <p className="landing-badge">
            <BriefcaseBusiness size={16} />
            How It Works
          </p>
          <h2>From resume to organized applications in four steps.</h2>
        </div>
        <div className="landing-steps">
          {steps.map((step, index) => {
            const StepIcon = step.icon;

            return (
              <motion.article
                className="landing-card landing-step"
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.28, delay: index * 0.06 }}
              >
                <span className="landing-step__number">{index + 1}</span>
                <div className="landing-card__icon">
                  <StepIcon size={22} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section__heading">
          <p className="landing-badge">
            <Star size={16} />
            Features
          </p>
          <h2>Everything needed to keep your job search moving.</h2>
        </div>
        <div className="landing-features">
          {features.map((feature, index) => {
            const FeatureIcon = feature.icon;

            return (
              <motion.article
                className="landing-card landing-feature"
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.28, delay: index * 0.04 }}
              >
                <div className="landing-card__icon">
                  <FeatureIcon size={22} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-workflow" aria-label="AI workflow">
        <div className="landing-section__heading">
          <p className="landing-badge">
            <Sparkles size={16} />
            AI Workflow
          </p>
          <h2>One clear path from profile to applications.</h2>
        </div>
        <div className="landing-workflow__rail">
          {workflow.map((item, index) => (
            <motion.div
              className="landing-workflow__item"
              key={item}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
            >
              <span>{index + 1}</span>
              <strong>{item}</strong>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.section
        className="landing-cta"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.32 }}
      >
        <div>
          <p className="landing-badge">
            <Sparkles size={16} />
            Start today
          </p>
          <h2>Ready to organize your job search?</h2>
        </div>
        <button className="job-queue-dashboard__button landing-cta__button" type="button" onClick={() => onNavigate('/signup')}>
          Create Account
          <ArrowRight size={18} />
        </button>
      </motion.section>

      <footer className="landing-footer">
        <div className="minimal-footer__content">
          <strong>Built by Ashika Gupta</strong>
          <span>© 2026 Job Queue. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
