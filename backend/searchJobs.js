const axios = require('axios');

const DEFAULT_JSEARCH_HOST = 'jsearch.p.rapidapi.com';
const KNOWN_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Redux',
  'Next.js',
  'Vue',
  'Angular',
  'Node.js',
  'Express.js',
  'MongoDB',
  'PostgreSQL',
  'MySQL',
  'SQL',
  'Python',
  'Django',
  'Flask',
  'Java',
  'Spring Boot',
  'HTML',
  'CSS',
  'Tailwind',
  'Bootstrap',
  'REST',
  'GraphQL',
  'AWS',
  'Docker',
  'Git',
];

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeJobType(value) {
  const normalized = normalize(value).replace(/\s+/g, '_');

  if (!normalized) return '';
  if (normalized.includes('full')) return 'Full-time';
  if (normalized.includes('part')) return 'Part-time';
  if (normalized.includes('contract')) return 'Contract';
  if (normalized.includes('freelance')) return 'Freelance';
  if (normalized.includes('intern')) return 'Internship';

  return String(value || '').replace(/_/g, ' ').trim();
}

function matchesJobType(jobType, preferredJobType) {
  if (!preferredJobType) return true;

  const normalizedJobType = normalize(jobType);
  const normalizedPreference = normalize(preferredJobType);

  if (!normalizedJobType) return true;

  return normalizedJobType.includes(normalizedPreference)
    || normalizedPreference.includes(normalizedJobType);
}

function extractSkillsFromText(title, description) {
  const searchableText = normalize(`${title || ''} ${stripHtml(description)}`);

  return KNOWN_SKILLS.filter((skill) => {
    return searchableText.includes(normalize(skill));
  });
}

function buildJSearchQuery(role, location) {
  const safeRole = String(role || 'Software Developer').trim();
  const safeLocation = String(location || 'India').trim();

  return `${safeRole} in ${safeLocation}`;
}

function normalizeJSearchJob(job, preferences = {}) {
  const title = job.job_title || '';
  const description = stripHtml(job.job_description);
  const applyUrl = job.job_apply_link || '';

  if (!applyUrl) {
    return null;
  }

  return {
    title,
    company: job.employer_name || '',
    location: job.job_city || job.job_country || preferences.location || '',
    jobType: normalizeJobType(job.job_employment_type || preferences.jobType),
    skills: extractSkillsFromText(title, description),
    description,
    applyUrl,
    source: 'JSearch',
    originalJobId: job.job_id || '',
  };
}

function normalizeRemotiveJob(job, preferences = {}) {
  const title = job.title || '';
  const description = stripHtml(job.description);
  const preferredLocation = normalize(preferences.location);
  const location = preferredLocation === 'remote'
    ? job.candidate_required_location || 'Remote'
    : 'Remote';
  const applyUrl = job.url || '';

  if (!applyUrl) {
    return null;
  }

  return {
    title,
    company: job.company_name || '',
    location,
    jobType: normalizeJobType(job.job_type || preferences.jobType),
    skills: extractSkillsFromText(title, description),
    description,
    applyUrl,
    source: 'Remotive',
    originalJobId: job.id ? String(job.id) : '',
  };
}

function logFirstJSearchJob(job) {
  if (!job) return;

  console.log('First normalized JSearch job:', {
    title: job.title,
    company: job.company,
    location: job.location,
    applyUrl: job.applyUrl,
    source: job.source,
  });
}

async function fetchJSearchJobs(preferences) {
  if (!process.env.JSEARCH_API_KEY) {
    return {
      jobs: [],
      skipped: true,
      reason: 'JSEARCH_API_KEY is missing.',
    };
  }

  const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
    params: {
      query: buildJSearchQuery(preferences.role, preferences.location),
      page: 1,
      num_pages: 1,
      country: 'in',
      date_posted: 'month',
    },
    headers: {
      'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
      'X-RapidAPI-Host': process.env.JSEARCH_API_HOST || DEFAULT_JSEARCH_HOST,
    },
  });

  if (!response.data || !Array.isArray(response.data.data)) {
    throw new Error('JSearch API returned an unexpected response format.');
  }

  const jobs = response.data.data
    .map((job) => normalizeJSearchJob(job, preferences))
    .filter(Boolean)
    .filter((job) => matchesJobType(job.jobType, preferences.jobType));

  logFirstJSearchJob(jobs[0]);

  return {
    jobs,
    skipped: false,
    reason: '',
  };
}

async function fetchRemotiveJobs(preferences) {
  const response = await axios.get('https://remotive.com/api/remote-jobs', {
    params: {
      search: preferences.role || '',
    },
  });

  if (!response.data || !Array.isArray(response.data.jobs)) {
    throw new Error('Remotive API returned an unexpected response format.');
  }

  return response.data.jobs
    .map((job) => normalizeRemotiveJob(job, preferences))
    .filter(Boolean)
    .filter((job) => matchesJobType(job.jobType, preferences.jobType));
}

async function searchJobs(preferences = {}) {
  let fallbackUsed = false;
  let fallbackReason = '';

  try {
    const jSearchResult = await fetchJSearchJobs(preferences);

    if (jSearchResult.jobs.length) {
      return {
        jobs: jSearchResult.jobs,
        primarySource: 'JSearch',
        fallbackUsed: false,
        fallbackReason: '',
        fetchedCount: jSearchResult.jobs.length,
      };
    }

    fallbackUsed = true;
    fallbackReason = jSearchResult.skipped ? jSearchResult.reason : 'JSearch returned zero usable jobs.';
  } catch (error) {
    fallbackUsed = true;
    fallbackReason = error.response
      ? `JSearch API error ${error.response.status}.`
      : error.message;
    console.warn('JSearch unavailable; falling back to Remotive:', fallbackReason);
  }

  const remotiveJobs = await fetchRemotiveJobs(preferences);

  return {
    jobs: remotiveJobs,
    primarySource: 'JSearch',
    fallbackUsed,
    fallbackReason,
    fetchedCount: remotiveJobs.length,
  };
}

module.exports = searchJobs;
module.exports.extractSkillsFromText = extractSkillsFromText;
