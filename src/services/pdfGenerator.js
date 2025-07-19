const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const primaryFont = './src/assets/fonts/FrutigerLTArabic-75Black.ttf'
const secondaryFont='./src/assets/fonts/FrutigerLTArabic-45Light.ttf'

const chartCanvas = new ChartJSNodeCanvas({
    width: 800,  
    height: 600, 
    backgroundColour: 'white',
    dpi: 300,
});

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
          position: 'bottom',
          labels: {
            font: {
              size: 18  
            }
          }
        },
        title: {
          display: true,
          text: 'Test Status Distribution',
          font: {
            size: 22,  
            weight: 'bold'
          }
        }
      }
    }
  };

  const chartBuffer = await chartCanvas.renderToBuffer(config);
  const passedPercentage = percentages.Passed;

  return { chartBuffer, passedPercentage };
}

// ===== PDF GENERATION SECTIONS =====
function addHeader(doc) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const availableWidth = pageWidth - (margin * 2);
  
  // Logo section
  const logoPath = path.join( './public/logo.png');
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, margin, 40, { width: 120 });
    }
  } catch (error) {
    console.error('Error loading logo:', error);
  }
  
  // Title section (center-aligned for landscape)
  doc.font(primaryFont)
     .fontSize(18)
     .fillColor('#2d2e80')
     .text('Test Summary Report', 0, 50, { width: pageWidth, align: 'center' });
  
  // Date section (center-aligned under title)
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.font(secondaryFont)
     .fontSize(12)
     .fillColor('#6c757d')
     .text(currentDate, 0, 75, { width: pageWidth, align: 'center' });
  
  // Add a horizontal line separator
  doc.moveTo(margin, 110)
     .lineTo(pageWidth - margin, 110)
     .strokeColor('#dee2e6')
     .lineWidth(2)
     .stroke();
  
  doc.y = 130; // Set position after header
}

function addSubTitle(doc){
  doc.font(primaryFont)
     .fontSize(20)
     .fillColor('#2d2e80')
     .text('Quality Assurance - Portfolio Control', {align: 'center' });
  doc.moveDown(0.5);
}

function addLandscapeSummaryWithChart(doc, metrics, generalStatus) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const availableWidth = pageWidth - (margin * 2);

  // Adjusted layout - make chart column wider
  const leftColumnWidth = Math.floor(availableWidth * 0.25);
  const chartColumnWidth = Math.floor(availableWidth * 0.50);
  const rightColumnWidth = Math.floor(availableWidth * 0.25);

  const summaryX = margin;
  const chartX = margin + leftColumnWidth + 15;
  const statsX = margin + leftColumnWidth + chartColumnWidth + 30;

  const contentY = doc.y;
  const sectionHeight = 400;

  // ===== LEFT COLUMN: General Status & Basic Info =====
  doc.rect(summaryX, contentY, leftColumnWidth, sectionHeight)
     .fillColor('#f8f9fa')
     .fill()
     .strokeColor('#dee2e6')
     .lineWidth(1)
     .stroke();

  // General Status
  const modifiedStatus = generalStatus.replace(/_/g, ' ');
  const statusColor = getGeneralStatusColor(modifiedStatus);

  const statusBoxHeight = 70;
  doc.rect(summaryX + 15, contentY + 20, leftColumnWidth - 30, statusBoxHeight)
     .fillColor('white')
     .fill()
     .strokeColor(statusColor)
     .lineWidth(3)
     .stroke();

  doc.font(primaryFont)
     .fontSize(12)
     .fillColor('#495057')
     .text('General Status:', summaryX + 25, contentY + 35);

  doc.font(secondaryFont)
     .fontSize(12)
     .fillColor(statusColor)
     .text(modifiedStatus, summaryX + 25, contentY + 55);

  // Pass Rate
  const totalTests = metrics.totalCases;
  const passRate = totalTests > 0 ? ((metrics.statusCounts.Passed / totalTests) * 100).toFixed(1) : 0;

  let currentY = contentY + 110;
  doc.font(primaryFont)
     .fontSize(14)
     .fillColor('#2d2e80')
     .text('Overview', summaryX + 20, currentY);

  currentY += 30;
  doc.font(secondaryFont)
     .fontSize(12)
     .fillColor('#495057')
     .text('Pass Rate: ', summaryX + 20, currentY, { continued: true })
     .font(primaryFont)
     .fillColor(passRate >= 80 ? '#28a745' : passRate >= 60 ? '#ffc107' : '#dc3545')
     .text(`${passRate}%`);

  currentY += 25;
  doc.font(secondaryFont)
     .fontSize(12)
     .fillColor('#495057')
     .text('Total Cases: ', summaryX + 20, currentY, { continued: true })
     .font(primaryFont)
     .fillColor('#2d2e80')
     .text(`${metrics.totalCases}`);

  currentY += 25;
  doc.font(secondaryFont)
     .fontSize(12)
     .fillColor('#495057')
     .text('Total Bugs: ', summaryX + 20, currentY, { continued: true })
     .font(primaryFont)
     .fillColor('#dc3545')
     .text(`${metrics.bugCount}`);

  // Testers section
  const testersY = contentY + sectionHeight - 80;
  doc.font(secondaryFont)
     .fontSize(11)
     .fillColor('#495057')
     .text('Tester(s):', summaryX + 20, testersY);

  if (metrics.testers && metrics.testers.length > 0) {
    const testersText = metrics.testers.join(', ');
    doc.font(primaryFont)
       .fontSize(10)
       .fillColor('#2d2e80')
       .text(testersText, summaryX + 20, testersY + 15, {
         width: leftColumnWidth - 40,
         align: 'left',
         lineGap: 2
       });
  }

  // ===== MIDDLE COLUMN: Chart (Now Larger) =====
  doc.rect(chartX, contentY, chartColumnWidth, sectionHeight)
     .fillColor('#ffffff')
     .fill()
     .strokeColor('#dee2e6')
     .lineWidth(1)
     .stroke();

  // Store chart position for later use - with more space
  doc._chartX = chartX + 20;
  doc._chartY = contentY + 20;
  doc._chartWidth = chartColumnWidth - 40;
  doc._chartHeight = sectionHeight - 40;

  // ===== RIGHT COLUMN: Detailed Statistics =====
  doc.rect(statsX, contentY, rightColumnWidth, sectionHeight)
     .fillColor('#f8f9fa')
     .fill()
     .strokeColor('#dee2e6')
     .lineWidth(1)
     .stroke();

  doc.font(primaryFont)
     .fontSize(14)
     .fillColor('#2d2e80')
     .text('Test Breakdown', statsX + 20, contentY + 20);

  currentY = contentY + 50;
  const stats = [
    { label: 'Passed', value: metrics.statusCounts.Passed, color: '#28a745' },
    { label: 'Failed', value: metrics.statusCounts.Failed, color: '#dc3545' },
    { label: 'Untested', value: metrics.statusCounts.Untested, color: '#ffc107' },
    { label: 'Other', value: metrics.statusCounts.Other, color: '#6c757d' }
  ];

  stats.forEach((stat, index) => {
    const y = currentY + (index * 35);
    const percentage = totalTests > 0 ? ((stat.value / totalTests) * 100).toFixed(1) : 0;

    doc.font(secondaryFont)
       .fontSize(12)
       .fillColor('#495057')
       .text(`${stat.label}:`, statsX + 40, y + 2);

    doc.font(primaryFont)
       .fontSize(12)
       .fillColor(stat.color)
       .text(`${stat.value} (${percentage}%)`, statsX + 40, y + 16);
  });

  // Update document position
  doc.y = contentY + sectionHeight + 30;
}

