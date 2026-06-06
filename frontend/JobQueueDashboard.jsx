import React, { useEffect, useMemo, useState } from 'react';

import API_BASE_URL from './src/config/api.js';

function getJobId(job) {
  return job._id || job.id || job.jobId || (job.jobDetails && (job.jobDetails._id || job.jobDetails.id));
}

function getJobDetails(job) {
  return job.jobDetails || job;
}

function normalizeJobs(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.queue)) return payload.queue;
  return [];
}

async function requestJson(url, options) {
  const requestUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  let response;

  try {
    response = await fetch(requestUrl, options);
  } catch (error) {
    throw new Error(`Unable to reach backend at ${API_BASE_URL}. ${error.message}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export default function JobQueueDashboard({ userId }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [coverLetters, setCoverLetters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  const queueUrl = useMemo(() => {
    if (!userId) return '/api/queue';
    return `/api/queue?userId=${encodeURIComponent(userId)}`;
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchQueuedJobs() {
      try {
        setLoading(true);
        setError('');

        const data = await requestJson(queueUrl);
        const queuedJobs = normalizeJobs(data).filter((job) => job.status !== 'applied');

        if (isMounted) {
          setJobs(queuedJobs);
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchQueuedJobs();

    return () => {
      isMounted = false;
    };
  }, [queueUrl]);

  function setJobActionLoading(jobId, action, value) {
    setActionLoading((current) => ({
      ...current,
      [`${jobId}:${action}`]: value,
    }));
  }

  function isActionLoading(jobId, action) {
    return Boolean(actionLoading[`${jobId}:${action}`]);
  }

  async function handleGenerateCoverLetter(job) {
    const jobId = getJobId(job);

    if (!jobId) {
      setError('Cannot generate a cover letter because this job is missing an ID.');
      return;
    }

    try {
      setJobActionLoading(jobId, 'coverLetter', true);
      setError('');

      const data = await requestJson('/api/cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          jobId,
          jobDetails: getJobDetails(job),
        }),
      });

      setCoverLetters((current) => ({
        ...current,
        [jobId]: data.coverLetter || data.text || '',
      }));
    } catch (coverLetterError) {
      setError(coverLetterError.message);
    } finally {
      setJobActionLoading(jobId, 'coverLetter', false);
    }
  }

  async function handleMarkApplied(job) {
    const jobId = getJobId(job);

    if (!jobId) {
      setError('Cannot update this application because this job is missing an ID.');
      return;
    }

    try {
      setJobActionLoading(jobId, 'applied', true);
      setError('');

      await requestJson(`/api/applications/${encodeURIComponent(jobId)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'applied',
        }),
      });

      setJobs((currentJobs) => currentJobs.filter((currentJob) => getJobId(currentJob) !== jobId));
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setJobActionLoading(jobId, 'applied', false);
    }
  }

  if (loading) {
    return <div className="job-queue-dashboard__state">Loading queued jobs...</div>;
  }

  return (
    <section className="job-queue-dashboard" aria-labelledby="job-queue-heading">
      <div className="job-queue-dashboard__header">
        <h2 id="job-queue-heading">Job Queue</h2>
        <span>{jobs.length} queued</span>
      </div>

      {error && (
        <div className="job-queue-dashboard__error" role="alert">
          {error}
        </div>
      )}

      {!jobs.length ? (
        <div className="job-queue-dashboard__state">No queued jobs found.</div>
      ) : (
        <div className="job-queue-dashboard__table-wrap">
          <table className="job-queue-dashboard__table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Location</th>
                <th>Match Score</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => {
                const details = getJobDetails(job);
                const jobId = getJobId(job);
                const rowKey = jobId || `${details.title || 'job'}-${details.company || 'company'}-${index}`;
                const coverLetter = coverLetters[jobId];

                return (
                  <React.Fragment key={rowKey}>
                    <tr>
                      <td>{details.title || job.title || 'Untitled role'}</td>
                      <td>{details.company || job.company || 'Unknown company'}</td>
                      <td>{details.location || job.location || 'Not specified'}</td>
                      <td>{job.matchScore ?? details.matchScore ?? 0}%</td>
                      <td>{job.status || 'queued'}</td>
                      <td>
                        <div className="job-queue-dashboard__actions">
                          <button type="button" onClick={() => setSelectedJob(job)}>
                            View
                          </button>
                          <button
                            type="button"
                            disabled={!jobId || isActionLoading(jobId, 'coverLetter')}
                            onClick={() => handleGenerateCoverLetter(job)}
                          >
                            {isActionLoading(jobId, 'coverLetter') ? 'Generating' : 'Cover Letter'}
                          </button>
                          <button
                            type="button"
                            disabled={!jobId || isActionLoading(jobId, 'applied') || job.status === 'applied'}
                            onClick={() => handleMarkApplied(job)}
                          >
                            {isActionLoading(jobId, 'applied') ? 'Saving' : 'Applied'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {coverLetter && (
                      <tr className="job-queue-dashboard__cover-letter">
                        <td colSpan="6">
                          <pre>{coverLetter}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedJob && (
        <div className="job-queue-dashboard__details" role="dialog" aria-modal="true">
          <div className="job-queue-dashboard__details-header">
            <h3>{getJobDetails(selectedJob).title || 'Job Details'}</h3>
            <button type="button" onClick={() => setSelectedJob(null)}>
              Close
            </button>
          </div>
          <p>
            <strong>Company:</strong> {getJobDetails(selectedJob).company || 'Unknown company'}
          </p>
          <p>
            <strong>Location:</strong> {getJobDetails(selectedJob).location || 'Not specified'}
          </p>
          <p>{getJobDetails(selectedJob).description || 'No description available.'}</p>
        </div>
      )}
    </section>
  );
}
