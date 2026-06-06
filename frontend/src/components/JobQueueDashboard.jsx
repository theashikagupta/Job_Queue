import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  FileUp,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  UploadCloud,
  UserCircle,
  X,
} from 'lucide-react';

import SiteFooter from './SiteFooter.jsx';

const API_BASE_URL = 'http://localhost:9000';
const DEFAULT_PREFERENCES = {
  role: '',
  location: '',
  jobType: '',
  minMatchScore: 70,
};
const VISIBLE_STATUSES = new Set(['queued', 'applied', 'interview', 'offer']);
const STATUS_OPTIONS = ['queued', 'applied', 'interview', 'rejected', 'offer'];
const STATUS_LABELS = {
  queued: 'Queued',
  applied: 'Applied',
  interview: 'Interview',
  rejected: 'Rejected',
  offer: 'Offer',
};

function normalizeApplications(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.applications)) return payload.applications;
  return [];
}

function getApplicationId(application) {
  return application._id || application.id || application.jobId;
}

function getJobDetails(application) {
  return application.jobDetails || {};
}

function getMatchScore(application) {
  const details = getJobDetails(application);
  return Number(application.matchScore ?? details.matchScore ?? 0);
}

function getMatchState(score) {
  if (score >= 80) return { label: 'Strong match', className: 'strong' };
  if (score >= 60) return { label: 'Good match', className: 'good' };
  if (score >= 40) return { label: 'Moderate match', className: 'moderate' };
  return { label: 'Low match', className: 'low' };
}

