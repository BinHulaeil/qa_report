const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const width = 500;
const height = 300;
const chartCanvas = new ChartJSNodeCanvas({ width, height });

async function createStatusChart(statusCounts) {
  const config = {
    type: 'pie',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#4caf50', '#f44336', '#ff9800', '#9e9e9e'],
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Test Status Distribution'
        }
      }
    }
  };
  return await chartCanvas.renderToBuffer(config);
}

async function createTesterChart(testsByTester) {
  const config = {
    type: 'bar',
    data: {
      labels: Object.keys(testsByTester),
      datasets: [{
        label: 'Tests by Tester',
        data: Object.values(testsByTester),
        backgroundColor: '#2196f3'
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        title: {
          display: true,
          text: 'Tests by Tester'
        }
      }
    }
  };
  return await chartCanvas.renderToBuffer(config);
}

module.exports = async function generatePdf(data, metrics) {
  const doc = new PDFDocument({ margin: 50 });
  const filePath = path.join(__dirname, '../reports', `report_${Date.now()}.pdf`);
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // ===== HEADER =====
  const logoPath = path.join(__dirname, '../assets/logo.png');
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    }
  } catch (error) {
    console.error(error)
  }
  doc.fontSize(20).text('QA Test Report', { align: 'center' }).moveDown(2);

  // ===== SUMMARY =====
  doc.fontSize(14).text(`Total Test Cases: ${metrics.totalCases}`);
  doc.text(`Passed: ${metrics.statusCounts.Passed}`);
  doc.text(`Failed: ${metrics.statusCounts.Failed}`);
  doc.text(`Untested: ${metrics.statusCounts.Untested}`);
  doc.text(`Other: ${metrics.statusCounts.Other}`);
  doc.text(`Total Bugs Reported: ${metrics.bugCount}`).moveDown();

  // ===== CHARTS =====
  const statusChart = await createStatusChart(metrics.statusCounts);
  const testerChart = await createTesterChart(metrics.testsByTester);

  doc.image(statusChart, { fit: [500, 300], align: 'center' }).moveDown();
  doc.addPage();
  doc.image(testerChart, { fit: [500, 300], align: 'center' }).moveDown();

  // ===== TABLE SECTION =====
  doc.addPage().fontSize(16).text('Detailed Test Cases:', { underline: true }).moveDown();

  data.slice(0, 20).forEach(row => {
    doc.fontSize(10).text(`- ${row["Test"]} | Status: ${row["Status"]} | Ticket: ${row["Issues (case)"]} | Bugs: ${row["bugs"] || 'None'}`);
  });

  doc.end();
  return new Promise(resolve => {
    writeStream.on('finish', () => resolve(filePath));
  });
};

