const express = require('express');
const multer = require('multer');
const { handleUpload } = require('./controllers/reportController');

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('csvFile'), handleUpload);

module.exports = router;