function formatDate(value) {
  if (!value) return 'Not recorded';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getCompanyInitial(company) {
  return (company || 'J').trim().charAt(0).toUpperCase();
}

async function requestJson(url, options = {}, authToken, onSessionExpired) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    onSessionExpired();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export default function JobQueueDashboard({
  authToken,
  user,
  onLogout,
  onSessionExpired,
  theme,
  onThemeToggle,
}) {
  const isDarkMode = theme === 'dark';
  const logoSrc = isDarkMode ? '/assets/logo-dm.png' : '/assets/logo-lm.png';
  const userFirstName = user?.name?.split(' ')[0] || 'Ashika';
  const [applications, setApplications] = useState([]);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeStatus, setResumeStatus] = useState('');
  const [resumeStatusType, setResumeStatusType] = useState('info');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [preferencesStatus, setPreferencesStatus] = useState('');
  const [preferencesStatusType, setPreferencesStatusType] = useState('info');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [togglingFavoriteId, setTogglingFavoriteId] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('highest');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleApplications = useMemo(() => {
    return applications.filter((application) => VISIBLE_STATUSES.has(application.status || 'queued'));
  }, [applications]);

  const favoriteApplications = useMemo(() => {
    return visibleApplications.filter((application) => application.isFavorite);
  }, [visibleApplications]);

  const dashboardStats = useMemo(() => {
    const statusCounts = visibleApplications.reduce((counts, application) => {
      const status = application.status || 'queued';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const averageMatch = visibleApplications.length
      ? Math.round(visibleApplications.reduce((total, application) => total + getMatchScore(application), 0) / visibleApplications.length)
      : 0;

    return [
      { label: 'Queued Jobs', value: statusCounts.queued || 0, icon: BriefcaseBusiness, tone: 'accent' },
      { label: 'Favorites', value: favoriteApplications.length, icon: Star, tone: 'warning' },
      { label: 'Applied', value: statusCounts.applied || 0, icon: CheckCircle2, tone: 'blue' },
      { label: 'Interviews', value: statusCounts.interview || 0, icon: CalendarClock, tone: 'purple' },
      { label: 'Average Match Score', value: `${averageMatch}%`, icon: Sparkles, tone: 'success' },
    ];
  }, [favoriteApplications.length, visibleApplications]);

  const displayedApplications = useMemo(() => {
    const query = jobSearchQuery.trim().toLowerCase();
    const filteredByTab = visibleApplications.filter((application) => {
      if (activeView === 'favorites') return application.isFavorite;
      if (activeView === 'applied') return application.status === 'applied';
      if (activeView === 'interviews') return application.status === 'interview';
      return true;
    });
    const searched = query
      ? filteredByTab.filter((application) => {
        const details = getJobDetails(application);
        const haystack = [
          details.title,
          details.company,
          details.location,
          details.jobType,
          details.source,
          application.status,
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      : filteredByTab;

    return [...searched].sort((first, second) => {
      if (sortMode === 'latest') {
        return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
      }
      if (sortMode === 'company') {
        return String(getJobDetails(first).company || '').localeCompare(String(getJobDetails(second).company || ''));
      }
      return getMatchScore(second) - getMatchScore(first);
    });
  }, [activeView, jobSearchQuery, sortMode, visibleApplications]);

  async function fetchApplications() {
    const data = await requestJson(`${API_BASE_URL}/api/applications`, {}, authToken, onSessionExpired);
    setApplications(normalizeApplications(data));
  }

  function updatePreferenceField(field, value) {
    setPreferences((current) => ({
      ...current,
      [field]: field === 'minMatchScore' ? Number(value) : value,
    }));
  }

  async function runJobSearch(searchPreferences = preferences) {
    setSearchingJobs(true);
    setPreferencesStatus('Searching jobs with your latest profile...');
    setPreferencesStatusType('info');
    console.log('Searching with preferences:', searchPreferences);

    const searchData = await requestJson(`${API_BASE_URL}/api/jobs/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: searchPreferences.role,
        location: searchPreferences.location,
        jobType: searchPreferences.jobType,
        minMatchScore: Number(searchPreferences.minMatchScore),
        minimumScore: Number(searchPreferences.minMatchScore),
      }),
    }, authToken, onSessionExpired);

    const returnedApplications = normalizeApplications(searchData);
    if (returnedApplications.length) {
      setApplications(returnedApplications);
    }

    await fetchApplications();

    const queued = Number(searchData.queued || searchData.queuedCount || 0);
    const rejected = Number(searchData.rejected || searchData.rejectedCount || 0);
    const fetchedCount = Number(searchData.fetchedCount || searchData.totalFound || returnedApplications.length || 0);

    if (!fetchedCount) {
      setPreferencesStatus('No jobs found for these preferences. Try a broader role or location.');
      setPreferencesStatusType('info');
      return;
    }

    setPreferencesStatus(`Search completed: ${queued} queued, ${rejected} rejected.`);
    setPreferencesStatusType('success');
  }

  async function handleFindJobs() {
    try {
      setError('');
      await runJobSearch();
      document.getElementById('recommended-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (searchError) {
      setPreferencesStatus(
        searchError.message === 'Please upload your resume before searching jobs.'
          ? searchError.message
          : 'Job search failed. Please check API key or backend logs.',
      );
      setPreferencesStatusType('error');
    } finally {
      setSearchingJobs(false);
    }
  }

  async function handleResumeUpload(event) {
    event.preventDefault();

    if (!resumeFile) {
      setResumeStatus('Choose a PDF resume to upload.');
      setResumeStatusType('error');
      return;
    }

    try {
      setUploadingResume(true);
      setResumeStatus('Uploading and parsing resume...');
      setResumeStatusType('info');

      const formData = new FormData();
      formData.append('resume', resumeFile);

      const data = await requestJson(`${API_BASE_URL}/uploadResume`, {
        method: 'POST',
        body: formData,
      }, authToken, onSessionExpired);

      const uploadedName = data.resume?.originalFileName || resumeFile.name;
      setResumeStatus(`Resume uploaded and parsed successfully: ${uploadedName}`);
      setResumeStatusType('success');
      setResumeFile(null);
      setShowResumeForm(false);
      event.target.reset();
    } catch (uploadError) {
      setResumeStatus(uploadError.message);
      setResumeStatusType('error');
    } finally {
      setUploadingResume(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError('');
        const [applicationsData, preferencesData] = await Promise.all([
          requestJson(`${API_BASE_URL}/api/applications`, {}, authToken, onSessionExpired),
          requestJson(`${API_BASE_URL}/api/preferences`, {}, authToken, onSessionExpired),
        ]);

        if (isMounted) {
          setApplications(normalizeApplications(applicationsData));
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...(preferencesData.preferences || {}),
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [authToken, onSessionExpired]);

  async function handleSavePreferences(event) {
    event.preventDefault();
    const nextPreferences = {
      role: preferences.role,
      location: preferences.location,
      jobType: preferences.jobType,
      minMatchScore: Number(preferences.minMatchScore),
    };

    try {
      setSavingPreferences(true);
      setPreferencesStatus('');
      setPreferencesStatusType('info');

      const data = await requestJson(`${API_BASE_URL}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextPreferences),
      }, authToken, onSessionExpired);

      const savedPreferences = {
        ...DEFAULT_PREFERENCES,
        ...(data.preferences || nextPreferences),
      };

      setPreferences(savedPreferences);
      setPreferencesStatus('Preferences saved. Searching jobs...');
      await runJobSearch(savedPreferences);
      setPreferencesStatusType('success');
    } catch (saveError) {
      setPreferencesStatus(
        saveError.message === 'Please upload your resume before searching jobs.'
          ? saveError.message
          : saveError.message.includes('search')
            ? 'Job search failed. Please check API key or backend logs.'
            : saveError.message,
      );
      setPreferencesStatusType('error');
    } finally {
      setSavingPreferences(false);
      setSearchingJobs(false);
    }
  }

  async function handleToggleFavorite(application) {
    const applicationId = getApplicationId(application);

    if (!applicationId) {
      setError('This application is missing an ID.');
      return;
    }

    try {
      setTogglingFavoriteId(applicationId);
      setError('');

      const data = await requestJson(`${API_BASE_URL}/api/applications/${encodeURIComponent(applicationId)}/favorite`, {
        method: 'PATCH',
      }, authToken, onSessionExpired);
      const updatedApplication = data.application;

      if (updatedApplication) {
        setApplications((currentApplications) => currentApplications.map((currentApplication) => (
          getApplicationId(currentApplication) === getApplicationId(updatedApplication)
            ? updatedApplication
            : currentApplication
        )));
      } else {
        await fetchApplications();
      }
    } catch (favoriteError) {
      setError(favoriteError.message);
    } finally {
      setTogglingFavoriteId('');
    }
  }

  async function handleStatusChange(application, selectedStatus) {
    const applicationId = getApplicationId(application);

    if (!applicationId) {
      setError('This application is missing an ID.');
      return;
    }

    try {
      setUpdatingStatusId(applicationId);
      setError('');

      await requestJson(`${API_BASE_URL}/api/applications/${encodeURIComponent(applicationId)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      }, authToken, onSessionExpired);

      await fetchApplications();
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setUpdatingStatusId('');
    }
  }

  function handleDashboardNav(target) {
    setMobileNavOpen(false);

    if (target === 'dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (target === 'queue') {
      setActiveView('all');
      document.getElementById('recommended-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (target === 'favorites') {
      setActiveView('favorites');
      document.getElementById('recommended-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (target === 'applications') {
      setActiveView('applied');
      document.getElementById('recommended-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    document.getElementById('profile-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return (
      <motion.main
        className={`app-shell ${theme === 'dark' ? 'dark' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <section className="job-queue-dashboard">
          <motion.div
            className="job-queue-loader"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <div className="job-queue-loader__visual" aria-hidden="true">
              <motion.div
                className="job-queue-loader__ring"
                animate={{ rotate: 360 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="job-queue-loader__pulse"
                animate={{ scale: [1, 1.08, 1], opacity: [0.82, 1, 0.82] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img src={logoSrc} alt="Job Queue logo" />
              </motion.div>
            </div>
            <div className="job-queue-loader__copy">
              <p>Loading Job Queue</p>
              <span>Syncing your applications, favorites, and preferences</span>
            </div>
            <div className="job-queue-loader__bars" aria-hidden="true">
              {[0, 1, 2].map((bar) => (
                <motion.span
                  key={bar}
                  animate={{ scaleX: [0.28, 1, 0.28], opacity: [0.45, 1, 0.45] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: bar * 0.16,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </section>
      </motion.main>
    );
  }

  return (
    <motion.main
      className={`app-shell ${theme === 'dark' ? 'dark' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <button className="dashboard-nav__brand" type="button" aria-label="Dashboard home" onClick={() => handleDashboardNav('dashboard')}>
          <img src={logoSrc} alt="Job Queue logo" />
        </button>
        <div className={`dashboard-nav__links ${mobileNavOpen ? 'dashboard-nav__links--open' : ''}`}>
          {[
            ['dashboard', 'Dashboard'],
            ['queue', 'Queue'],
            ['favorites', 'Favorites'],
            ['applications', 'Applications'],
            ['profile', 'Profile'],
          ].map(([target, label]) => (
            <button key={target} type="button" onClick={() => handleDashboardNav(target)}>
              {label}
            </button>
          ))}
        </div>
        <div className="dashboard-nav__actions">
          <button className="theme-toggle" type="button" onClick={onThemeToggle}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <div className="dashboard-nav__user-menu">
            <button
              className="dashboard-nav__user-button"
              type="button"
              onClick={() => setUserMenuOpen((current) => !current)}
              aria-expanded={userMenuOpen}
            >
              <UserCircle size={20} />
              <span>{user?.name || 'User'}</span>
              <ChevronDown size={16} />
            </button>
            {userMenuOpen && (
              <div className="dashboard-nav__dropdown">
                <strong>{user?.name || 'User'}</strong>
                <span>{user?.email}</span>
                <button type="button" onClick={onLogout}>
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
          <button
            className="dashboard-nav__menu"
            type="button"
            aria-label={mobileNavOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <section className="job-queue-dashboard" aria-labelledby="job-queue-heading">
        <motion.section
          className="dashboard-hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="dashboard-hero__copy">
            <p className="job-queue-dashboard__eyebrow">
              <Sparkles size={16} />
              AI-matched opportunities
            </p>
            <h1 id="job-queue-heading">Welcome back, {userFirstName} 👋</h1>
            <p>Your AI job queue is ready. Upload your resume, update preferences, and track matched jobs from one focused workspace.</p>
            <div className="dashboard-hero__actions">
              <button className="job-queue-dashboard__button" type="button" onClick={handleFindJobs} disabled={searchingJobs}>
                <Search size={17} />
                {searchingJobs ? 'Searching' : 'Find Jobs'}
              </button>
              <button
                className="job-queue-dashboard__button job-queue-dashboard__button--secondary"
                type="button"
                onClick={() => {
                  document.getElementById('profile-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <SlidersHorizontal size={17} />
                Update Preferences
              </button>
            </div>
          </div>
          <motion.div
            className="dashboard-hero__visual"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            <div>
              <span className="dashboard-hero__pulse" />
              <strong>AI Matching Active</strong>
            </div>
            <ul>
              <li><CheckCircle2 size={17} /> Resume parsed</li>
              <li><BriefcaseBusiness size={17} /> {visibleApplications.length || 6} jobs found</li>
              <li><Star size={17} /> {favoriteApplications.length || 3} saved</li>
            </ul>
          </motion.div>
        </motion.section>

        <div className="dashboard-stats-grid">
          {dashboardStats.map((stat, index) => {
            const StatIcon = stat.icon;

            return (
              <motion.div
                className={`dashboard-stat dashboard-stat--${stat.tone}`}
                key={stat.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.05 + index * 0.05 }}
              >
                <span>
                  <StatIcon size={19} />
                </span>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </motion.div>
            );
          })}
        </div>

        <motion.section
          className="profile-setup"
          id="profile-setup"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.12 }}
        >
          <div className="dashboard-section-heading">
            <p className="job-queue-dashboard__eyebrow">
              <UserCircle size={16} />
              Profile Setup
            </p>
            <h2>Resume and preferences</h2>
            <span>Keep your profile fresh so recommendations stay accurate.</span>
          </div>

          <div className="profile-setup__grid">
            <article className="profile-card">
              <div className="profile-card__header">
                <span><FileText size={21} /></span>
                <div>
                  <h3>Resume Card</h3>
                  <p>{resumeStatusType === 'success' ? 'Resume parsed and ready.' : 'Upload your PDF resume to unlock AI scoring.'}</p>
                </div>
              </div>
              <div className="profile-card__summary">
                <strong>{resumeStatusType === 'success' ? 'Resume available' : 'No resume uploaded yet'}</strong>
                <span>{resumeStatus || 'PDF resume required for accurate AI match scores.'}</span>
              </div>
              <button className="job-queue-dashboard__button job-queue-dashboard__button--secondary" type="button" onClick={() => setShowResumeForm((current) => !current)}>
                <UploadCloud size={17} />
                {resumeStatusType === 'success' ? 'Replace Resume' : 'Upload Resume'}
              </button>
              <AnimatePresence>
                {showResumeForm && (
                  <motion.form
                    className="profile-card__form"
                    onSubmit={handleResumeUpload}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className="resume-upload__dropzone">
                      <FileUp size={22} />
                      <span>{resumeFile ? resumeFile.name : 'Choose PDF resume'}</span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    <button className="job-queue-dashboard__button" type="submit" disabled={uploadingResume}>
                      <UploadCloud size={17} />
                      {uploadingResume ? 'Uploading' : 'Save Resume'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
              {resumeStatus && (
                <div className={`resume-upload__status resume-upload__status--${resumeStatusType}`} role="status">
                  {resumeStatus}
                </div>
              )}
            </article>

            <form className="profile-card profile-card--preferences" onSubmit={handleSavePreferences}>
              <div className="profile-card__header">
                <span><SlidersHorizontal size={21} /></span>
                <div>
                  <h3>Preferences Card</h3>
                  <p>Saved values drive search, filtering, and queue scoring.</p>
                </div>
              </div>
              <div className="profile-values profile-values--editable">
                <label className="profile-value-card">
                  <small>Role</small>
                  <input
                    type="text"
                    value={preferences.role}
                    onChange={(event) => updatePreferenceField('role', event.target.value)}
                    placeholder="Software Developer"
                  />
                </label>
                <label className="profile-value-card">
                  <small>Location</small>
                  <input
                    type="text"
                    value={preferences.location}
                    onChange={(event) => updatePreferenceField('location', event.target.value)}
                    placeholder="Bengaluru"
                  />
                </label>
                <label className="profile-value-card">
                  <small>Job Type</small>
                  <select
                    value={preferences.jobType}
                    onChange={(event) => updatePreferenceField('jobType', event.target.value)}
                  >
                    <option value="">Select job type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Remote">Remote</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </label>
                <label className="profile-value-card">
                  <small>Minimum Score</small>
                  <span className="profile-score-input">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={preferences.minMatchScore}
                      onChange={(event) => updatePreferenceField('minMatchScore', event.target.value)}
                    />
                    <b>%</b>
                  </span>
                </label>
              </div>
              <button
                className="job-queue-dashboard__button"
                type="submit"
                disabled={savingPreferences || searchingJobs}
              >
                <Search size={17} />
                {searchingJobs ? 'Searching' : savingPreferences ? 'Saving' : 'Save and Search'}
              </button>
              {preferencesStatus && (
                <div className={`job-preferences__status job-preferences__status--${preferencesStatusType}`} role="status">
                  {preferencesStatus}
                </div>
              )}
            </form>
          </div>
        </motion.section>

        <AnimatePresence>
          {error && (
            <motion.div
              className="job-queue-dashboard__error"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          className="recommended-jobs"
          id="recommended-jobs"
          aria-label="Recommended jobs"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.22 }}
        >
          <div className="recommended-jobs__header">
            <div className="dashboard-section-heading">
              <p className="job-queue-dashboard__eyebrow">
                <BriefcaseBusiness size={16} />
                Recommended Jobs
              </p>
              <h2>AI-ranked roles based on your resume and preferences.</h2>
            </div>
            <div className="recommended-jobs__tools">
              <label className="recommended-jobs__search">
                <Search size={17} />
                <input
                  type="search"
                  value={jobSearchQuery}
                  onChange={(event) => setJobSearchQuery(event.target.value)}
                  placeholder="Search jobs, companies, or location"
                />
              </label>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Sort jobs">
                <option value="highest">Highest Match</option>
                <option value="latest">Latest</option>
                <option value="company">Company A-Z</option>
              </select>
            </div>
          </div>

          <div className="recommended-jobs__tabs" role="tablist" aria-label="Job filters">
            {[
              ['all', 'All Jobs', visibleApplications.length],
              ['favorites', 'Favorites', favoriteApplications.length],
              ['applied', 'Applied', visibleApplications.filter((application) => application.status === 'applied').length],
              ['interviews', 'Interviews', visibleApplications.filter((application) => application.status === 'interview').length],
            ].map(([value, label, count]) => (
              <button
                key={value}
                className={activeView === value ? 'recommended-jobs__tab recommended-jobs__tab--active' : 'recommended-jobs__tab'}
                type="button"
                role="tab"
                aria-selected={activeView === value}
                onClick={() => setActiveView(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>

          {!displayedApplications.length ? (
            <motion.div
              className="dashboard-empty-state"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <div className="dashboard-empty-state__icon">
                <Search size={30} />
              </div>
              <h3>No jobs in your queue yet.</h3>
              <p>Upload your resume and set preferences to start AI job discovery.</p>
              <button className="job-queue-dashboard__button" type="button" onClick={handleFindJobs} disabled={searchingJobs}>
                <Search size={17} />
                {searchingJobs ? 'Searching' : 'Find Jobs'}
              </button>
            </motion.div>
          ) : (
            <div className="job-card-grid">
              <AnimatePresence mode="popLayout">
                {displayedApplications.map((application, index) => {
                  const details = getJobDetails(application);
                  const applicationId = getApplicationId(application);
                  const applyUrl = application.jobDetails?.applyUrl;
                  const currentStatus = application.status || 'queued';
                  const isTogglingFavorite = togglingFavoriteId === applicationId;
                  const company = details.company || application.company || 'Unknown company';
                  const score = getMatchScore(application);
                  const matchState = getMatchState(score);

                  return (
                    <motion.article
                      className="job-card"
                      key={applicationId || `${details.applyUrl || details.title || 'job'}-${index}`}
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.24, delay: index * 0.025 }}
                      whileHover={{ y: -4 }}
                    >
                      <div className="job-card__top">
                        <div className="job-card__company">
                          <span className="job-card__logo">{getCompanyInitial(company)}</span>
                          <div>
                            <strong>{company}</strong>
                            <small>{formatDate(application.createdAt)}</small>
                          </div>
                        </div>
                        <motion.button
                          className={`job-queue-dashboard__favorite ${application.isFavorite ? 'job-queue-dashboard__favorite--active' : ''}`}
                          type="button"
                          aria-label={application.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          aria-pressed={Boolean(application.isFavorite)}
                          disabled={!applicationId || isTogglingFavorite}
                          onClick={() => handleToggleFavorite(application)}
                          whileTap={{ scale: 0.9, rotate: -8 }}
                        >
                          <Star size={19} fill={application.isFavorite ? 'currentColor' : 'none'} />
                        </motion.button>
                      </div>

                      <div className="job-card__body">
                        <h3>{details.title || application.title || 'Untitled role'}</h3>
                        <p className="job-card__location">
                          <MapPin size={16} />
                          {details.location || application.location || 'Not specified'}
                        </p>
                        <div className="job-card__badges">
                          <span>{details.jobType || application.jobType || 'Full-time'}</span>
                          <span>{details.source || 'Job Source'}</span>
                        </div>
                      </div>

                      <div className="job-card__match">
                        <div>
                          <span className={`job-card__match-badge job-card__match-badge--${matchState.className}`}>
                            {score}% match
                          </span>
                          <strong>{matchState.label}</strong>
                        </div>
                        <div className="job-card__progress" aria-label={`${score}% match score`}>
                          <span style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                        </div>
                      </div>

                      <div className="job-card__controls">
                        <select
                          className="job-queue-dashboard__status-select"
                          value={currentStatus}
                          disabled={!applicationId || updatingStatusId === applicationId}
                          onChange={(event) => handleStatusChange(application, event.target.value)}
                          aria-label={`Update status for ${details.title || application.title || 'job'}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        {applyUrl ? (
                          <a
                            className="job-queue-dashboard__button"
                            href={applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Apply Now
                            <ExternalLink size={16} />
                          </a>
                        ) : (
                          <span className="job-queue-dashboard__muted">No link available</span>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.section>
      </section>
      <SiteFooter theme={theme} />
    </motion.main>
  );
}
