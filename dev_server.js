import express from 'express';
import multer from 'multer';
import { handleUpload } from './src/controllers/reportController.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

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

app.use(express.json());

// POST route for CSV upload
app.post('/api/upload', upload.single('csvFile'), handleUpload);

app.listen(PORT, () => {
    console.log(`Development server running on port ${PORT}`);
});