async function addLandscapeChart(doc, metrics) {
  const { chartBuffer } = await createStatusChart(metrics.statusCounts);
  
  // Use stored chart position
  const chartX = doc._chartX;
  const chartY = doc._chartY;
  const maxWidth = doc._chartWidth;
  const maxHeight = doc._chartHeight;
  
  // Calculate chart size maintaining aspect ratio - use larger base size
  const chartAspectRatio = 800 / 600; // Updated aspect ratio from new canvas size
  let chartWidth = maxWidth;
  let chartHeight = chartWidth / chartAspectRatio;
  
  if (chartHeight > maxHeight) {
    chartHeight = maxHeight;
    chartWidth = chartHeight * chartAspectRatio;
  }
  
  // Center the chart in the available space
  const finalX = chartX + (maxWidth - chartWidth) / 2;
  const finalY = chartY + (maxHeight - chartHeight) / 2;
  
  doc.image(chartBuffer, finalX, finalY, { 
    width: chartWidth, 
    height: chartHeight 
  });
  
  // Clean up stored properties
  delete doc._chartX;
  delete doc._chartY;
  delete doc._chartWidth;
  delete doc._chartHeight;
}

function addLandscapeDetailedTable(doc, data) {
  doc.addPage();

  doc.font(primaryFont)
     .fontSize(18)
     .fillColor('#2d2e80')
     .text('Detailed Test Cases', { align: 'center' })
     .moveDown(0.5);

  // Enhanced table configuration for landscape
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const availableWidth = pageWidth - (margin * 2);

  const tableTop = doc.y;
  const colWidths = {
    test: Math.floor(availableWidth * 0.45),
    status: Math.floor(availableWidth * 0.15),
    ticket: Math.floor(availableWidth * 0.18),
    bugs: Math.floor(availableWidth * 0.22)
  };

  const totalTableWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);

  // Draw table headers with proper styling
  const headerHeight = 35;

  // Draw header background
  doc.rect(margin, tableTop, totalTableWidth, headerHeight)
     .fillColor('#2d2e80')
     .fill();

  // Set text properties for headers
  doc.font(primaryFont)
     .fontSize(12)
     .fillColor('white'); // Ensure white text color

  let currentX = margin;
  const headers = ['Test Case', 'Status', 'Ticket', 'Bugs'];
  const widths = Object.values(colWidths);

  headers.forEach((header, index) => {
    // Add text with proper vertical centering
    const textY = tableTop + (headerHeight - 12) / 2; // Center text vertically
    doc.text(header, currentX + 8, textY, {
      width: widths[index] - 16,
      align: 'left'
    });
    currentX += widths[index];
  });

  // Draw header border
  doc.strokeColor('#dee2e6')
     .lineWidth(1)
     .rect(margin, tableTop, totalTableWidth, headerHeight)
     .stroke();

  // Reset position for table rows
  doc.y = tableTop + headerHeight;

  // Calculate how many rows can fit per page
  const availableHeight = doc.page.height - doc.y - margin;
  const rowHeight = 35;
  const maxRowsPerPage = Math.floor(availableHeight / rowHeight);

  // Draw table rows with pagination
  const totalRows = Math.min(data.length, 50); // Limit to 50 rows max
  let currentRow = 0;

  while (currentRow < totalRows) {
    const rowsOnThisPage = Math.min(maxRowsPerPage, totalRows - currentRow);

    for (let i = 0; i < rowsOnThisPage; i++) {
      const row = data[currentRow + i];
      const rowY = doc.y;

      // Alternate row colors
      const fillColor = i % 2 === 0 ? '#f8f9fa' : 'white';
      doc.rect(margin, rowY, totalTableWidth, rowHeight).fillColor(fillColor).fill();

      // Draw cell borders
      doc.strokeColor('#dee2e6').lineWidth(0.5);
      let lineX = margin;

      // Vertical lines
      for (let j = 0; j <= 4; j++) {
        doc.moveTo(lineX, rowY).lineTo(lineX, rowY + rowHeight).stroke();
        if (j < 4) {
          lineX += widths[j];
        }
      }

      // Horizontal line
      doc.moveTo(margin, rowY + rowHeight).lineTo(margin + totalTableWidth, rowY + rowHeight).stroke();

      // Add cell content
      doc.fontSize(10);
      currentX = margin;

      // Test case name
      const testName = row["Test"] || 'N/A';
      const maxTestChars = Math.floor(colWidths.test / 6); // Approximate chars that fit
      const truncatedTest = testName.length > maxTestChars ? testName.substring(0, maxTestChars - 3) + '...' : testName;
      doc.fillColor('black').text(truncatedTest, currentX + 8, rowY + 10, { width: colWidths.test - 16 });
      currentX += colWidths.test;

      // Status with color
      const status = row["Status"] || 'N/A';
      const statusColor = getTestStatusColor(status);
      doc.fillColor(statusColor)
         .font(primaryFont)
         .text(status, currentX + 8, rowY + 10, { width: colWidths.status - 16 });
      currentX += colWidths.status;

      // Ticket
      const ticket = row["Issues (case)"] || 'None';
      doc.fillColor('black')
         .font(secondaryFont)
         .text(ticket, currentX + 8, rowY + 10, { width: colWidths.ticket - 16 });
      currentX += colWidths.ticket;

      // Bugs
      const bugs = row["bugs"] || 'None';
      const maxBugChars = Math.floor(colWidths.bugs / 6);
      const truncatedBugs = bugs.length > maxBugChars ? bugs.substring(0, maxBugChars - 3) + '...' : bugs;
      doc.text(truncatedBugs, currentX + 8, rowY + 10, { width: colWidths.bugs - 16 });

      doc.y = rowY + rowHeight;
    }

    currentRow += rowsOnThisPage;

    // Add new page if there are more rows
    if (currentRow < totalRows) {
      doc.addPage();
      doc.y = margin + 50; // Leave space at top of new page
    }
  }
}

