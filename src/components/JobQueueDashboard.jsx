import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = 'http://localhost:9000';
const DEFAULT_PREFERENCES = {
  role: '',
  location: '',
  jobType: '',
  minMatchScore: 70,
};
const VISIBLE_STATUSES = new Set(['queued', 'applied', 'interview', 'offer']);
const STATUS_OPTIONS = ['queued', 'applied', 'interview', 'rejected', 'offer'];

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

  const displayedApplications = activeView === 'favorites' ? favoriteApplications : visibleApplications;
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
      <main className={`app-shell ${theme === 'dark' ? 'dark' : ''}`}>
        <section className="job-queue-dashboard">
          <div className="job-queue-dashboard__state">Loading applications...</div>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${theme === 'dark' ? 'dark' : ''}`}>
      <section className="job-queue-dashboard" aria-labelledby="job-queue-heading">
        <div className="job-queue-dashboard__header">
          <div>
            <h1 id="job-queue-heading">Agentic Job Queue</h1>
          </div>
          <div className="job-queue-dashboard__header-actions">
            <button
              className="job-queue-dashboard__button job-queue-dashboard__button--secondary"
              type="button"
              onClick={onThemeToggle}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <div className="job-queue-dashboard__user">
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <button className="job-queue-dashboard__button job-queue-dashboard__button--secondary" type="button" onClick={onLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>

        <form className="resume-upload" onSubmit={handleResumeUpload}>
          <div className="resume-upload__header">
            <div>
              <h2>Upload Resume</h2>
              <p>PDF only. Saved to your account.</p>
            </div>
            <button className="job-queue-dashboard__button" type="submit" disabled={uploadingResume}>
              {uploadingResume ? 'Uploading' : 'Upload Resume'}
            </button>
          </div>

          <label className="resume-upload__dropzone">
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
        </form>

        <form className="job-preferences" onSubmit={handleSavePreferences}>
          <div className="job-preferences__header">
            <div>
              <h2>Job Preferences</h2>
              <p>Saved to your account.</p>
              <p className="job-preferences__note">Upload your resume first to get accurate AI match scores.</p>
            </div>
            <button
              className="job-queue-dashboard__button"
              type="submit"
              disabled={savingPreferences || searchingJobs}
            >
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
        </form>

        {error && (
          <div className="job-queue-dashboard__error" role="alert">
            {error}
          </div>
        )}

        <div className="job-queue-dashboard__filters" role="tablist" aria-label="Job list filters">
          <button
            className={`job-queue-dashboard__filter ${activeView === 'all' ? 'job-queue-dashboard__filter--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeView === 'all'}
            onClick={() => setActiveView('all')}
          >
            All Jobs
            <span>{visibleApplications.length}</span>
          </button>
          <button
            className={`job-queue-dashboard__filter ${activeView === 'favorites' ? 'job-queue-dashboard__filter--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeView === 'favorites'}
            onClick={() => setActiveView('favorites')}
          >
            Favorites
            <span>{favoriteApplications.length}</span>
          </button>
        </div>

        {!displayedApplications.length ? (
          <div className="job-queue-dashboard__state">{emptyMessage}</div>
        ) : (
          <div className="job-queue-dashboard__table-wrap">
            <table className="job-queue-dashboard__table">
              <thead>
                <tr>
                  <th>Save</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Match Score</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedApplications.map((application) => {
                  const details = getJobDetails(application);
                  const applicationId = getApplicationId(application);
                  const applyUrl = application.jobDetails?.applyUrl;
                  const currentStatus = application.status || 'queued';
                  const isTogglingFavorite = togglingFavoriteId === applicationId;

                  return (
                    <tr key={applicationId}>
                      <td>
                        <button
                          className={`job-queue-dashboard__favorite ${application.isFavorite ? 'job-queue-dashboard__favorite--active' : ''}`}
                          type="button"
                          aria-label={application.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          aria-pressed={Boolean(application.isFavorite)}
                          disabled={!applicationId || isTogglingFavorite}
                          onClick={() => handleToggleFavorite(application)}
                        >
                          {application.isFavorite ? '★' : '☆'}
                        </button>
                      </td>
                      <td>
                        <div className="job-queue-dashboard__title">
                          {details.title || application.title || 'Untitled role'}
                        </div>
                        {details.source && (
                          <span className="job-queue-dashboard__source-badge">{details.source}</span>
                        )}
                      </td>
                      <td>{details.company || application.company || 'Unknown company'}</td>
                      <td className="job-queue-dashboard__muted">
                        {details.location || application.location || 'Not specified'}
                      </td>
                      <td>
                        <span className="job-queue-dashboard__score">
                          {application.matchScore ?? details.matchScore ?? 0}%
                        </span>
                      </td>
                      <td>
                        <select
                          className="job-queue-dashboard__status-select"
                          value={currentStatus}
                          disabled={!applicationId || updatingStatusId === applicationId}
                          onChange={(event) => handleStatusChange(application, event.target.value)}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="job-queue-dashboard__muted">{formatDate(application.createdAt)}</td>
                      <td>
                        {applyUrl ? (
                          <a
                            className="job-queue-dashboard__button"
                            href={applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Apply Now
                          </a>
                        ) : (
                          <span className="job-queue-dashboard__muted">No link available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
