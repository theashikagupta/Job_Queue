function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(value) {
  if (!value) return '';

  try {
    return new URL(value, window.location.href).href;
  } catch (_error) {
    return '';
  }
}

function getMetaContent(selectors) {
  for (const selector of selectors) {
    const element = safeQuerySelector(selector);
    const content = cleanText(element && element.getAttribute('content'));

    if (content) return content;
  }

  return '';
}

function getTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const element = safeQuerySelector(selector);
    const text = cleanText(element && element.textContent);

    if (text) return text;
  }

  return '';
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

function getDescription() {
  const descriptionSelectors = [
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
  ];

  const description = getTextFromSelectors(descriptionSelectors);
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
      const text = cleanText(element.textContent || element.getAttribute('aria-label'));
      const href = element.href || element.getAttribute('href') || element.dataset.href;

      if (/apply/i.test(text) || /apply/i.test(href || '')) {
        return absoluteUrl(href) || window.location.href;
      }
    }
  }

  const applyByText = safeQuerySelectorAll('a, button').find((element) => {
    return /apply/i.test(cleanText(element.textContent || element.getAttribute('aria-label')));
  });

  if (!applyByText) return '';

  return absoluteUrl(applyByText.href || applyByText.getAttribute('href')) || window.location.href;
}

function inferSkills(description) {
  const skillSectionMatch = description.match(
    /(?:skills|required skills|technical skills|requirements|key skills)\s*:?\s*([\s\S]{0,800})/i,
  );
  const source = skillSectionMatch ? skillSectionMatch[1] : description;
  const bulletSkills = source
    .split(/\n|•|●|▪|·|\u2022/g)
    .map(cleanText)
    .filter((item) => item.length >= 2 && item.length <= 80);

  const commaSkills = source
    .split(/,|;|\||\/|\s+-\s+/g)
    .map(cleanText)
    .filter((item) => item.length >= 2 && item.length <= 40);

  const knownSkillPattern = /\b(JavaScript|TypeScript|React(?:\.js)?|Angular|Vue(?:\.js)?|Node(?:\.js)?|Express(?:\.js)?|MongoDB|SQL|MySQL|PostgreSQL|Python|Java|C\+\+|C#|HTML|CSS|Tailwind|Bootstrap|AWS|Azure|Docker|Kubernetes|Git|REST|GraphQL|Redux|Next(?:\.js)?|PHP|Laravel|Django|Flask|Spring Boot)\b/gi;
  const knownSkills = [...source.matchAll(knownSkillPattern)].map((match) => cleanText(match[0]));

  return [...new Set([...knownSkills, ...bulletSkills, ...commaSkills])]
    .map((skill) => skill.replace(/^(skills|required skills|technical skills|requirements|key skills)\s*:?\s*/i, ''))
    .filter((skill) => skill && !/[.!?]$/.test(skill) && skill.split(' ').length <= 6)
    .slice(0, 30);
}

async function extractJobDetails() {
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

  const description = getDescription();
  const applyUrl = getApplyUrl();
  const missingFields = [];

  if (!title) missingFields.push('title');
  if (!company) missingFields.push('company');
  if (!location) missingFields.push('location');
  if (!description) missingFields.push('description');
  if (!applyUrl) missingFields.push('applyUrl');

  if (missingFields.length) {
    console.warn(`extractJobDetails: missing ${missingFields.join(', ')}`);
  }

  return {
    title,
    company,
    location,
    description,
    skills: inferSkills(description),
    applyUrl,
  };
}

if (typeof window !== 'undefined') {
  window.extractJobDetails = extractJobDetails;
}

if (
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  chrome.runtime.onMessage &&
  typeof window !== 'undefined' &&
  !window.__agenticJobAssistantMessageListenerAdded
) {
  window.__agenticJobAssistantMessageListenerAdded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'extractJobDetails') {
      return false;
    }

    extractJobDetails()
      .then((jobDetails) => {
        sendResponse({
          ok: true,
          jobDetails,
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || 'Could not extract job details.',
        });
      });

    return true;
  });
}

if (typeof module !== 'undefined') {
  module.exports = extractJobDetails;
}
