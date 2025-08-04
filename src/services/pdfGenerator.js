import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
    primary: '#2d2e80',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    light: '#f8f9fa',
    border: '#dee2e6',
    white: '#ffffff',
    black: '#000000'
};

const STATUS_COLORS = {
    PASSED: COLORS.success,
    FAILED: COLORS.danger,
    'PASSED WITH ISSUES': COLORS.warning,
    passed: COLORS.success,
    failed: COLORS.danger,
    untested: COLORS.warning
};

const PDF_CONFIG = {
    margin: 40,
    size: 'A4',
    layout: 'landscape',
    print_media_type: true,
    dpi: 400
};

// Font management class
class FontManager {
    constructor() {
        this.primaryFont = path.join(process.cwd(), 'src/assets/fonts/FrutigerLTArabic-75Black.ttf');
        this.secondaryFont = path.join(process.cwd(), 'src/assets/fonts/FrutigerLTArabic-45Light.ttf');
        this.primaryFontExists = fs.existsSync(this.primaryFont);
        this.secondaryFontExists = fs.existsSync(this.secondaryFont);

        console.log('Primary font exists:', this.primaryFontExists, this.primaryFont);
        console.log('Secondary font exists:', this.secondaryFontExists, this.secondaryFont);
    }

    setPrimaryFont(doc) {
        try {
            if (this.primaryFontExists) {
                doc.font(this.primaryFont);
            } else {
                doc.font('Helvetica-Bold');
            }
        } catch (error) {
            doc.font('Helvetica-Bold');
        }
        return doc;
    }

    setSecondaryFont(doc) {
        try {
            if (this.secondaryFontExists) {
                doc.font(this.secondaryFont);
            } else {
                doc.font('Helvetica');
            }
        } catch (error) {
            doc.font('Helvetica');
        }
        return doc;
    }
}

// Utility functions
class Utils {
    static calculatePercentages(statusCounts) {
        const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
        const percentages = {};

        for (const [status, count] of Object.entries(statusCounts)) {
            percentages[status] = ((count / total) * 100).toFixed(2);
        }

        return percentages;
    }

    static getStatusColor(status, isGeneral = false) {
        const normalizedStatus = isGeneral ? status : status.toLowerCase();
        return STATUS_COLORS[normalizedStatus] || COLORS.black;
    }

    static truncateText(text, maxLength) {
        if (!text) return 'N/A';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    static getEnvironmentConfig() {
        const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
        const reportsDir = isVercel ? '/tmp' : path.join(__dirname, '../reports');
        return { isVercel, reportsDir };
    }
}

// Header section builder
class HeaderBuilder {
    constructor(fontManager) {
        this.fontManager = fontManager;
    }

    build(doc) {
        const pageWidth = doc.page.width;
        const margin = doc.page.margins.left;

        this._addLogo(doc, margin);
        this._addTitle(doc, pageWidth);
        this._addDate(doc, pageWidth);
        this._addSeparator(doc, margin, pageWidth);

        doc.y = 130;
    }

    _addLogo(doc, margin) {
        const logoPath = path.join(process.cwd(), 'public/logo.png');
        try {
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, margin, 40, { width: 120 });
            }
        } catch (error) {
            console.error('Error loading logo:', error);
        }
    }

    _addTitle(doc, pageWidth) {
        this.fontManager.setPrimaryFont(doc)
            .fontSize(18)
            .fillColor(COLORS.primary)
            .text('Test Summary Report', 0, 50, { width: pageWidth, align: 'center' });
    }

    _addDate(doc, pageWidth) {
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        this.fontManager.setSecondaryFont(doc)
            .fontSize(12)
            .fillColor(COLORS.secondary)
            .text(currentDate, 0, 75, { width: pageWidth, align: 'center' });
    }

    _addSeparator(doc, margin, pageWidth) {
        doc.moveTo(margin, 110)
            .lineTo(pageWidth - margin, 110)
            .strokeColor(COLORS.border)
            .lineWidth(2)
            .stroke();
    }
}

