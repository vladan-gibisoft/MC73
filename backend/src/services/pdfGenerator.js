/**
 * Payment Slip PDF Generator
 * Generates A4 PDF with Serbian payment slips (uplatnica)
 *
 * Layout: 3 payment slips per A4 page with dotted cut lines
 * Labels: Serbian Cyrillic
 * Data: From database (Latin or Cyrillic as entered)
 */

const PDFDocument = require('pdfkit');
const { generatePaymentQRCode } = require('./qrCode');
const { formatForDisplay } = require('./bankAccount');

// A4 dimensions in points (1 point = 1/72 inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Slip dimensions (3 slips per page)
const SLIP_HEIGHT = A4_HEIGHT / 3;
const SLIP_WIDTH = A4_WIDTH;

// Margins and padding
const MARGIN = 20;
const PADDING = 10;
const LINE_HEIGHT = 14;

// QR code size
const QR_SIZE = 120;

/**
 * Serbian Cyrillic labels for payment slip fields
 */
const LABELS = {
  payer: 'uplatilac',
  purpose: 'svrha uplate',
  recipient: 'primalac',
  paymentCode: 'sifra placanja',
  currency: 'valuta',
  amount: 'iznos',
  recipientAccount: 'racun primaoca',
  model: 'broj modela',
  reference: 'poziv na broj (odobrenje)',
  qrLabel: 'NBS IPS QR'
};

/**
 * Fixed payment purpose text (Serbian Cyrillic)
 */
const PAYMENT_PURPOSE = 'Mesecno odrzavanje zgrade';

/**
 * Generate payer info lines
 * @param {Object} apartment - Apartment data
 * @param {Object} building - Building data
 * @returns {string[]} Array of payer info lines
 */
function generatePayerInfo(apartment, building) {
  // Line 1: Owner name
  const line1 = apartment.owner_name;

  // Line 2: Address with floor/apartment
  const line2 = `${building.address}, sprat ${apartment.floor_number}, stan ${apartment.apartment_on_floor}`;

  // Line 3: City
  const line3 = building.city;

  return [line1, line2, line3];
}

/**
 * Generate recipient info
 * @param {Object} building - Building data
 * @returns {string} Recipient info string
 */
function generateRecipientInfo(building) {
  return `Stambena zajednica ${building.address}, ${building.city}`;
}

/**
 * Generate reference number
 * @param {number} apartmentNumber - Apartment number
 * @param {number} month - Billing month
 * @returns {string} Reference number in XX/YY format
 */
function generateReferenceNumber(apartmentNumber, month) {
  const apt = String(apartmentNumber).padStart(2, '0');
  const mon = String(month).padStart(2, '0');
  return `${apt}/${mon}`;
}

/**
 * Draw a single payment slip on the PDF
 * @param {PDFDocument} doc - PDF document
 * @param {Object} apartment - Apartment data
 * @param {Object} building - Building data
 * @param {number} month - Billing month
 * @param {number} year - Billing year
 * @param {number} slipIndex - Slip index on page (0-2)
 * @param {Buffer|null} qrCodeBuffer - QR code image buffer
 */
