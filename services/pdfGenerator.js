const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const width = 500;
const height = 300;
const chartCanvas = new ChartJSNodeCanvas({ width, height });
function calculatePercentages(statusCounts) {
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const percentages = {};

  for (const [status, count] of Object.entries(statusCounts)) {
    percentages[status] = ((count / total) * 100).toFixed(2); // Calculate percentage and round to 2 decimal places
  }

  return percentages;
}


async function createStatusChart(statusCounts) {
  const percentages = calculatePercentages(statusCounts);

  const labelsWithPercentages = Object.keys(statusCounts).map(status => {
    const count = statusCounts[status];
    const percentage = percentages[status];
    return `${status} (${percentage}%)`; // Append percentage to label
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
	      legend:{
		      display:true,
		      position:'right'
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
	doc.font('./assets/fonts/FrutigerLTArabic-75Black.ttf')
  doc.fontSize(20).text('QA Test Report', { align: 'center' }).moveDown(2);

  // ===== SUMMARY =====
  doc.fontSize(14).text(`Total Test Cases: ${metrics.totalCases}`);
  doc.text(`Passed: ${metrics.statusCounts.Passed}`);
  doc.text(`Failed: ${metrics.statusCounts.Failed}`);
  doc.text(`Untested: ${metrics.statusCounts.Untested}`);
  doc.text(`Other: ${metrics.statusCounts.Other}`);
  doc.text(`Total Bugs Reported: ${metrics.bugCount}`).moveDown();

  // ===== CHARTS =====
  const { chartBuffer, passedPercentage } = await createStatusChart(metrics.statusCounts);

  // Add the status chart image
  doc.image(chartBuffer, { fit: [500, 300], align: 'center' }).moveDown();

  // Add the "Passed" percentage next to the chart
 // doc.fontSize(12).text(`Passed Status Percentage: ${passedPercentage}%`, {
  //  align: 'left',
   // continued: true
 // }).moveDown();

  doc.addPage();

  // ===== ADD TESTER CHART =====
  const testerChart = await createTesterChart(metrics.testsByTester);
  doc.image(testerChart, { fit: [500, 300], align: 'center' }).moveDown();
 // ===== TABLE SECTION =====
  doc.addPage().fontSize(16).text('Detailed Test Cases:', { underline: true }).moveDown();

  // Table headers
	doc.font('./assets/fonts/FrutigerLTArabic-45Light.ttf')
  const tableTop = doc.y;
  const colWidths = {
    test: 200,
    status: 80,
    ticket: 80,
    bugs: 130
  };
  
  let currentX = 50;
  
  // Draw table headers
  doc.fontSize(12).fillColor('black');
  doc.rect(50, tableTop, 490, 25).fillColor('#f0f0f0').fill();
  doc.fillColor('black');
  
  doc.text('Test Case', currentX + 5, tableTop + 8, { width: colWidths.test });
  currentX += colWidths.test;
  doc.text('Status', currentX + 5, tableTop + 8, { width: colWidths.status });
  currentX += colWidths.status;
  doc.text('Ticket', currentX + 5, tableTop + 8, { width: colWidths.ticket });
  currentX += colWidths.ticket;
  doc.text('Bugs', currentX + 5, tableTop + 8, { width: colWidths.bugs });
  
  // Reset Y position for table rows
  doc.y = tableTop + 25;
  
  // Draw table rows
  data.slice(0, 20).forEach((row, index) => {
    const rowY = doc.y;
    const rowHeight = 30;
    
    // Alternate row colors
    if (index % 2 === 0) {
      doc.rect(50, rowY, 490, rowHeight).fillColor('#f9f9f9').fill();
    } else {
      doc.rect(50, rowY, 490, rowHeight).fillColor('white').fill();
    }
    
    // Draw vertical lines for columns
    doc.strokeColor('#ddd').lineWidth(0.5);
    let lineX = 50;
    for (let i = 0; i <= 4; i++) {
      doc.moveTo(lineX, rowY).lineTo(lineX, rowY + rowHeight).stroke();
      if (i < 4) {
        lineX += Object.values(colWidths)[i];
      }
    }
    
    // Draw horizontal line
    doc.moveTo(50, rowY + rowHeight).lineTo(540, rowY + rowHeight).stroke();
    
    // Add text content
    doc.fillColor('black').fontSize(9);
    currentX = 50;
    
    // Test case name (truncated if too long)
    const testName = row["Test"] || 'N/A';
    doc.text(testName.length > 40 ? testName.substring(0, 37) + '...' : testName, 
             currentX + 3, rowY + 8, { width: colWidths.test - 6 });
    currentX += colWidths.test;
    
    // Status with color coding
    const status = row["Status"] || 'N/A';
    let statusColor = 'black';
    if (status.toLowerCase() === 'passed') statusColor = '#4caf50';
    else if (status.toLowerCase() === 'failed') statusColor = '#f44336';
    else if (status.toLowerCase() === 'untested') statusColor = '#ff9800';
    
    doc.fillColor(statusColor);
    doc.text(status, currentX + 3, rowY + 8, { width: colWidths.status - 6 });
    doc.fillColor('black');
    currentX += colWidths.status;
    
    // Ticket
    const ticket = row["Issues (case)"] || 'None';
    doc.text(ticket, currentX + 3, rowY + 8, { width: colWidths.ticket - 6 });
    currentX += colWidths.ticket;
    
    // Bugs
    const bugs = row["bugs"] || 'None';
    doc.text(bugs.length > 20 ? bugs.substring(0, 17) + '...' : bugs, 
             currentX + 3, rowY + 8, { width: colWidths.bugs - 6 });
    
    doc.y = rowY + rowHeight;
  });
  
  // Add note if there are more test cases
  if (data.length > 20) {
    doc.moveDown().fontSize(10).fillColor('#666');
    doc.text(`Note: Showing first 20 test cases out of ${data.length} total cases.`, { align: 'center' });
  }

  doc.end();
  return new Promise(resolve => {
    writeStream.on('finish', () => resolve(filePath));
  });
};
