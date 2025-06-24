const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const width = 500;
const height = 300;
const chartCanvas = new ChartJSNodeCanvas({ width, height });

// ===== UTILITY FUNCTIONS =====
function calculatePercentages(statusCounts) {
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const percentages = {};

  for (const [status, count] of Object.entries(statusCounts)) {
    percentages[status] = ((count / total) * 100).toFixed(2);
  }

  return percentages;
}

function getGeneralStatusColor(generalStatus) {
  const statusColors = {
    'PASSED': '#4caf50',
    'FAILED': '#f44336',
    'PASSED WITH ISSUES': '#ff9800'
  };
  return statusColors[generalStatus] || 'black';
}

function getTestStatusColor(status) {
  const statusColors = {
    'passed': '#4caf50',
    'failed': '#f44336',
    'untested': '#ff9800'
  };
  return statusColors[status.toLowerCase()] || 'black';
}

// ===== CHART CREATION FUNCTIONS =====
async function createStatusChart(statusCounts) {
  const percentages = calculatePercentages(statusCounts);

  const labelsWithPercentages = Object.keys(statusCounts).map(status => {
    const count = statusCounts[status];
    const percentage = percentages[status];
    return `${status} (${percentage}%)`;
  });

  const config = {
    type: 'pie',
    data: {
      labels: labelsWithPercentages,
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#4caf50', '#f44336', '#ff9800', '#9e9e9e'],
      }]
    },
    options: {
      plugins: {
        legend: {
          display: true,
          position: 'right'
        },
        title: {
          display: true,
          text: 'Test Status Distribution'
        }
      }
    }
  };

  const chartBuffer = await chartCanvas.renderToBuffer(config);
  const passedPercentage = percentages.Passed;

  return { chartBuffer, passedPercentage };
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

// ===== PDF GENERATION SECTIONS =====
function addHeader(doc) {
  const logoPath = path.join(__dirname, '../assets/logo.png');
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    }
  } catch (error) {
    console.error('Error loading logo:', error);
  }
  
  doc.font('./assets/fonts/FrutigerLTArabic-75Black.ttf')
     .fontSize(20)
     .fillColor('black')
     .text('QA Test Report', { align: 'center' })
     .moveDown(2);
}

function addSummary(doc, metrics) {
  doc.fontSize(14).fillColor('black');
  doc.text(`Total Test Cases: ${metrics.totalCases}`);
  doc.text(`Passed: ${metrics.statusCounts.Passed}`);
  doc.text(`Failed: ${metrics.statusCounts.Failed}`);
  doc.text(`Untested: ${metrics.statusCounts.Untested}`);
  doc.text(`Other: ${metrics.statusCounts.Other}`);
  doc.text(`Total Bugs Reported: ${metrics.bugCount}`).moveDown();
}

function addGeneralStatus(doc, generalStatus) {
  // Process the status string
  const modifiedStatus = generalStatus.replace(/_/g, ' ');
  const statusColor = getGeneralStatusColor(modifiedStatus);
  
  // Calculate center position for the entire text
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const availableWidth = pageWidth - (margin * 2);
  
  // Measure text widths to center the combined text
  const labelText = 'General Status: ';
  const labelWidth = doc.widthOfString(labelText);
  const statusWidth = doc.widthOfString(modifiedStatus);
  const totalWidth = labelWidth + statusWidth;
  const startX = margin + (availableWidth - totalWidth) / 2;
  
  // Add "General Status: " in black
  doc.font('./assets/fonts/FrutigerLTArabic-75Black.ttf')
     .fontSize(20)
     .fillColor('black')
     .text(labelText, startX, doc.y, { continued: true });
  
  // Add the status itself in the appropriate color
  doc.fillColor(statusColor)
     .text(modifiedStatus)
     .moveDown(2);
}

async function addStatusChart(doc, metrics) {
  const { chartBuffer } = await createStatusChart(metrics.statusCounts);
  
  // Calculate center position for the chart
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const availableWidth = pageWidth - (margin * 2);
  const chartWidth = 500;
  const chartX = margin + (availableWidth - chartWidth) / 2;
  
  doc.image(chartBuffer, chartX, doc.y, { width: chartWidth, height: 300 }).moveDown();
}

