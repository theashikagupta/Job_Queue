const { GoogleGenerativeAI } = require('@google/generative-ai');

function safeText(value, fallback = 'Not specified') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function summarizeProjects(projects = []) {
  return projects
    .slice(0, 3)
    .map((project) => {
      return `${safeText(project.name, 'Project')}: ${safeText(project.description, '')}`.trim();
    })
    .filter(Boolean)
    .join('\n');
}

function summarizeExperience(experience = []) {
  return experience
    .slice(0, 3)
    .map((item) => {
      const role = safeText(item.role, 'Role not specified');
      const company = safeText(item.company, 'company not specified');
      const duration = safeText(item.duration, 'duration not specified');
      return `${role} at ${company} (${duration})`;
    })
    .filter(Boolean)
    .join('\n');
}

function getSkillsText(skills) {
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
${getSkillsText(resumeData.skills)}

Applicant projects:
${summarizeProjects(resumeData.projects || []) || 'Not specified'}

Applicant experience:
${summarizeExperience(resumeData.experience || []) || 'Not specified'}

Target job:
Title: ${safeText(jobDetails.title)}
Company: ${safeText(jobDetails.company)}
Location: ${safeText(jobDetails.location)}
Required skills: ${getSkillsText(jobSkills)}
Description: ${safeText(jobDetails.description)}
`.trim();
}

function buildFallbackCoverLetter(resumeData = {}, jobDetails = {}) {
  const skills = Array.isArray(resumeData.skills) ? resumeData.skills.slice(0, 5) : [];
  const projects = Array.isArray(resumeData.projects) ? resumeData.projects.slice(0, 2) : [];
  const experience = Array.isArray(resumeData.experience) ? resumeData.experience.slice(0, 2) : [];
  const title = safeText(jobDetails.title, 'the open role');
  const company = safeText(jobDetails.company, 'your company');
  const skillsSentence = skills.length
    ? ` My background includes ${skills.join(', ')}, which aligns with the needs of this role.`
    : '';
  const projectSentence = projects.length
    ? ` I have applied these abilities in projects such as ${projects.map((project) => safeText(project.name, 'a relevant project')).join(', ')}.`
    : '';
  const experienceSentence = experience.length
    ? ` My experience includes ${experience.map((item) => {
      return `${safeText(item.role, 'a role')} at ${safeText(item.company, 'an organization')}`;
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

    return safeText(coverLetter, buildFallbackCoverLetter(resumeData, jobDetails));
  } catch (error) {
    console.error('Gemini cover letter generation failed:', error.message);
    return buildFallbackCoverLetter(resumeData, jobDetails);
  }
}

module.exports = generateCoverLetter;