function drawPaymentSlip(doc, apartment, building, month, year, slipIndex, qrCodeBuffer) {
  const yOffset = slipIndex * SLIP_HEIGHT;

  // Draw border
  doc.rect(MARGIN, yOffset + MARGIN, SLIP_WIDTH - 2 * MARGIN, SLIP_HEIGHT - 2 * MARGIN)
    .stroke();

  // Calculate layout positions
  const leftColumnWidth = (SLIP_WIDTH - 2 * MARGIN) * 0.55;
  const rightColumnX = MARGIN + leftColumnWidth + PADDING;
  const contentStartY = yOffset + MARGIN + PADDING;

  // === LEFT COLUMN ===
  let currentY = contentStartY;

  // Payer section (uplatilac)
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.payer.toUpperCase(), MARGIN + PADDING, currentY);
  currentY += LINE_HEIGHT;

  doc.fontSize(10).fillColor('#000');
  const payerLines = generatePayerInfo(apartment, building);
  payerLines.forEach(line => {
    doc.text(line, MARGIN + PADDING, currentY, { width: leftColumnWidth - 2 * PADDING });
    currentY += LINE_HEIGHT;
  });

  currentY += LINE_HEIGHT;

  // Payment purpose section (svrha uplate)
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.purpose.toUpperCase(), MARGIN + PADDING, currentY);
  currentY += LINE_HEIGHT;

  doc.fontSize(10).fillColor('#000')
    .text(PAYMENT_PURPOSE, MARGIN + PADDING, currentY, { width: leftColumnWidth - 2 * PADDING });
  currentY += LINE_HEIGHT * 2;

  // Recipient section (primalac)
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.recipient.toUpperCase(), MARGIN + PADDING, currentY);
  currentY += LINE_HEIGHT;

  doc.fontSize(10).fillColor('#000')
    .text(generateRecipientInfo(building), MARGIN + PADDING, currentY, { width: leftColumnWidth - 2 * PADDING });

  // === RIGHT COLUMN ===
  currentY = contentStartY;
  const rightFieldWidth = (SLIP_WIDTH - 2 * MARGIN - leftColumnWidth - 2 * PADDING) / 2;

  // Row 1: Payment Code | Currency | Amount
  // Payment code (empty)
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.paymentCode.toUpperCase(), rightColumnX, currentY);
  currentY += LINE_HEIGHT;
  doc.fontSize(10).fillColor('#000')
    .text('', rightColumnX, currentY); // Empty
  currentY += LINE_HEIGHT + 5;

  // Currency
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.currency.toUpperCase(), rightColumnX, currentY);
  doc.text(LABELS.amount.toUpperCase(), rightColumnX + rightFieldWidth, currentY);
  currentY += LINE_HEIGHT;

  const amount = apartment.override_amount || building.default_amount;
  doc.fontSize(10).fillColor('#000')
    .text('RSD', rightColumnX, currentY)
    .text(amount.toLocaleString('sr-RS', { minimumFractionDigits: 2 }), rightColumnX + rightFieldWidth, currentY);
  currentY += LINE_HEIGHT + 5;

  // Recipient account
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.recipientAccount.toUpperCase(), rightColumnX, currentY);
  currentY += LINE_HEIGHT;

  doc.fontSize(10).fillColor('#000')
    .text(formatForDisplay(building.bank_account), rightColumnX, currentY);
  currentY += LINE_HEIGHT + 5;

  // Model (empty)
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.model.toUpperCase(), rightColumnX, currentY);
  currentY += LINE_HEIGHT;
  doc.fontSize(10).fillColor('#000')
    .text('', rightColumnX, currentY); // Empty
  currentY += LINE_HEIGHT + 5;

  // Reference number
  doc.fontSize(8).fillColor('#666')
    .text(LABELS.reference.toUpperCase(), rightColumnX, currentY);
  currentY += LINE_HEIGHT;

  const refNumber = generateReferenceNumber(apartment.apartment_number, month);
  doc.fontSize(10).fillColor('#000')
    .text(refNumber, rightColumnX, currentY);

  // === QR CODE ===
  if (qrCodeBuffer) {
    const qrX = SLIP_WIDTH - MARGIN - PADDING - QR_SIZE;
    const qrY = yOffset + SLIP_HEIGHT - MARGIN - PADDING - QR_SIZE - LINE_HEIGHT;

    doc.image(qrCodeBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });

    // QR Label
    doc.fontSize(8).fillColor('#666')
      .text(LABELS.qrLabel, qrX, qrY + QR_SIZE + 2, {
        width: QR_SIZE,
        align: 'center'
      });
  }

  // === SIGNATURE LINES ===
  const signatureY = yOffset + SLIP_HEIGHT - MARGIN - PADDING - 30;
  const signatureWidth = 100;

  // Payer signature
  doc.moveTo(MARGIN + PADDING, signatureY)
    .lineTo(MARGIN + PADDING + signatureWidth, signatureY)
    .stroke();
  doc.fontSize(7).fillColor('#666')
    .text('potpis uplatioca', MARGIN + PADDING, signatureY + 3, { width: signatureWidth, align: 'center' });

  // Stamp area
  const stampX = MARGIN + PADDING + signatureWidth + 30;
  doc.moveTo(stampX, signatureY)
    .lineTo(stampX + signatureWidth, signatureY)
    .stroke();
  doc.text('pecat i potpis', stampX, signatureY + 3, { width: signatureWidth, align: 'center' });

  // === CUT LINE (dotted) ===
  if (slipIndex < 2) {
    const cutLineY = yOffset + SLIP_HEIGHT;
    doc.dash(5, { space: 3 })
      .moveTo(0, cutLineY)
      .lineTo(SLIP_WIDTH, cutLineY)
      .stroke()
      .undash();
  }
}

/**
 * Generate payment slips PDF for all apartments
 * @param {Object[]} apartments - Array of apartment data
 * @param {Object} building - Building data
 * @param {number} month - Billing month (1-12)
 * @param {number} year - Billing year
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generatePaymentSlipsPDF(apartments, building, month, year) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Sort apartments by number
      const sortedApartments = [...apartments].sort((a, b) => a.apartment_number - b.apartment_number);

      // Generate QR codes for all apartments
      const qrCodes = await Promise.all(
        sortedApartments.map(async (apt) => {
          try {
            return await generatePaymentQRCode(apt, building, month, year, QR_SIZE);
          } catch (err) {
            console.error(`Failed to generate QR for apartment ${apt.apartment_number}:`, err);
            return null; // Continue without QR if API fails
          }
        })
      );

      // Draw slips (3 per page)
      for (let i = 0; i < sortedApartments.length; i++) {
        const slipIndex = i % 3;

        // Add new page if needed (not for first slip)
        if (i > 0 && slipIndex === 0) {
          doc.addPage();
        }

        drawPaymentSlip(
          doc,
          sortedApartments[i],
          building,
          month,
          year,
          slipIndex,
          qrCodes[i]
        );
      }

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate PDF filename
 * @param {number} month - Billing month
 * @param {number} year - Billing year
 * @returns {string} Filename
 */
function generatePDFFilename(month, year) {
  const monthStr = String(month).padStart(2, '0');
  return `uplatnice_${year}_${monthStr}.pdf`;
}

module.exports = {
  generatePaymentSlipsPDF,
  generatePDFFilename,
  generateReferenceNumber
};
