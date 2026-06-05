import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ExternalLink,
  FileUp,
  Heart,
  LogOut,
  MapPin,
  Moon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  UploadCloud,
} from 'lucide-react';

import SiteFooter from './SiteFooter.jsx';

const API_BASE_URL = 'http://localhost:9000';
const LOGO_SRC = '/assets/job-queue-logo.png';
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

function formatDate(value) {
  if (!value) return 'Not recorded';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString();
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
  const [applications, setApplications] = useState([]);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeStatus, setResumeStatus] = useState('');
  const [resumeStatusType, setResumeStatusType] = useState('info');
  const [uploadingResume, setUploadingResume] = useState(false);
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

    return [
      { label: 'Queued', value: statusCounts.queued || 0, icon: BriefcaseBusiness },
      { label: 'Favorites', value: favoriteApplications.length, icon: Star },
      { label: 'Interviews', value: statusCounts.interview || 0, icon: CalendarClock },
      { label: 'Offers', value: statusCounts.offer || 0, icon: Sparkles },
    ];
  }, [favoriteApplications.length, visibleApplications]);

  const displayedApplications = activeView === 'favorites' ? favoriteApplications : visibleApplications;
  const preferenceChips = [
    preferences.role && { key: 'role', label: preferences.role, icon: BriefcaseBusiness },
    preferences.location && { key: 'location', label: preferences.location, icon: MapPin },
    preferences.jobType && { key: 'jobType', label: preferences.jobType, icon: SlidersHorizontal },
  ].filter(Boolean);
  const emptyMessage = activeView === 'favorites'
    ? 'No favorite jobs yet. Click the star icon to save jobs here.'
    : 'No queued jobs yet. Upload your resume and save preferences to start.';

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

    try {
      setSavingPreferences(true);
      setPreferencesStatus('');
      setPreferencesStatusType('info');

      const data = await requestJson(`${API_BASE_URL}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: preferences.role,
          location: preferences.location,
          jobType: preferences.jobType,
          minMatchScore: Number(preferences.minMatchScore),
        }),
      }, authToken, onSessionExpired);

      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...(data.preferences || preferences),
      });
      setSavingPreferences(false);
      setSearchingJobs(true);
      setPreferencesStatus('Preferences saved. Searching jobs...');

      const searchData = await requestJson(`${API_BASE_URL}/api/jobs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }, authToken, onSessionExpired);

      await fetchApplications();

      const queued = Number(searchData.queued || 0);
      const rejected = Number(searchData.rejected || 0);
      const rejectedReason = queued === 0 && rejected > 0
        ? ' Jobs were found but rejected due to low score.'
        : '';

      setPreferencesStatus(`Preferences saved. Search completed: ${queued} queued, ${rejected} rejected.${rejectedReason}`);
      setPreferencesStatusType('success');
    } catch (saveError) {
      setPreferencesStatus(saveError.message);
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
                <img src={LOGO_SRC} alt="" />
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
      <section className="job-queue-dashboard" aria-labelledby="job-queue-heading">
        <motion.div
          className="job-queue-dashboard__header"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div>
            <p className="job-queue-dashboard__eyebrow">
              <Sparkles size={16} />
              AI-matched opportunities
            </p>
            <div className="job-queue-dashboard__brand">
              <img src={LOGO_SRC} alt="Job Queue logo" />
              <h1 id="job-queue-heading">Job Queue</h1>
            </div>
            <p className="job-queue-dashboard__subtitle">
              Track matched roles, favorites, and application progress from one focused dashboard.
            </p>
          </div>
          <div className="job-queue-dashboard__header-actions">
            <button className="theme-toggle" type="button" onClick={onThemeToggle}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <div className="job-queue-dashboard__user">
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <button className="job-queue-dashboard__button job-queue-dashboard__button--secondary" type="button" onClick={onLogout}>
                <LogOut size={17} />
                Logout
              </button>
            </div>
          </div>
        </motion.div>

        <div className="job-queue-dashboard__stats">
          {dashboardStats.map((stat, index) => {
            const StatIcon = stat.icon;

            return (
              <motion.div
                className="job-queue-dashboard__stat"
                key={stat.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.05 + index * 0.05 }}
              >
                <span>
                  <StatIcon size={18} />
                </span>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </motion.div>
            );
          })}
        </div>

        <motion.form
          className="resume-upload"
          onSubmit={handleResumeUpload}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.12 }}
        >
          <div className="resume-upload__header">
            <div>
              <h2><FileUp size={20} /> Upload Resume</h2>
              <p>PDF only. Saved to your account.</p>
            </div>
            <button className="job-queue-dashboard__button" type="submit" disabled={uploadingResume}>
              <UploadCloud size={17} />
              {uploadingResume ? 'Uploading' : 'Upload Resume'}
            </button>
          </div>

          <label className="resume-upload__dropzone">
            <FileUp size={22} />
            <span>{resumeFile ? resumeFile.name : 'Choose PDF resume'}</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
          </label>

          {resumeStatus && (
            <div className={`resume-upload__status resume-upload__status--${resumeStatusType}`} role="status">
              {resumeStatus}
            </div>
          )}
        </motion.form>

        <motion.form
          className="job-preferences"
          onSubmit={handleSavePreferences}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.18 }}
        >
          <div className="job-preferences__header">
            <div>
              <h2><SlidersHorizontal size={20} /> Job Preferences</h2>
              <p>Saved to your account.</p>
              <p className="job-preferences__note">Upload your resume first to get accurate AI match scores.</p>
            </div>
            <button
              className="job-queue-dashboard__button"
              type="submit"
              disabled={savingPreferences || searchingJobs}
            >
              <Search size={17} />
              {searchingJobs ? 'Searching' : savingPreferences ? 'Saving' : 'Save Preferences'}
            </button>
          </div>

          <div className="job-preferences__grid">
            <label>
              Role
              <input
                type="text"
                value={preferences.role}
                onChange={(event) => updatePreferenceField('role', event.target.value)}
                placeholder="Frontend Developer"
              />
            </label>
            <label>
              Location
              <input
                type="text"
                value={preferences.location}
                onChange={(event) => updatePreferenceField('location', event.target.value)}
                placeholder="Remote, Bengaluru"
              />
            </label>
            <label>
              Job Type
              <input
                type="text"
                value={preferences.jobType}
                onChange={(event) => updatePreferenceField('jobType', event.target.value)}
                placeholder="Full-time"
              />
            </label>
            <label>
              Minimum Match Score
              <input
                type="number"
                min="0"
                max="100"
                value={preferences.minMatchScore}
                onChange={(event) => updatePreferenceField('minMatchScore', event.target.value)}
              />
            </label>
          </div>

          {preferencesStatus && (
            <div className={`job-preferences__status job-preferences__status--${preferencesStatusType}`} role="status">
              {preferencesStatus}
            </div>
          )}
        </motion.form>

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
          className="job-board-panel"
          aria-label="Job vacancies"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.22 }}
        >
          <div className="job-board-panel__header">
            <div>
              <p className="job-board-panel__eyebrow">
                <BriefcaseBusiness size={16} />
                Job Vacancies
              </p>
              <h2>{activeView === 'favorites' ? 'Favorite Jobs' : 'Recommended Jobs'}</h2>
              <p>
                {displayedApplications.length} active role{displayedApplications.length === 1 ? '' : 's'} matched to your queue.
              </p>
            </div>
            <div className="job-board-panel__chips" aria-label="Current preferences">
              {preferenceChips.length ? (
                preferenceChips.map((chip) => {
                  const ChipIcon = chip.icon;

                  return (
                    <span key={chip.key}>
                      <ChipIcon size={15} />
                      {chip.label}
                    </span>
                  );
                })
              ) : (
                <span>
                  <Sparkles size={15} />
                  Upload resume and save preferences
                </span>
              )}
            </div>
          </div>

          <div
            className="job-queue-dashboard__filters"
            role="tablist"
            aria-label="Job list filters"
          >
            <motion.button
              className={`job-queue-dashboard__filter ${activeView === 'all' ? 'job-queue-dashboard__filter--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeView === 'all'}
              onClick={() => setActiveView('all')}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <BriefcaseBusiness size={16} />
              All Jobs
              <span>{visibleApplications.length}</span>
            </motion.button>
            <motion.button
              className={`job-queue-dashboard__filter ${activeView === 'favorites' ? 'job-queue-dashboard__filter--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeView === 'favorites'}
              onClick={() => setActiveView('favorites')}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Heart size={16} />
              Favorites
              <span>{favoriteApplications.length}</span>
            </motion.button>
          </div>

          {!displayedApplications.length ? (
            <motion.div
              className="job-queue-dashboard__state job-queue-dashboard__state--empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <Star size={20} />
              {emptyMessage}
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

                  return (
                    <motion.article
                      className="job-card"
                      key={applicationId || `${details.applyUrl || details.title || 'job'}-${index}`}
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.24, delay: index * 0.035 }}
                      whileHover={{ y: -4 }}
                    >
                      <div className="job-card__top">
                        <div className="job-card__company">
                          <span className="job-card__logo">
                            <Building2 size={20} />
                          </span>
                          <div>
                            <strong>{details.company || application.company || 'Unknown company'}</strong>
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
                        <div className="job-card__badges">
                          <span>{details.jobType || application.jobType || 'Full-time'}</span>
                          {details.source && <span>{details.source}</span>}
                        </div>
                        <h3>{details.title || application.title || 'Untitled role'}</h3>
                        <p className="job-card__location">
                          <MapPin size={16} />
                          {details.location || application.location || 'Not specified'}
                        </p>
                      </div>

                      <div className="job-card__meta">
                        <span>
                          <Sparkles size={15} />
                          {application.matchScore ?? details.matchScore ?? 0}% match
                        </span>
                        <span>
                          <CalendarClock size={15} />
                          {STATUS_LABELS[currentStatus] || currentStatus}
                        </span>
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

        <motion.section
          className="job-board-cta"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.26 }}
        >
          <div>
            <p className="job-board-panel__eyebrow">
              <Sparkles size={16} />
              Next step
            </p>
            <h2>Keep your queue moving</h2>
            <p>Refresh your resume or tune preferences whenever your target role changes.</p>
          </div>
          <button
            className="job-queue-dashboard__button"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <Search size={17} />
            Update Search
          </button>
        </motion.section>
      </section>
      <SiteFooter />
    </motion.main>
  );
}
