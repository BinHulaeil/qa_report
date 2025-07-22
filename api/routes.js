const express = require('express');
const multer = require('multer');
const { handleUpload } = require('../src/controllers/reportController');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// POST route for CSV upload with generalStatus and notes
router.post('/upload', upload.single('csvFile'), handleUpload);

module.exports = router;