// Summary section builder
class SummaryBuilder {
    constructor(fontManager) {
        this.fontManager = fontManager;
    }

    build(doc, metrics, generalStatus) {
        const pageWidth = doc.page.width;
        const margin = doc.page.margins.left;
        const availableWidth = pageWidth - (margin * 2);

        const layout = this._calculateLayout(availableWidth, margin);

        this._addSubTitle(doc);
        const contentY = doc.y; // Get Y position AFTER subtitle
        const sectionHeight = 400;

        this._buildLeftColumn(doc, layout.summaryX, contentY, layout.leftColumnWidth, sectionHeight, metrics, generalStatus);
        this._buildMiddleColumn(doc, layout.middleX, contentY, layout.middleColumnWidth, sectionHeight, metrics);

        doc.y = contentY + sectionHeight + 30;
    }

    _calculateLayout(availableWidth, margin) {
        const leftColumnWidth = Math.floor(availableWidth * 0.5);
        const middleColumnWidth = Math.floor(availableWidth * 0.5);

        return {
            leftColumnWidth,
            middleColumnWidth,
            summaryX: margin,
            middleX: margin + leftColumnWidth + 20,
        };
    }

    _addSubTitle(doc) {
        this.fontManager.setPrimaryFont(doc)
            .fontSize(20)
            .fillColor(COLORS.primary)
            .text('Quality Assurance - Portfolio Control', { align: 'center' });
        doc.moveDown(0.5);
    }

    _buildLeftColumn(doc, x, y, width, height, metrics, generalStatus) {
        // Background
        doc.rect(x, y, width, height)
            .fillColor(COLORS.light)
            .fill()
            .strokeColor(COLORS.border)
            .lineWidth(1)
            .stroke();

        this._addGeneralStatus(doc, x, y, width, generalStatus);
        this._addOverviewStats(doc, x, y, metrics);
        this._addTesters(doc, x, y, width, height, metrics);
    }

    _addGeneralStatus(doc, x, y, width, generalStatus) {
        const modifiedStatus = generalStatus.replace(/_/g, ' ');
        const statusColor = Utils.getStatusColor(modifiedStatus, true);
        const statusBoxHeight = 70;

        doc.rect(x + 15, y + 20, width - 30, statusBoxHeight)
            .fillColor(COLORS.white)
            .fill()
            .strokeColor(statusColor)
            .lineWidth(3)
            .stroke();

        this.fontManager.setPrimaryFont(doc)
            .fontSize(12)
            .fillColor('#495057')
            .text('General Status:', x + 25, y + 35);

        this.fontManager.setPrimaryFont(doc)
            .fontSize(12)
            .fillColor(statusColor)
            .text(modifiedStatus, x + 25, y + 55);
    }

    _addOverviewStats(doc, x, y, metrics) {
        const totalTests = metrics.totalCases;
        const passRate = totalTests > 0 ? ((metrics.statusCounts.Passed / totalTests) * 100).toFixed(1) : 0;

        let currentY = y + 110;
        this.fontManager.setPrimaryFont(doc)
            .fontSize(14)
            .fillColor(COLORS.primary)
            .text('Overview', x + 20, currentY);

        currentY += 30;
        this._addStatLine(doc, x + 20, currentY, 'Pass Rate: ', `${passRate}%`,
            passRate >= 80 ? COLORS.success : passRate >= 60 ? COLORS.warning : COLORS.danger);

        currentY += 25;
        this._addStatLine(doc, x + 20, currentY, 'Total Cases: ', `${metrics.totalCases}`, COLORS.primary);

        currentY += 25;
        this._addStatLine(doc, x + 20, currentY, 'Total Bugs: ', `${metrics.bugCount}`, COLORS.danger);
    }

    _addStatLine(doc, x, y, label, value, valueColor) {
        this.fontManager.setSecondaryFont(doc)
            .fontSize(12)
            .fillColor('#495057')
            .text(label, x, y, { continued: true });

        this.fontManager.setPrimaryFont(doc)
            .fillColor(valueColor)
            .text(value);
    }

