const DEFAULT_WEIGHTS = {
  skills: 0.5,
  projects: 0.3,
  experience: 0.2,
};

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

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : []).map(normalize).filter(Boolean);
}

function clampScore(value) {
  return Math.max(0, Math.min(1, value));
}

function getKeywords(text) {
  return [...new Set(
    normalize(text)
      .split(' ')
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )].slice(0, 40);
}

function getWeightedConfig(weights = {}) {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };
  const total = Object.values(merged).reduce((sum, value) => sum + Number(value || 0), 0);

  if (total <= 0) return DEFAULT_WEIGHTS;

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
    const text = normalize(`${project.name || ''} ${project.description || ''}`);
    return keywords.some((keyword) => text.includes(keyword));
  });

  return matchedProjects.length / resumeProjects.length;
}

function calculateExperienceScore(experience, jobDetails) {
  const resumeExperience = Array.isArray(experience) ? experience : [];
  const jobText = normalize(`${jobDetails.title || ''} ${jobDetails.role || ''} ${jobDetails.description || ''}`);

  if (!resumeExperience.length || !jobText) return 0;

  const jobKeywords = getKeywords(jobText);
  const matchedExperience = resumeExperience.filter((item) => {
    const roleText = normalize(`${item.role || ''} ${item.company || ''}`);
    return jobKeywords.some((keyword) => roleText.includes(keyword));
  });

  return matchedExperience.length ? 1 : 0;
}

function calculateMatchScore(resumeData, jobDetails, weights = {}) {
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

module.exports = calculateMatchScore;
