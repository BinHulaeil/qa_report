import { handleUpload } from '../src/controllers/reportController.js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false, // Disable body parsing for file uploads
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // Parse the multipart form data
        const form = formidable({
            uploadDir: '/tmp', // Vercel's temp directory
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB limit
            filter: ({ mimetype, originalFilename }) => {
                // Only accept CSV files
                return mimetype === 'text/csv' || originalFilename?.endsWith('.csv');
            },
        });

        const [fields, files] = await form.parse(req);

        const csvFile = files.csvFile?.[0];

        if (!csvFile) {
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }

        // Create a req object similar to Express's req for compatibility
        const mockReq = {
            file: {
                fieldname: 'csvFile',
                originalname: csvFile.originalFilename,
                encoding: csvFile.encoding,
                mimetype: csvFile.mimetype,
                destination: path.dirname(csvFile.filepath),
                filename: path.basename(csvFile.filepath),
                path: csvFile.filepath,
                size: csvFile.size
            },
            body: {
                generalStatus: fields.generalStatus?.[0] || '',
                notes: fields.notes?.[0] || '',
            },
            query: {
                generalStatus: fields.generalStatus?.[0] || '',
                notes: fields.notes?.[0] || '',
            }
        };

        // Create a mock res object for compatibility
        const mockRes = {
            json: (data) => res.json(data),
            status: (code) => ({
                json: (data) => res.status(code).json(data),
                send: (data) => res.status(code).send(data)
            }),
            send: (data) => res.send(data),
            setHeader: (name, value) => res.setHeader(name, value),
        };

        // Call your existing handleUpload function
        await handleUpload(mockReq, mockRes);

        // Clean up temp file
        try {
            fs.unlinkSync(csvFile.filepath);
        } catch (error) {
            console.warn('Failed to clean up temp file:', error);
        }

    } catch (error) {
        console.error('Upload error:', error);

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }

        if (error.message === 'Only CSV files are allowed') {
            return res.status(400).json({ error: 'Only CSV files are allowed' });
        }

        return res.status(500).json({ error: 'Internal server error' });
    }
}