    _addTesters(doc, x, y, width, height, metrics) {
        const testersY = y + height - 80;
        this.fontManager.setSecondaryFont(doc)
            .fontSize(11)
            .fillColor('#495057')
            .text('Tester(s):', x + 20, testersY);

        if (metrics.testers && metrics.testers.length > 0) {
            const testersText = metrics.testers.join(', ');
            this.fontManager.setPrimaryFont(doc)
                .fontSize(10)
                .fillColor(COLORS.primary)
                .text(testersText, x + 20, testersY + 15, {
                width: width - 40,
                align: 'left',
                lineGap: 2
            });
        }
    }

    _buildMiddleColumn(doc, x, y, width, height, metrics) {
        doc.rect(x, y, width, height)
            .fillColor(COLORS.white)
            .fill()
            .strokeColor(COLORS.border)
            .lineWidth(1)
            .stroke();

        this.fontManager.setPrimaryFont(doc)
            .fontSize(14)
            .fillColor(COLORS.primary)
            .text('Status Distribution', x + 20, y + 20);

        this._addStatusBars(doc, x, y, width, metrics);
    }

    _addStatusBars(doc, x, y, width, metrics) {
        const totalTests = metrics.totalCases;
        let chartY = y + 60;

        const stats = [
            { label: 'Passed', value: metrics.statusCounts.Passed, color: COLORS.success },
            { label: 'Failed', value: metrics.statusCounts.Failed, color: COLORS.danger },
            { label: 'Untested', value: metrics.statusCounts.Untested, color: COLORS.warning },
            { label: 'Other', value: metrics.statusCounts.Other, color: COLORS.secondary }
        ];

        stats.forEach((stat, index) => {
            const barY = chartY + (index * 60);
            const percentage = totalTests > 0 ? ((stat.value / totalTests) * 100).toFixed(1) : 0;
            const barWidth = Math.floor((percentage / 100) * (width - 80));

            doc.rect(x + 20, barY, barWidth, 20)
                .fillColor(stat.color)
                .fill();

            this.fontManager.setSecondaryFont(doc)
                .fontSize(11)
                .fillColor('#495057')
                .text(`${stat.label}: ${stat.value} (${percentage}%)`, x + 20, barY + 25);
        });
    }

    _buildRightColumn(doc, x, y, width, height, metrics) {
        doc.rect(x-30, y, width, height)
            .fillColor(COLORS.light)
            .fill()
            .strokeColor(COLORS.border)
            .lineWidth(1)
            .stroke();

        this.fontManager.setPrimaryFont(doc)
            .fontSize(14)
            .fillColor(COLORS.primary)
            .text('Test Breakdown', x + 20, y + 20);

        this._addDetailedStats(doc, x, y, metrics);
    }

    _addDetailedStats(doc, x, y, metrics) {
        const totalTests = metrics.totalCases;
        let currentY = y + 50;

        const stats = [
            { label: 'Passed', value: metrics.statusCounts.Passed, color: COLORS.success },
            { label: 'Failed', value: metrics.statusCounts.Failed, color: COLORS.danger },
            { label: 'Untested', value: metrics.statusCounts.Untested, color: COLORS.warning },
            { label: 'Other', value: metrics.statusCounts.Other, color: COLORS.secondary }
        ];

        stats.forEach((stat, index) => {
            const statY = currentY + (index * 35);
            const percentage = totalTests > 0 ? ((stat.value / totalTests) * 100).toFixed(1) : 0;

            this.fontManager.setSecondaryFont(doc)
                .fontSize(12)
                .fillColor('#495057')
                .text(`${stat.label}:`, x + 40, statY + 2);

            this.fontManager.setPrimaryFont(doc)
                .fontSize(12)
                .fillColor(stat.color)
                .text(`${stat.value} (${percentage}%)`, x + 40, statY + 16);
        });
    }
}

// Table builder class
class TableBuilder {
    constructor(fontManager) {
        this.fontManager = fontManager;
    }

    build(doc, data) {
        doc.addPage();
        this._addTableTitle(doc);

        const layout = this._calculateTableLayout(doc);
        this._buildTableHeader(doc, layout);
        this._buildTableRows(doc, data, layout);
    }

