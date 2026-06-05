const mongoose = require('mongoose');

const APPLICATION_STATUSES = [
  'queued',
  'viewed',
  'draft_ready',
  'applied',
  'rejected',
  'interview',
  'offer',
];

const jobApplicationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  jobId: {
    type: String,
    required: true,
    index: true,
  },
  company: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  jobDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: APPLICATION_STATUSES,
    default: 'queued',
    index: true,
  },
  matchScore: {
    type: Number,
    default: 0,
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
  appliedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

jobApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const JobApplication = mongoose.models.JobApplication
  || mongoose.model('JobApplication', jobApplicationSchema);

function normalizeFilter(filter) {
  if (!filter) return {};

  if (typeof filter === 'string') {
    return { status: filter };
  }

  return filter;
}

async function updateApplicationStatus(jobIdOrApplicationId, newStatus, userId) {
  if (!jobIdOrApplicationId) {
    throw new Error('jobId or applicationId is required.');
  }

  if (!APPLICATION_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid application status: ${newStatus}`);
  }

  try {
    const lookup = [{ jobId: jobIdOrApplicationId }];

    if (mongoose.Types.ObjectId.isValid(jobIdOrApplicationId)) {
      lookup.push({ _id: new mongoose.Types.ObjectId(jobIdOrApplicationId) });
    }

    const query = { $or: lookup };

    if (userId) {
      query.userId = userId;
    }

    const application = await JobApplication.findOneAndUpdate(
      query,
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === 'applied' ? { appliedAt: new Date() } : {}),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!application) {
      throw new Error(`No application found for "${jobIdOrApplicationId}".`);
    }

    return application;
  } catch (error) {
    throw new Error(`Failed to update application status: ${error.message}`);
  }
}

async function listApplications(userId, filter) {
  try {
    const normalizedFilter = normalizeFilter(filter);
    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (normalizedFilter.status) {
      if (!APPLICATION_STATUSES.includes(normalizedFilter.status)) {
        throw new Error(`Invalid application status: ${normalizedFilter.status}`);
      }

      query.status = normalizedFilter.status;
    }

    return JobApplication.find(query)
      .select('_id userId jobId jobDetails company title matchScore isFavorite status createdAt')
      .sort({ createdAt: -1, updatedAt: -1 })
      .lean();
  } catch (error) {
    throw new Error(`Failed to list applications: ${error.message}`);
  }
}

module.exports = {
  JobApplication,
  updateApplicationStatus,
  listApplications,
  APPLICATION_STATUSES,
};