async function addTesterChart(doc, metrics) {
  doc.addPage();
  const testerChart = await createTesterChart(metrics.testsByTester);
  doc.image(testerChart, { fit: [500, 300], align: 'center' }).moveDown();
}

function addDetailedTable(doc, data) {
  doc.addPage()
     .font('./assets/fonts/FrutigerLTArabic-75Black.ttf')
     .fontSize(16)
     .fillColor('black')
     .text('Detailed Test Cases:', { underline: true })
     .moveDown();

  // Table configuration
  const tableTop = doc.y;
  const colWidths = {
    test: 200,
    status: 80,
    ticket: 80,
    bugs: 130
  };
  
  // Draw table headers
  doc.font('./assets/fonts/FrutigerLTArabic-45Light.ttf')
     .fontSize(12)
     .fillColor('black');
  
  doc.rect(50, tableTop, 490, 25).fillColor('#f0f0f0').fill();
  doc.fillColor('black');
  
  let currentX = 50;
  const headers = ['Test Case', 'Status', 'Ticket', 'Bugs'];
  const widths = Object.values(colWidths);
  
  headers.forEach((header, index) => {
    doc.text(header, currentX + 5, tableTop + 8, { width: widths[index] });
    currentX += widths[index];
  });
  
  // Reset position for table rows
  doc.y = tableTop + 25;
  
  // Draw table rows
  data.slice(0, 20).forEach((row, index) => {
    const rowY = doc.y;
    const rowHeight = 30;
    
    // Alternate row colors
    const fillColor = index % 2 === 0 ? '#f9f9f9' : 'white';
    doc.rect(50, rowY, 490, rowHeight).fillColor(fillColor).fill();
    
    // Draw borders
    doc.strokeColor('#ddd').lineWidth(0.5);
    let lineX = 50;
    
    // Vertical lines
    for (let i = 0; i <= 4; i++) {
      doc.moveTo(lineX, rowY).lineTo(lineX, rowY + rowHeight).stroke();
      if (i < 4) {
        lineX += widths[i];
      }
    }
    
    // Horizontal line
    doc.moveTo(50, rowY + rowHeight).lineTo(540, rowY + rowHeight).stroke();
    
    // Add cell content
    doc.fontSize(9);
    currentX = 50;
    
    // Test case name
    const testName = row["Test"] || 'N/A';
    const truncatedTest = testName.length > 40 ? testName.substring(0, 37) + '...' : testName;
    doc.fillColor('black').text(truncatedTest, currentX + 3, rowY + 8, { width: colWidths.test - 6 });
    currentX += colWidths.test;
    
    // Status with color
    const status = row["Status"] || 'N/A';
    const statusColor = getTestStatusColor(status);
    doc.fillColor(statusColor).text(status, currentX + 3, rowY + 8, { width: colWidths.status - 6 });
    currentX += colWidths.status;
    
    // Ticket
    const ticket = row["Issues (case)"] || 'None';
    doc.fillColor('black').text(ticket, currentX + 3, rowY + 8, { width: colWidths.ticket - 6 });
    currentX += colWidths.ticket;
    
    // Bugs
    const bugs = row["bugs"] || 'None';
    const truncatedBugs = bugs.length > 20 ? bugs.substring(0, 17) + '...' : bugs;
    doc.text(truncatedBugs, currentX + 3, rowY + 8, { width: colWidths.bugs - 6 });
    
    doc.y = rowY + rowHeight;
  });
  
  // Add note for additional test cases
  if (data.length > 20) {
    doc.moveDown()
       .fontSize(10)
       .fillColor('#666')
       .text(`Note: Showing first 20 test cases out of ${data.length} total cases.`, { align: 'center' });
  }
}

// ===== MAIN EXPORT FUNCTION =====
module.exports = async function generatePdf(data, metrics, generalStatus) {
  const doc = new PDFDocument({ margin: 50 });
  const filePath = path.join(__dirname, '../reports', `report_${Date.now()}.pdf`);
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  try {
    // Add all sections
    addHeader(doc);
    addSummary(doc, metrics);
    addGeneralStatus(doc, generalStatus);
    await addStatusChart(doc, metrics);
    await addTesterChart(doc, metrics);
    addDetailedTable(doc, data);
    
    doc.end();
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