    _addTableTitle(doc) {
        this.fontManager.setPrimaryFont(doc)
            .fontSize(18)
            .fillColor(COLORS.primary)
            .text('Detailed Test Cases', { align: 'center' })
            .moveDown(0.5);
    }

    _calculateTableLayout(doc) {
        const pageWidth = doc.page.width;
        const margin = doc.page.margins.left;
        const availableWidth = pageWidth - (margin * 2);

        const colWidths = {
            test: Math.floor(availableWidth * 0.45),
            status: Math.floor(availableWidth * 0.15),
            ticket: Math.floor(availableWidth * 0.18),
            bugs: Math.floor(availableWidth * 0.22)
        };

        const totalTableWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);

        return {
            margin,
            pageWidth,
            availableWidth,
            colWidths,
            totalTableWidth,
            headers: ['Test Case', 'Status', 'Ticket', 'Bugs'],
            widths: Object.values(colWidths),
            rowHeight: 35,
            headerHeight: 35
        };
    }

    _buildTableHeader(doc, layout) {
        const tableTop = doc.y;

        // Header background
        doc.rect(layout.margin, tableTop, layout.totalTableWidth, layout.headerHeight)
            .fillColor(COLORS.primary)
            .fill();

        // Header text
        this.fontManager.setPrimaryFont(doc)
            .fontSize(12)
            .fillColor(COLORS.white);

        let currentX = layout.margin;
        layout.headers.forEach((header, index) => {
            const textY = tableTop + (layout.headerHeight - 12) / 2;
            doc.text(header, currentX + 8, textY, {
                width: layout.widths[index] - 16,
                align: 'left'
            });
            currentX += layout.widths[index];
        });

        // Header border
        doc.strokeColor(COLORS.border)
            .lineWidth(1)
            .rect(layout.margin, tableTop, layout.totalTableWidth, layout.headerHeight)
            .stroke();

        doc.y = tableTop + layout.headerHeight;
    }

    _buildTableRows(doc, data, layout) {
        const availableHeight = doc.page.height - doc.y - layout.margin;
        const maxRowsPerPage = Math.floor(availableHeight / layout.rowHeight);
        const totalRows = Math.min(data.length, 50);
        let currentRow = 0;

        while (currentRow < totalRows) {
            const rowsOnThisPage = Math.min(maxRowsPerPage, totalRows - currentRow);
            this._drawRowsOnPage(doc, data, layout, currentRow, rowsOnThisPage);
            currentRow += rowsOnThisPage;

            if (currentRow < totalRows) {
                doc.addPage();
                doc.y = layout.margin + 50;
            }
        }
    }

    _drawRowsOnPage(doc, data, layout, startRow, rowCount) {
        for (let i = 0; i < rowCount; i++) {
            const row = data[startRow + i];
            const rowY = doc.y;

            this._drawRowBackground(doc, layout, rowY, i);
            this._drawRowBorders(doc, layout, rowY);
            this._drawRowContent(doc, layout, row, rowY);

            doc.y = rowY + layout.rowHeight;
        }
    }

    _drawRowBackground(doc, layout, rowY, rowIndex) {
        const fillColor = rowIndex % 2 === 0 ? COLORS.light : COLORS.white;
        doc.rect(layout.margin, rowY, layout.totalTableWidth, layout.rowHeight)
            .fillColor(fillColor)
            .fill();
    }

    _drawRowBorders(doc, layout, rowY) {
        doc.strokeColor(COLORS.border).lineWidth(0.5);

        // Vertical lines
        let lineX = layout.margin;
        for (let j = 0; j <= 4; j++) {
            doc.moveTo(lineX, rowY)
                .lineTo(lineX, rowY + layout.rowHeight)
                .stroke();
            if (j < 4) {
                lineX += layout.widths[j];
            }
        }

        // Horizontal line
        doc.moveTo(layout.margin, rowY + layout.rowHeight)
            .lineTo(layout.margin + layout.totalTableWidth, rowY + layout.rowHeight)
            .stroke();
    }

    _drawRowContent(doc, layout, row, rowY) {
        doc.fontSize(10);
        let currentX = layout.margin;

        // Test case name
        const testName = Utils.truncateText(row["Test"], Math.floor(layout.colWidths.test / 6));
        doc.fillColor(COLORS.black)
            .text(testName, currentX + 8, rowY + 10, { width: layout.colWidths.test - 16 });
        currentX += layout.colWidths.test;

        // Status with color
        const status = row["Status"] || 'N/A';
        const statusColor = Utils.getStatusColor(status);
        this.fontManager.setPrimaryFont(doc)
            .fillColor(statusColor)
            .text(status, currentX + 8, rowY + 10, { width: layout.colWidths.status - 16 });
        currentX += layout.colWidths.status;

        // Ticket
        const ticket = row["Issues (case)"] || 'None';
        this.fontManager.setSecondaryFont(doc)
            .fillColor(COLORS.black)
            .text(ticket, currentX + 8, rowY + 10, { width: layout.colWidths.ticket - 16 });
        currentX += layout.colWidths.ticket;

        // Bugs
        const bugs = Utils.truncateText(row["bugs"], Math.floor(layout.colWidths.bugs / 6));
        doc.text(bugs, currentX + 8, rowY + 10, { width: layout.colWidths.bugs - 16 });
    }
}

