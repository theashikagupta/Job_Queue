const extractButton = document.getElementById('extractButton');
const resultArea = document.getElementById('result');

function setStatus(message, state = 'info') {
  resultArea.textContent = message;
  resultArea.dataset.state = state;
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tabs && tabs[0]);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}

function getStoredJobContext() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userId', 'resumeId'], (result) => {
      resolve({
        userId: result.userId,
        resumeId: result.resumeId,
      });
    });
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.js'],
    });
  } catch (error) {
    throw new Error(
      error.message ||
        'Could not access this page. If this is a local file, enable Allow access to file URLs for the extension.',
    );
  }
}

async function extractFromTab(tab) {
  try {
    return await sendMessageToTab(tab.id, { type: 'extractJobDetails' });
  } catch (_error) {
    await ensureContentScript(tab.id);
    return sendMessageToTab(tab.id, { type: 'extractJobDetails' });
  }
}

function buildBackendMessage(jobDetails, context) {
  const message = {
    type: 'jobExtracted',
    jobDetails,
  };

  if (context.userId) {
    message.userId = context.userId;
  }

  if (context.resumeId) {
    message.resumeId = context.resumeId;
  }

  return message;
}

async function handleExtractClick() {
  extractButton.disabled = true;
  setStatus('Extracting job details...');

  try {
    const tab = await getActiveTab();

    if (!tab || !tab.id) {
      throw new Error('No active tab found.');
    }

    const extractionResponse = await extractFromTab(tab);

    if (!extractionResponse || !extractionResponse.ok) {
      throw new Error(extractionResponse?.error || 'Could not extract job details from this page.');
    }

    const { jobDetails } = extractionResponse;
    setStatus('Sending job details to backend...');

    const context = await getStoredJobContext();
    const backendResponse = await sendRuntimeMessage(buildBackendMessage(jobDetails, context));

    if (!backendResponse || !backendResponse.ok) {
      throw new Error(backendResponse?.error || 'Backend did not accept the extracted job details.');
    }

    const label = jobDetails.title || 'current job';
    setStatus(`Success: extracted ${label} and sent it to http://localhost:9000.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Something went wrong while extracting this job.', 'error');
  } finally {
    extractButton.disabled = false;
  }
}

extractButton.addEventListener('click', handleExtractClick);
