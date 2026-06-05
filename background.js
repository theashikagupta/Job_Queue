const DEFAULT_API_BASE_URL = 'http://localhost:9000';

function getApiBaseUrl() {
  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.sync) {
      resolve(DEFAULT_API_BASE_URL);
      return;
    }

    chrome.storage.sync.get(['apiBaseUrl'], (result) => {
      resolve(result.apiBaseUrl || DEFAULT_API_BASE_URL);
    });
  });
}

async function requestBackend(path, options = {}) {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Backend request failed with status ${response.status}`);
  }

  return data;
}

async function handleJobExtracted(message) {
  console.log('Received extracted job details:', message.jobDetails);

  return requestBackend('/api/jobs/process', {
    method: 'POST',
    body: JSON.stringify({
      userId: message.userId,
      resumeId: message.resumeId,
      jobDetails: message.jobDetails,
    }),
  });
}

async function handleGenerateCoverLetter(message) {
  console.log('Generating cover letter for job:', message.jobId);

  return requestBackend('/api/cover-letter', {
    method: 'POST',
    body: JSON.stringify({
      userId: message.userId,
      jobId: message.jobId,
      jobDetails: message.jobDetails,
    }),
  });
}

async function handleStatusUpdate(message) {
  console.log('Updating application status:', message.jobId, message.status);

  return requestBackend(`/api/applications/${encodeURIComponent(message.jobId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: message.status,
    }),
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    sendResponse({
      ok: false,
      error: 'Message type is required.',
    });
    return false;
  }

  async function routeMessage() {
    switch (message.type) {
      case 'jobExtracted':
        return handleJobExtracted(message);
      case 'generateCoverLetter':
        return handleGenerateCoverLetter(message);
      case 'updateApplicationStatus':
        return handleStatusUpdate(message);
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  routeMessage()
    .then((data) => {
      console.log(`Handled ${message.type} message successfully:`, data);
      sendResponse({
        ok: true,
        data,
      });
    })
    .catch((error) => {
      console.error(`Failed to handle ${message.type} message:`, error);
      sendResponse({
        ok: false,
        error: error.message,
      });
    });

  return true;
});