// Notes builder class
class NotesBuilder {
    constructor(fontManager) {
        this.fontManager = fontManager;
    }

    build(doc, notes) {
        if (!notes || notes.trim() === '') {
            return;
        }

        doc.addPage();

        this.fontManager.setPrimaryFont(doc)
            .fontSize(18)
            .fillColor(COLORS.primary)
            .text('Notes', { align: 'center' })
            .moveDown(1);

        const layout = this._calculateNotesLayout(doc);
        this._drawNotesBox(doc, layout, notes);
    }

    _calculateNotesLayout(doc) {
        const pageWidth = doc.page.width;
        const margin = doc.page.margins.left;
        const availableWidth = pageWidth - (margin * 2);
        const notesHeight = 400;

        return { margin, availableWidth, notesHeight };
    }

    _drawNotesBox(doc, layout, notes) {
        doc.rect(layout.margin, doc.y, layout.availableWidth, layout.notesHeight)
            .fillColor(COLORS.light)
            .fill()
            .strokeColor(COLORS.border)
            .lineWidth(1)
            .stroke();

        this.fontManager.setSecondaryFont(doc)
            .fontSize(12)
            .fillColor(COLORS.black)
            .text(notes.trim(), layout.margin + 20, doc.y + 20, {
            width: layout.availableWidth - 40,
            align: 'justify',
            lineGap: 3
        });
    }
}

// Main PDF Generator class
class PDFGenerator {
    constructor() {
        this.fontManager = new FontManager();
        this.headerBuilder = new HeaderBuilder(this.fontManager);
        this.summaryBuilder = new SummaryBuilder(this.fontManager);
        this.tableBuilder = new TableBuilder(this.fontManager);
        this.notesBuilder = new NotesBuilder(this.fontManager);
    }

    async generate(data, metrics, generalStatus, notes) {
        const doc = new PDFDocument(PDF_CONFIG);
        const { isVercel, reportsDir } = Utils.getEnvironmentConfig();

        if (!isVercel) {
            await fs.ensureDir(reportsDir);
        }

        const filePath = path.join(reportsDir, `report_${Date.now()}.pdf`);
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        try {
            // Build PDF sections
            this.headerBuilder.build(doc);
            this.summaryBuilder.build(doc, metrics, generalStatus);
            this.tableBuilder.build(doc, data);
            this.notesBuilder.build(doc, notes);

            doc.end();

            return new Promise((resolve, reject) => {
                writeStream.on('finish', () => resolve(filePath));
                writeStream.on('error', reject);
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    }
}

// Export the main function
export default async function generatePdf(data, metrics, generalStatus, notes) {
    const generator = new PDFGenerator();
    return await generator.generate(data, metrics, generalStatus, notes);
}