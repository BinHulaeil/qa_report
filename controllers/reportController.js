const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const generatePdf = require('../services/pdfGenerator');

exports.handleUpload = async (req, res) => {
    const csvPath = req.file.path;
    const generalStatus = req.body.generalStatus || req.query.generalStatus; // Support both body and query
    const notes = req.body.notes || req.query.notes  ; // Support both body and query, default to empty string
    
    const results = [];
    
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                // ======= METRICS =======
                const metrics = {
                    totalCases: results.length,
                    statusCounts: { Passed: 0, Failed: 0, Untested: 0, Other: 0 },
                    bugCount: 0,
                    testsByTester: {},
                    testsByDate: {},
                };
                
                results.forEach(row => {
                    const status = (row["Status"] || "Other").trim();
                    if (metrics.statusCounts[status] !== undefined) {
                        metrics.statusCounts[status]++;
                    } else {
                        metrics.statusCounts.Other++;
                    }
                    
                    if (row["bugs"] && row["bugs"].trim() !== '') {
                        metrics.bugCount++;
                    }
                    
                    const tester = row["Created by"] || "Unknown";
                    metrics.testsByTester[tester] = (metrics.testsByTester[tester] || 0) + 1;
                    
                    const date = row["Created at"] ? row["Created at"].split("T")[0] : "Unknown";
                    metrics.testsByDate[date] = (metrics.testsByDate[date] || 0) + 1;
                });
                
                // Pass data + metrics + generalStatus + notes to PDF
                const pdfPath = await generatePdf(results, metrics, generalStatus, notes);
                res.download(pdfPath, 'QA_Report.pdf');
                
            } catch (err) {
                console.error('Error processing file:', err);
                res.status(500).json({ error: 'Failed to process file or generate PDF' });
            } finally {
                // Clean up uploaded file
                fs.unlink(csvPath, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }
        })
        .on('error', (err) => {
            console.error('Error reading CSV:', err);
            res.status(500).json({ error: 'Failed to read CSV file' });
            // Clean up on error
            fs.unlink(csvPath, () => {});
        });
};