function addNotes(doc, notes) {
  if (!notes || notes.trim() === '') {
    return;
  }
  
  doc.addPage();
  
  doc.font(primaryFont)
     .fontSize(18)
     .fillColor('#2d2e80')
     .text('Notes', { align: 'center' })
     .moveDown(1);
  
  // Create a bordered box for notes in landscape
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const availableWidth = pageWidth - (margin * 2);
  const notesHeight = 400;
  
  doc.rect(margin, doc.y, availableWidth, notesHeight)
     .fillColor('#f8f9fa')
     .fill()
     .strokeColor('#dee2e6')
     .lineWidth(1)
     .stroke();
  
  doc.font(secondaryFont)
     .fontSize(12)
     .fillColor('black')
     .text(notes.trim(), margin + 20, doc.y + 20, { 
       width: availableWidth - 40,
       align: 'justify', 
       lineGap: 3 
     });
}

module.exports = async function generatePdf(data, metrics, generalStatus, notes) {
  // MAIN CHANGE: Set page size to landscape
  const doc = new PDFDocument({ 
    margin: 40,          
    size: 'A4',
    layout: 'landscape', 
    print_media_type: true,
    dpi: 400 
  });
  
  const filePath = path.join(__dirname, '../reports', `report_${Date.now()}.pdf`);
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);
  
  try {
    // Enhanced front page with landscape layout
    addHeader(doc);
    addSubTitle(doc);
    addLandscapeSummaryWithChart(doc, metrics, generalStatus);
    await addLandscapeChart(doc, metrics);
    
    // Detailed table with landscape optimization
    addLandscapeDetailedTable(doc, data);
    
    // Notes page if provided
    if (notes && notes.trim() !== '') {
      addNotes(doc, notes);
    }
    
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
