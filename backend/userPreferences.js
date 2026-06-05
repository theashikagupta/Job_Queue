const express = require('express');
const mongoose = require('mongoose');

const DEFAULT_MIN_MATCH_SCORE = 70;

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    jobType: {
      type: String,
      default: '',
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

function getDefaultPreferences(userId) {
  return {
    userId,
    role: '',
    location: '',
    jobType: '',
    preferredRoles: [],
    preferredLocations: [],
    minMatchScore: DEFAULT_MIN_MATCH_SCORE,
    rejectedCompanies: [],
    preferredJobType: '',
  };
}

function pickAllowedUpdates(updates = {}) {
  const allowedFields = [
    'role',
    'location',
    'jobType',
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

function normalizePreferencePayload(body = {}) {
  return {
    role: body.role || '',
    location: body.location || '',
    jobType: body.jobType || '',
    minMatchScore: Number(body.minMatchScore ?? DEFAULT_MIN_MATCH_SCORE),
    preferredRoles: body.role ? [body.role] : [],
    preferredLocations: body.location ? [body.location] : [],
    preferredJobType: body.jobType || '',
  };
}

function formatPreferences(preferences) {
  return {
    userId: preferences.userId,
    role: preferences.role || (preferences.preferredRoles && preferences.preferredRoles[0]) || '',
    location: preferences.location || (preferences.preferredLocations && preferences.preferredLocations[0]) || '',
    jobType: preferences.jobType || preferences.preferredJobType || '',
    minMatchScore: preferences.minMatchScore ?? DEFAULT_MIN_MATCH_SCORE,
  };
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
    const allowedUpdates = pickAllowedUpdates(updates);
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

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const userId = req.user._id.toString();
    const preferences = await updatePreferences(userId, normalizePreferencePayload(req.body));

    return res.json({ preferences: formatPreferences(preferences) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save preferences.', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const preferences = await getPreferences(req.user._id.toString());

    return res.json({ preferences: formatPreferences(preferences) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch preferences.', error: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot access another user\'s preferences.' });
    }

    const preferences = await getPreferences(req.user._id.toString());

    return res.json({ preferences: formatPreferences(preferences) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch preferences.', error: error.message });
  }
});

module.exports = {
  UserPreference,
  getPreferences,
  updatePreferences,
  preferenceRouter: router,
};
