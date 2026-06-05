const fs = require('fs/promises');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');

const RESUME_SECTION_NAMES = ['skills', 'projects', 'experience', 'education'];
const RESUME_SECTION_ALIASES = {
  skills: ['skills', 'technical skills', 'key skills', 'core skills', 'technologies'],
  projects: ['projects', 'academic projects', 'personal projects', 'professional projects'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'internships'],
  education: ['education', 'academic background', 'academics', 'qualification', 'qualifications'],
};

const DEFAULT_MATCH_WEIGHTS = {
  skills: 0.5,
  projects: 0.3,
  experience: 0.2,
};

const DEFAULT_MIN_MATCH_SCORE = 70;

const STOP_WORDS = new Set([
  'and',
  'are',
  'for',
  'from',
  'have',
  'job',
  'the',
  'this',
  'that',
  'with',
  'will',
  'work',
  'your',
]);

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    preferredRoles: {
      type: [String],
      default: [],
    },
    preferredLocations: {
      type: [String],
      default: [],
    },
    minMatchScore: {
      type: Number,
      default: DEFAULT_MIN_MATCH_SCORE,
    },
    rejectedCompanies: {
      type: [String],
      default: [],
    },
    preferredJobType: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

const UserPreference = mongoose.models.UserPreference
  || mongoose.model('UserPreference', userPreferenceSchema);

function normalizeResumeText(text) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getResumeSections(text) {
  const aliasToSection = new Map();
  Object.entries(RESUME_SECTION_ALIASES).forEach(([section, aliases]) => {
    aliases.forEach((alias) => aliasToSection.set(alias.toLowerCase(), section));
  });

  const headingPattern = [...aliasToSection.keys()].map(escapeRegExp).join('|');
  const headingRegex = new RegExp(`^\\s*(${headingPattern})\\s*:?\\s*$`, 'gim');
  const matches = [...text.matchAll(headingRegex)];
  const sections = Object.fromEntries(RESUME_SECTION_NAMES.map((name) => [name, '']));

  matches.forEach((match, index) => {
    const sectionName = aliasToSection.get(match[1].toLowerCase());
    const start = match.index + match[0].length;
    const end = matches[index + 1] ? matches[index + 1].index : text.length;
    sections[sectionName] = text.slice(start, end).trim();
  });

  return sections;
}

function splitResumeLines(sectionText) {
  return sectionText
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);
}

function parseSkills(sectionText) {
  if (!sectionText) return [];

  const commonLabels = /^(languages|frameworks|tools|databases|technologies|frontend|backend)\s*:\s*/i;

  return [...new Set(
    sectionText
      .split(/[,;|/\n]+/)
      .map((skill) => skill.replace(commonLabels, '').trim())
      .filter(Boolean),
  )];
}

function parseProjects(sectionText) {
  if (!sectionText) return [];

  const lines = splitResumeLines(sectionText);
  const projects = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const colonMatch = line.match(/^(.{2,80}?):\s*(.+)$/);
    const dashMatch = line.match(/^(.{2,80}?)\s+[-–—]\s+(.+)$/);

    if (colonMatch || dashMatch) {
      const match = colonMatch || dashMatch;
      projects.push({
        name: match[1].trim(),
        description: match[2].trim(),
      });
      continue;
    }

    if (line.length <= 80 && lines[index + 1]) {
      projects.push({
        name: line,
        description: lines[index + 1],
      });
      index += 1;
    }
  }

  return projects;
}

function parseExperience(sectionText) {
  if (!sectionText) return [];

  return splitResumeLines(sectionText).map((line) => {
    const durationMatch = line.match(
      /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4})\s*(?:-|–|—|to)\s*((?:present|current|now)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4})\b/i,
    );
    const duration = durationMatch ? durationMatch[0].trim() : '';
    const withoutDuration = duration ? line.replace(durationMatch[0], '').trim() : line;
    const parts = withoutDuration
      .split(/\s+[-–—|]\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      company: parts[1] || parts[0] || '',
      role: parts[1] ? parts[0] : '',
      duration,
    };
  });
}

function parseEducation(sectionText) {
  if (!sectionText) return [];

  return splitResumeLines(sectionText).map((line) => {
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : null;
    const withoutYear = yearMatch ? line.replace(yearMatch[0], '').trim() : line;
    const parts = withoutYear
      .split(/\s+[-–—|,]\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      degree: parts[0] || '',
      institution: parts.slice(1).join(', ') || '',
      year,
    };
  });
}

