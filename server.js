const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoutes = require('./authRoutes');
const uploadResumeRoute = require('./uploadResumeRoute');
const calculateMatchScore = require('./calculateMatchScore');
const processJob = require('./processJob');
const generateCoverLetter = require('./generateCoverLetter');
const searchJobs = require('./searchJobs');
const protect = require('./middleware/authMiddleware');
const {
  JobApplication,
  updateApplicationStatus,
  listApplications,
} = require('./jobApplications');
const {
  getPreferences,
  preferenceRouter,
} = require('./userPreferences');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'resume_parser';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', authRoutes);
app.use(uploadResumeRoute);

function getDb() {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready.');
  }

  return mongoose.connection.db;
}

function objectIdFromString(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

function formatResumeData(resume) {
  return {
    userId: resume.userId,
    skills: resume.skills || [],
    projects: resume.projects || [],
    experience: resume.experience || [],
    education: resume.education || [],
  };
}

async function getLatestResumeData(userId) {
  const resume = await getDb()
    .collection('resumes')
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  if (!resume) {
    throw new Error(`No parsed resume found for userId "${userId}".`);
  }

  return formatResumeData(resume);
}

async function findLatestResumeData(userId) {
  const resume = await getDb()
    .collection('resumes')
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  return resume ? formatResumeData(resume) : null;
}

async function upsertJobApplication(userId, jobId, jobDetails, matchScore, status) {
  const now = new Date();

  return JobApplication.findOneAndUpdate(
    { userId, jobId },
    {
      $set: {
        company: jobDetails.company || '',
        title: jobDetails.title || '',
        jobDetails: jobDetails || {},
        status,
        matchScore,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        jobId,
        isFavorite: false,
        appliedAt: null,
        createdAt: now,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  ).lean();
}

function createJobIdFromDetails(jobDetails) {
  const source = String(jobDetails.source || 'job')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'job';
  const rawId = jobDetails.originalJobId || jobDetails.applyUrl || `${jobDetails.title || ''}-${jobDetails.company || ''}`;
  const encodedId = Buffer.from(String(rawId)).toString('base64url').slice(0, 64);

  return `${source}-${encodedId}`;
}

async function upsertJobApplicationByApplyUrl(userId, jobDetails, matchScore, status) {
  if (!jobDetails.applyUrl) {
    throw new Error('applyUrl is required to save a searched job.');
  }

  const now = new Date();
  const jobId = createJobIdFromDetails(jobDetails);
  const update = {
    $set: {
      jobId,
      company: jobDetails.company || '',
      title: jobDetails.title || '',
      jobDetails,
      status,
      matchScore,
      updatedAt: now,
    },
    $setOnInsert: {
      userId,
      isFavorite: false,
      appliedAt: null,
      createdAt: now,
    },
  };

  try {
    return await JobApplication.findOneAndUpdate(
      { userId, 'jobDetails.applyUrl': jobDetails.applyUrl },
      update,
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    ).lean();
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    return JobApplication.findOneAndUpdate(
      { userId, jobId },
      update,
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    ).lean();
  }
}

function normalizeSearchTerm(value) {
  return String(value || '').trim().toLowerCase();
}

function preferenceValue(preferences, field, legacyField) {
  if (preferences[field]) return preferences[field];

  if (legacyField && Array.isArray(preferences[legacyField])) {
    return preferences[legacyField][0] || '';
  }

  if (legacyField && preferences[legacyField]) {
    return preferences[legacyField];
  }

  return '';
}

function jobMatchesPreferences(job, preferences) {
  const role = normalizeSearchTerm(preferenceValue(preferences, 'role', 'preferredRoles'));
  const location = normalizeSearchTerm(preferenceValue(preferences, 'location', 'preferredLocations'));
  const jobType = normalizeSearchTerm(preferenceValue(preferences, 'jobType', 'preferredJobType'));
  const title = normalizeSearchTerm(job.title);
  const jobLocation = normalizeSearchTerm(job.location);
  const type = normalizeSearchTerm(job.jobType);

  return (!role || title.includes(role) || role.includes(title))
    && (!location || jobLocation === location)
    && (!jobType || type === jobType);
}

function formatApplicationResponse(application) {
  return {
    _id: application._id,
    jobId: application.jobId,
    userId: application.userId,
    jobDetails: application.jobDetails || {
      title: application.title || '',
      company: application.company || '',
    },
    matchScore: application.matchScore || 0,
    isFavorite: Boolean(application.isFavorite),
    status: application.status || 'queued',
    createdAt: application.createdAt,
  };
}

function buildApplicationLookup(identifier) {
  const lookup = [{ jobId: identifier }];

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    lookup.push({ _id: new mongoose.Types.ObjectId(identifier) });
  }

  return lookup;
}

async function findApplicationForAction(identifier, userId) {
  const lookup = buildApplicationLookup(identifier);
  const userApplication = await JobApplication.findOne({ $or: lookup, userId }).lean();

  if (userApplication) {
    return userApplication;
  }

  return JobApplication.findOne({ $or: lookup }).lean();
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.get('/api/queue', async (req, res) => {
  try {
    const query = { status: 'queued' };

    if (req.query.userId) {
      query.userId = req.query.userId;
    }

    const jobs = await getDb()
      .collection('jobQueue')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch queued jobs.', error: error.message });
  }
});

app.post('/api/jobs/process', async (req, res) => {
  try {
    const { userId, jobDetails, resumeData, threshold, minScore } = req.body;

    if (!userId || !jobDetails) {
      return res.status(400).json({ message: 'userId and jobDetails are required.' });
    }

    const resolvedResumeData = resumeData || await getLatestResumeData(userId);
    const resolvedThreshold = Number(threshold ?? minScore ?? 70);
    const matchScore = calculateMatchScore(resolvedResumeData, jobDetails);
    const processed = await processJob(
      { ...jobDetails, userId },
      { ...resolvedResumeData, userId },
      resolvedThreshold,
      getDb(),
      matchScore,
    );

    if (processed.status === 'queued') {
      await upsertJobApplication(
        userId,
        String(processed.document._id),
        jobDetails,
        matchScore,
        'queued',
      );
    }

    return res.status(201).json({
      message: `Job ${processed.status}.`,
      matchScore,
      status: processed.status,
      document: processed.document,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process job.', error: error.message });
  }
});

app.post('/api/jobs/search', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const resumeData = await findLatestResumeData(userId);

    if (!resumeData) {
      return res.status(400).json({ message: 'Please upload your resume before searching jobs.' });
    }

    const preferences = await getPreferences(userId);
    const minMatchScore = Number(preferences.minMatchScore ?? 70);
    const role = preferenceValue(preferences, 'role', 'preferredRoles');
    const location = preferenceValue(preferences, 'location', 'preferredLocations');
    const jobType = preferenceValue(preferences, 'jobType', 'preferredJobType');
    const searchResult = await searchJobs({
      role,
      location,
      jobType,
    });
    const candidateJobs = searchResult.jobs;
    const savedJobs = [];
    let queuedCount = 0;
    let rejectedCount = 0;

    for (const job of candidateJobs) {
      const matchScore = calculateMatchScore(resumeData, job);
      const status = matchScore >= minMatchScore ? 'queued' : 'rejected';
      const savedJob = await upsertJobApplicationByApplyUrl(
        userId,
        {
          ...job,
          applyUrl: job.applyUrl || '',
        },
        matchScore,
        status,
      );

      if (status === 'queued') {
        queuedCount += 1;
      } else {
        rejectedCount += 1;
      }

      savedJobs.push(savedJob);
    }

    const applications = savedJobs.map(formatApplicationResponse);

    return res.json({
      success: true,
      primarySource: searchResult.primarySource,
      fallbackUsed: searchResult.fallbackUsed,
      fetchedCount: searchResult.fetchedCount,
      queuedCount,
      rejectedCount,
      applications,
      message: `Search completed: ${queuedCount} queued, ${rejectedCount} rejected.`,
      queued: queuedCount,
      rejected: rejectedCount,
      totalFound: candidateJobs.length,
      source: searchResult.fallbackUsed ? 'Remotive' : 'JSearch',
      jobs: applications,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to search jobs.', error: error.message });
  }
});

app.post('/api/cover-letter', protect, async (req, res) => {
  try {
    const { jobId, jobDetails, resumeData } = req.body;
    const userId = req.user._id.toString();

    if (!jobDetails) {
      return res.status(400).json({ message: 'jobDetails is required.' });
    }

    const resolvedResumeData = resumeData || await getLatestResumeData(userId);

    if (!resolvedResumeData) {
      return res.status(400).json({ message: 'resumeData or userId with an uploaded resume is required.' });
    }

    const coverLetter = await generateCoverLetter(resolvedResumeData, jobDetails);

    if (jobId) {
      await upsertJobApplication(
        userId,
        String(jobId),
        jobDetails,
        Number(jobDetails.matchScore || 0),
        'draft_ready',
      );
    }

    return res.json({ coverLetter });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate cover letter.', error: error.message });
  }
});

app.patch('/api/applications/:jobId/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const { jobId } = req.params;
    const userId = req.user._id.toString();
    const existingApplication = await findApplicationForAction(jobId, userId);

    if (!existingApplication) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (String(existingApplication.userId) !== userId) {
      return res.status(403).json({ message: 'You cannot update another user\'s application.' });
    }

    const application = await updateApplicationStatus(jobId, status, userId);
    const queueObjectId = objectIdFromString(application.jobId || jobId);

    if (queueObjectId) {
      await getDb().collection('jobQueue').updateOne(
        { _id: queueObjectId },
        { $set: { status, updatedAt: new Date() } },
      );
    }

    return res.json(application);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update application status.', error: error.message });
  }
});

app.patch('/api/applications/:jobId/favorite', protect, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user._id.toString();
    const existingApplication = await findApplicationForAction(jobId, userId);

    if (!existingApplication) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (String(existingApplication.userId) !== userId) {
      return res.status(403).json({ message: 'You cannot favorite another user\'s application.' });
    }

    const application = await JobApplication.findOneAndUpdate(
      { _id: existingApplication._id, userId },
      {
        $set: {
          isFavorite: !Boolean(existingApplication.isFavorite),
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    return res.json({ application: formatApplicationResponse(application) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update favorite status.', error: error.message });
  }
});

app.get('/api/applications', protect, async (req, res) => {
  try {
    const applications = await listApplications(req.user._id.toString(), {
      status: req.query.status,
    });

    return res.json({ applications: applications.map(formatApplicationResponse) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list applications.', error: error.message });
  }
});

app.use('/api/preferences', protect, preferenceRouter);

async function startServer() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required.');
  }

  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB_NAME,
  });

  app.locals.db = getDb();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
};
