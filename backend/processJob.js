const calculateMatchScore = require('./calculateMatchScore');

async function processJob(job, resumeData, threshold = 70, db, precomputedMatchScore) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('A connected MongoDB database instance must be passed as db.');
  }

  if (!job || typeof job !== 'object') {
    throw new Error('job must be an object.');
  }

  const matchScore = typeof precomputedMatchScore === 'number'
    ? precomputedMatchScore
    : calculateMatchScore(resumeData, job);
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

module.exports = processJob;