async function parseResume(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const parsedPdf = await pdfParse(fileBuffer);
    const sections = getResumeSections(normalizeResumeText(parsedPdf.text || ''));

    return {
      skills: parseSkills(sections.skills),
      projects: parseProjects(sections.projects),
      experience: parseExperience(sections.experience),
      education: parseEducation(sections.education),
    };
  } catch (error) {
    throw new Error(`Failed to parse resume "${filePath}": ${error.message}`);
  }
}

async function searchJobs({ role, location, minExperience, jobType }) {
  try {
    const response = await axios.get('https://api.example.com/jobs', {
      params: {
        role,
        location,
        minExperience,
        jobType,
      },
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Jobs API returned an unexpected response format.');
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Jobs API error ${error.response.status}: ${JSON.stringify(error.response.data)}`,
      );
    }

    throw new Error(`Failed to search jobs: ${error.message}`);
  }
}

function cleanDomText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function ensureDocument() {
  if (typeof document === 'undefined') {
    throw new Error('extractJobDetails must run in a browser content script with DOM access.');
  }
}

function absoluteUrl(value) {
  if (!value) return '';

  try {
    return new URL(value, window.location.href).href;
  } catch (_error) {
    return '';
  }
}

function safeQuerySelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (_error) {
    return null;
  }
}

function safeQuerySelectorAll(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (_error) {
    return [];
  }
}

function getMetaContent(selectors) {
  for (const selector of selectors) {
    const element = safeQuerySelector(selector);
    const content = cleanDomText(element && element.getAttribute('content'));

    if (content) return content;
  }

  return '';
}

function getTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const element = safeQuerySelector(selector);
    const text = cleanDomText(element && element.textContent);

    if (text) return text;
  }

  return '';
}

function getJobDescription() {
  const description = getTextFromSelectors([
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
    '[data-test-description]',
    '[data-testid="job-description"]',
    '[data-automation="jobDescription"]',
    '.job-desc',
    '.job-description',
    '.jobDescription',
    '#job-description',
    '#jobDescription',
    '.description',
    'section[aria-label*="description" i]',
  ]);

  if (description) return description;

  return getMetaContent([
    'meta[name="description"]',
    'meta[property="og:description"]',
  ]);
}

function getApplyUrl() {
  const applySelectors = [
    '.jobs-apply-button',
    'button.jobs-apply-button',
    'a.jobs-apply-button',
    'a[data-control-name*="apply" i]',
    'a[data-testid*="apply" i]',
    'a[href*="apply" i]',
    'button[aria-label*="apply" i]',
    'a[aria-label*="apply" i]',
    'button:has(span)',
  ];

  for (const selector of applySelectors) {
    const elements = safeQuerySelectorAll(selector);

    for (const element of elements) {
      const text = cleanDomText(element.textContent || element.getAttribute('aria-label'));
      const href = element.href || element.getAttribute('href') || element.dataset.href;

      if (/apply/i.test(text) || /apply/i.test(href || '')) {
        return absoluteUrl(href) || window.location.href;
      }
    }
  }

  const applyByText = safeQuerySelectorAll('a, button').find((element) => {
    return /apply/i.test(cleanDomText(element.textContent || element.getAttribute('aria-label')));
  });

  if (!applyByText) return '';

  return absoluteUrl(applyByText.href || applyByText.getAttribute('href')) || window.location.href;
}

function inferJobSkills(description) {
  const skillSectionMatch = description.match(
    /(?:skills|required skills|technical skills|requirements|key skills)\s*:?\s*([\s\S]{0,800})/i,
  );
  const source = skillSectionMatch ? skillSectionMatch[1] : description;
  const bulletSkills = source
    .split(/\n|•|●|▪|·|\u2022/g)
    .map(cleanDomText)
    .filter((item) => item.length >= 2 && item.length <= 80);

  const commaSkills = source
    .split(/,|;|\||\/|\s+-\s+/g)
    .map(cleanDomText)
    .filter((item) => item.length >= 2 && item.length <= 40);

  const knownSkillPattern = /\b(JavaScript|TypeScript|React(?:\.js)?|Angular|Vue(?:\.js)?|Node(?:\.js)?|Express(?:\.js)?|MongoDB|SQL|MySQL|PostgreSQL|Python|Java|C\+\+|C#|HTML|CSS|Tailwind|Bootstrap|AWS|Azure|Docker|Kubernetes|Git|REST|GraphQL|Redux|Next(?:\.js)?|PHP|Laravel|Django|Flask|Spring Boot)\b/gi;
  const knownSkills = [...source.matchAll(knownSkillPattern)].map((match) => cleanDomText(match[0]));

  return [...new Set([...knownSkills, ...bulletSkills, ...commaSkills])]
    .map((skill) => skill.replace(/^(skills|required skills|technical skills|requirements|key skills)\s*:?\s*/i, ''))
    .filter((skill) => skill && !/[.!?]$/.test(skill) && skill.split(' ').length <= 6)
    .slice(0, 30);
}

async function extractJobDetails() {
  ensureDocument();

  const title = getTextFromSelectors([
    '.jobs-unified-top-card__job-title',
    '.top-card-layout__title',
    '[data-test-job-title]',
    '[data-testid="job-title"]',
    '[data-automation="job-detail-title"]',
    '.jd-header-title',
    '.job-title',
    '.title',
    'h1',
  ]) || getMetaContent(['meta[property="og:title"]']);

  const company = getTextFromSelectors([
    '.jobs-unified-top-card__company-name',
    '.topcard__org-name-link',
    '[data-test-employer-name]',
    '[data-testid="company-name"]',
    '[data-automation="advertiser-name"]',
    '.jd-header-comp-name',
    '.company-name',
    '.company',
  ]);

  const location = getTextFromSelectors([
    '.jobs-unified-top-card__bullet',
    '.topcard__flavor--bullet',
    '[data-test-job-location]',
    '[data-testid="job-location"]',
    '[data-automation="job-detail-location"]',
    '.location',
    '.job-location',
    '.loc',
  ]);

  const description = getJobDescription();
  const applyUrl = getApplyUrl();

  return {
    title,
    company,
    location,
    description,
    skills: inferJobSkills(description),
    applyUrl,
  };
}

function normalizeMatchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : []).map(normalizeMatchText).filter(Boolean);
}

function clampScore(value) {
  return Math.max(0, Math.min(1, value));
}

function getKeywords(text) {
  return [...new Set(
    normalizeMatchText(text)
      .split(' ')
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )].slice(0, 40);
}

function getWeightedConfig(weights = {}) {
  const merged = { ...DEFAULT_MATCH_WEIGHTS, ...weights };
  const total = Object.values(merged).reduce((sum, value) => sum + Number(value || 0), 0);

  if (total <= 0) return DEFAULT_MATCH_WEIGHTS;

  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, Number(value || 0) / total]),
  );
}

function calculateSkillScore(resumeSkills, jobSkills) {
  const requiredSkills = normalizeList(jobSkills);
  const candidateSkills = normalizeList(resumeSkills);

  if (!requiredSkills.length) return 0;

  const matched = requiredSkills.filter((requiredSkill) => {
    return candidateSkills.some((candidateSkill) => {
      return candidateSkill === requiredSkill
        || candidateSkill.includes(requiredSkill)
        || requiredSkill.includes(candidateSkill);
    });
  });

  return matched.length / requiredSkills.length;
}

function calculateProjectScore(projects, jobDescription) {
  const keywords = getKeywords(jobDescription);
  const resumeProjects = Array.isArray(projects) ? projects : [];

  if (!keywords.length || !resumeProjects.length) return 0;

  const matchedProjects = resumeProjects.filter((project) => {
    const text = normalizeMatchText(`${project.name || ''} ${project.description || ''}`);
    return keywords.some((keyword) => text.includes(keyword));
  });

  return matchedProjects.length / resumeProjects.length;
}

function calculateExperienceScore(experience, jobDetails) {
  const resumeExperience = Array.isArray(experience) ? experience : [];
  const jobText = normalizeMatchText(`${jobDetails.title || ''} ${jobDetails.role || ''} ${jobDetails.description || ''}`);

  if (!resumeExperience.length || !jobText) return 0;

  const jobKeywords = getKeywords(jobText);
  const matchedExperience = resumeExperience.filter((item) => {
    const roleText = normalizeMatchText(`${item.role || ''} ${item.company || ''}`);
    return jobKeywords.some((keyword) => roleText.includes(keyword));
  });

  return matchedExperience.length ? 1 : 0;
}

async function calculateMatchScore(resumeData, jobDetails, weights = {}) {
  const safeResume = resumeData || {};
  const safeJob = jobDetails || {};
  const weightedConfig = getWeightedConfig(weights);

  const skillsScore = calculateSkillScore(safeResume.skills, safeJob.skills || safeJob.skillsRequired);
  const projectsScore = calculateProjectScore(safeResume.projects, safeJob.description);
  const experienceScore = calculateExperienceScore(safeResume.experience, safeJob);
  const score = (
    skillsScore * weightedConfig.skills
    + projectsScore * weightedConfig.projects
    + experienceScore * weightedConfig.experience
  );

  return Math.round(clampScore(score) * 100);
}

async function processJob(job, resumeData, threshold = DEFAULT_MIN_MATCH_SCORE, db, precomputedMatchScore) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('A connected MongoDB database instance must be passed as db.');
  }

  if (!job || typeof job !== 'object') {
    throw new Error('job must be an object.');
  }

  const matchScore = typeof precomputedMatchScore === 'number'
    ? precomputedMatchScore
    : await calculateMatchScore(resumeData, job);
  const status = matchScore >= threshold ? 'queued' : 'rejected';
  const collectionName = status === 'queued' ? 'jobQueue' : 'rejectedJobs';
  const document = {
    userId: job.userId || (resumeData && resumeData.userId) || null,
    jobDetails: job,
    matchScore,
    status,
    createdAt: new Date(),
  };

  const result = await db.collection(collectionName).insertOne(document);

  return {
    status,
    document: {
      _id: result.insertedId,
      ...document,
    },
  };
}

function getDefaultPreferences(userId) {
  return {
    userId,
    preferredRoles: [],
    preferredLocations: [],
    minMatchScore: DEFAULT_MIN_MATCH_SCORE,
    rejectedCompanies: [],
    preferredJobType: '',
  };
}

function pickAllowedPreferenceUpdates(updates = {}) {
  const allowedFields = [
    'preferredRoles',
    'preferredLocations',
    'minMatchScore',
    'rejectedCompanies',
    'preferredJobType',
  ];

  return allowedFields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      picked[field] = updates[field];
    }

    return picked;
  }, {});
}

async function getPreferences(userId) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  try {
    const preferences = await UserPreference.findOne({ userId }).lean();
    return preferences || getDefaultPreferences(userId);
  } catch (error) {
    throw new Error(`Failed to retrieve user preferences: ${error.message}`);
  }
}

async function updatePreferences(userId, updates) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  try {
    const allowedUpdates = pickAllowedPreferenceUpdates(updates);
    let preferences = await UserPreference.findOne({ userId });

    if (!preferences) {
      preferences = new UserPreference(getDefaultPreferences(userId));
    }

    Object.assign(preferences, allowedUpdates);
    await preferences.save();

    return preferences.toObject();
  } catch (error) {
    throw new Error(`Failed to update user preferences: ${error.message}`);
  }
}

function getFirstPreferenceValue(values, fallback) {
  return Array.isArray(values) && values.length ? values[0] : fallback;
}

function resolveAgentDb(db) {
  if (db && typeof db.collection === 'function') {
    return db;
  }

  if (mongoose.connection && mongoose.connection.db) {
    return mongoose.connection.db;
  }

  throw new Error('A connected MongoDB database instance is required to process jobs.');
}

async function jobSearchAgent({ userId, resumePath, role, location, minScore, jobType, db }) {
  if (!userId) {
    throw new Error('userId is required.');
  }

  if (!resumePath) {
    throw new Error('resumePath is required.');
  }

  const summary = {
    queuedCount: 0,
    rejectedCount: 0,
    queuedIds: [],
    rejectedIds: [],
    errors: [],
  };

  try {
    const resumeData = await parseResume(resumePath);
    const preferences = await getPreferences(userId);
    const hasSavedPreferences = Boolean(preferences && preferences._id);
    const searchRole = hasSavedPreferences
      ? getFirstPreferenceValue(preferences.preferredRoles, role)
      : role;
    const searchLocation = hasSavedPreferences
      ? getFirstPreferenceValue(preferences.preferredLocations, location)
      : location;
    const searchJobType = hasSavedPreferences && preferences.preferredJobType
      ? preferences.preferredJobType
      : jobType;
    const threshold = hasSavedPreferences && typeof preferences.minMatchScore === 'number'
      ? preferences.minMatchScore
      : Number(minScore ?? DEFAULT_MIN_MATCH_SCORE);
    const agentDb = resolveAgentDb(db);
    const jobs = await searchJobs({
      role: searchRole,
      location: searchLocation,
      jobType: searchJobType,
    });

    for (const job of jobs) {
      try {
        const matchScore = await calculateMatchScore(resumeData, job);

        const processed = await processJob(
          { ...job, userId },
          { ...resumeData, userId },
          threshold,
          agentDb,
          matchScore,
        );
        const insertedId = processed.document && processed.document._id;

        if (processed.status === 'queued') {
          summary.queuedCount += 1;
          summary.queuedIds.push(insertedId);
        } else {
          summary.rejectedCount += 1;
          summary.rejectedIds.push(insertedId);
        }
      } catch (error) {
        console.error('Failed to process job:', error);
        summary.errors.push({
          jobTitle: job && job.title,
          company: job && job.company,
          message: error.message,
        });
      }
    }

    return summary;
  } catch (error) {
    console.error('Failed to run job search agent:', error);
    throw error;
  }
}

function safeCoverLetterText(value, fallback = 'Not specified') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function summarizeCoverLetterProjects(projects = []) {
  return projects
    .slice(0, 3)
    .map((project) => {
      return `${safeCoverLetterText(project.name, 'Project')}: ${safeCoverLetterText(project.description, '')}`.trim();
    })
    .filter(Boolean)
    .join('\n');
}

function summarizeCoverLetterExperience(experience = []) {
  return experience
    .slice(0, 3)
    .map((item) => {
      const role = safeCoverLetterText(item.role, 'Role not specified');
      const company = safeCoverLetterText(item.company, 'company not specified');
      const duration = safeCoverLetterText(item.duration, 'duration not specified');
      return `${role} at ${company} (${duration})`;
    })
    .filter(Boolean)
    .join('\n');
}

function getCoverLetterSkillsText(skills) {
  return Array.isArray(skills) && skills.length ? skills.join(', ') : 'Not specified';
}

function buildCoverLetterPrompt(resumeData = {}, jobDetails = {}) {
  const jobSkills = jobDetails.skills || jobDetails.skillsRequired;

  return `
Write a polite, concise cover letter limited to 250 words.
Use only the applicant information and target job details provided below.
Do not invent experience, companies, degrees, achievements, or skills.
If information is missing, keep the letter general and truthful.
Return only the cover letter text.

Applicant skills:
${getCoverLetterSkillsText(resumeData.skills)}

Applicant projects:
${summarizeCoverLetterProjects(resumeData.projects || []) || 'Not specified'}

Applicant experience:
${summarizeCoverLetterExperience(resumeData.experience || []) || 'Not specified'}

Target job:
Title: ${safeCoverLetterText(jobDetails.title)}
Company: ${safeCoverLetterText(jobDetails.company)}
Location: ${safeCoverLetterText(jobDetails.location)}
Required skills: ${getCoverLetterSkillsText(jobSkills)}
Description: ${safeCoverLetterText(jobDetails.description)}
`.trim();
}

function buildFallbackCoverLetter(resumeData = {}, jobDetails = {}) {
  const skills = Array.isArray(resumeData.skills) ? resumeData.skills.slice(0, 5) : [];
  const projects = Array.isArray(resumeData.projects) ? resumeData.projects.slice(0, 2) : [];
  const experience = Array.isArray(resumeData.experience) ? resumeData.experience.slice(0, 2) : [];
  const title = safeCoverLetterText(jobDetails.title, 'the open role');
  const company = safeCoverLetterText(jobDetails.company, 'your company');
  const skillsSentence = skills.length
    ? ` My background includes ${skills.join(', ')}, which aligns with the needs of this role.`
    : '';
  const projectSentence = projects.length
    ? ` I have applied these abilities in projects such as ${projects.map((project) => safeCoverLetterText(project.name, 'a relevant project')).join(', ')}.`
    : '';
  const experienceSentence = experience.length
    ? ` My experience includes ${experience.map((item) => {
      return `${safeCoverLetterText(item.role, 'a role')} at ${safeCoverLetterText(item.company, 'an organization')}`;
    }).join(', ')}.`
    : '';

  return `
Dear Hiring Team,

I am writing to express my interest in ${title} at ${company}.${skillsSentence}${projectSentence}${experienceSentence}

I would welcome the opportunity to discuss how my background can contribute to this role. Thank you for your time and consideration.

Sincerely,
The Applicant
`.trim();
}

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 450,
    },
  });
}

async function generateCoverLetter(resumeData, jobDetails) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(buildCoverLetterPrompt(resumeData, jobDetails));
    const coverLetter = result.response && typeof result.response.text === 'function'
      ? result.response.text()
      : '';

    return safeCoverLetterText(coverLetter, buildFallbackCoverLetter(resumeData, jobDetails));
  } catch (error) {
    console.error('Gemini cover letter generation failed:', error.message);
    return buildFallbackCoverLetter(resumeData, jobDetails);
  }
}

module.exports = {
  parseResume,
  searchJobs,
  extractJobDetails,
  calculateMatchScore,
  processJob,
  getPreferences,
  updatePreferences,
  jobSearchAgent,
  generateCoverLetter,
};
