const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const parseResume = require('./parseResume');
const protect = require('./middleware/authMiddleware');

const router = express.Router();
const uploadDir = path.join(os.tmpdir(), 'resume-uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-z0-9.\-_]/gi, '_');
    callback(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';

    if (!isPdf) {
      callback(new Error('Only PDF resume uploads are allowed.'));
      return;
    }

    callback(null, true);
  },
});

function getResumesCollection(req) {
  const db = (req.app && req.app.locals && req.app.locals.db) || mongoose.connection.db;

  if (!db) {
    throw new Error('MongoDB connection is not ready.');
  }

  return db.collection('resumes');
}

function uploadSingleResume(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('resume')(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

router.post('/uploadResume', protect, async (req, res) => {
  let uploadedPath;

  try {
    await uploadSingleResume(req, res);

    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required in the "resume" form field.' });
    }

    uploadedPath = req.file.path;

    const parsedResume = await parseResume(uploadedPath);
    const document = {
      userId: req.user._id.toString(),
      originalFileName: req.file.originalname,
      ...parsedResume,
      createdAt: new Date(),
    };

    const resumes = getResumesCollection(req);
    const result = await resumes.insertOne(document);

    return res.status(201).json({
      message: 'Resume uploaded and parsed successfully.',
      resume: {
        _id: result.insertedId,
        ...document,
      },
    });
  } catch (error) {
    const isInvalidUpload = error instanceof multer.MulterError || /pdf|file|upload/i.test(error.message);
    const statusCode = isInvalidUpload ? 400 : 500;

    return res.status(statusCode).json({
      message: statusCode === 400 ? 'Invalid resume upload.' : 'Failed to upload and parse resume.',
      error: error.message,
    });
  } finally {
    if (uploadedPath) {
      await fsp.unlink(uploadedPath).catch(() => {});
    }
  }
});

module.exports = router;
