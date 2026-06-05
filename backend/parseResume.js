const fs = require('fs/promises');
const pdfParse = require('pdf-parse');

const SECTION_NAMES = ['skills', 'projects', 'experience', 'education'];
const SECTION_ALIASES = {
  skills: ['skills', 'technical skills', 'key skills', 'core skills', 'technologies'],
  projects: ['projects', 'academic projects', 'personal projects', 'professional projects'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'internships'],
  education: ['education', 'academic background', 'academics', 'qualification', 'qualifications'],
};

function normalizeText(text) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSections(text) {
  const aliasToSection = new Map();
  Object.entries(SECTION_ALIASES).forEach(([section, aliases]) => {
    aliases.forEach((alias) => aliasToSection.set(alias.toLowerCase(), section));
  });

  const headingPattern = [...aliasToSection.keys()].map(escapeRegExp).join('|');
  const headingRegex = new RegExp(`^\\s*(${headingPattern})\\s*:?\\s*$`, 'gim');
  const matches = [...text.matchAll(headingRegex)];
  const sections = Object.fromEntries(SECTION_NAMES.map((name) => [name, '']));

  matches.forEach((match, index) => {
    const sectionName = aliasToSection.get(match[1].toLowerCase());
    const start = match.index + match[0].length;
    const end = matches[index + 1] ? matches[index + 1].index : text.length;
    sections[sectionName] = text.slice(start, end).trim();
  });

  return sections;
}

function splitLines(sectionText) {
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

  const lines = splitLines(sectionText);
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

  return splitLines(sectionText).map((line) => {
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

  return splitLines(sectionText).map((line) => {
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
    const sections = getSections(normalizeText(parsedPdf.text || ''));

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

module.exports = parseResume;
