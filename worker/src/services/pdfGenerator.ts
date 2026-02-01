/**
 * Payment Slip PDF Generator for Cloudflare Workers
 * Generates A4 PDF with Serbian payment slips (uplatnica)
 *
 * Layout: 3 payment slips per A4 page with dotted cut lines
 * Labels: Serbian Cyrillic
 * Data: From database (Latin or Cyrillic as entered)
 */

// @ts-ignore - PDFKit types may not be perfectly aligned
import PDFDocument from 'pdfkit';
import { getNotoSansRegular, getNotoSansBold } from '../fonts/notoSans';
import { generatePaymentQRCode } from './qrCode';
import { formatForDisplay } from './bankAccount';
import type { Apartment, Building } from '../types';

// A4 dimensions in points (1 point = 1/72 inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Slip dimensions (3 slips per page)
const SLIP_HEIGHT = A4_HEIGHT / 3;
const SLIP_WIDTH = A4_WIDTH;

// Margins and padding
const MARGIN = 30;
const PADDING = 8;
const LINE_HEIGHT = 12;
const BOX_PADDING = 4;

// QR code size
const QR_SIZE = 80; // Display size
const QR_GENERATE_SIZE = 130; // Generation size (larger for better QR detail)

// Column widths (left section ~55%, right section ~45%)
const LEFT_SECTION_WIDTH = (SLIP_WIDTH - 2 * MARGIN) * 0.52;
const RIGHT_SECTION_WIDTH = (SLIP_WIDTH - 2 * MARGIN) * 0.48;
const DIVIDER_X = MARGIN + LEFT_SECTION_WIDTH;

/**
 * Serbian Cyrillic labels for payment slip fields
 */
const LABELS = {
  title: 'НАЛОГ ЗА УПЛАТУ',
  payer: 'уплатилац',
  purpose: 'сврха уплате',
  recipient: 'прималац',
  paymentCode: 'шифра плаћања',
  currency: 'валута',
  amount: 'износ',
  recipientAccount: 'рачун примаоца',
  model: 'број модела',
  reference: 'позив на број (одобрење)',
  payerSignature: 'печат и потпис уплатиоца',
  datePlace: 'место и датум пријема',
  valueDate: 'датум валуте',
  qrLabel: 'NBS IPS QR',
};

/**
 * Generate payer info lines
 */
function generatePayerInfo(apartment: Apartment, building: Building): string[] {
  // Line 1: Owner name
  const line1 = apartment.owner_name;

  // Line 2: Address with floor/apartment
  const line2 = `${building.address}, спрат ${apartment.floor_number}, стан ${apartment.apartment_number}`;

  // Line 3: City
  const line3 = building.city;

  return [line1, line2, line3];
}

/**
 * Generate recipient info
 */
function generateRecipientInfo(building: Building): string {
  return `${building.recipient_name} ${building.address}, ${building.city}`;
}

/**
 * Generate reference number
 * @param apartmentNumber - Apartment number
 * @param month - Billing month
 * @returns Reference number in XX-YY format
 */
export function generateReferenceNumber(apartmentNumber: number, month: number): string {
  const apt = String(apartmentNumber).padStart(2, '0');
  const mon = String(month).padStart(2, '0');
  return `${apt}-${mon}`;
}

/**
 * Draw a single payment slip on the PDF
 */
function drawPaymentSlip(
  doc: typeof PDFDocument,
  apartment: Apartment,
  building: Building,
  month: number,
  year: number,
  slipIndex: number,
  qrCodeBuffer: ArrayBuffer | null
): void {
  const yOffset = slipIndex * SLIP_HEIGHT;
  const slipTop = yOffset + MARGIN;
  const slipBottom = yOffset + SLIP_HEIGHT - MARGIN;
  const slipContentWidth = SLIP_WIDTH - 2 * MARGIN;

  // Box heights (used for layout calculations)
  const payerBoxHeight = 42;
  const purposeBoxHeight = 28;
  const recipientBoxHeight = 28;

  // Calculate divider bounds (aligned with left section boxes)
  const dividerTop = slipTop + PADDING + 10;
  const dividerBottom =
    dividerTop + payerBoxHeight + 8 + 10 + purposeBoxHeight + 8 + 10 + recipientBoxHeight;

  // Draw main outer border
  doc
    .strokeColor('#000000')
    .lineWidth(1)
    .rect(MARGIN, slipTop, slipContentWidth, SLIP_HEIGHT - 2 * MARGIN)
    .stroke();

  // Draw vertical divider between left and right sections
  doc.lineWidth(0.5).moveTo(DIVIDER_X, dividerTop).lineTo(DIVIDER_X, dividerBottom).stroke();

  // ========================================
  // LEFT SECTION
  // ========================================
  const leftX = MARGIN + PADDING;
  const leftWidth = LEFT_SECTION_WIDTH - 2 * PADDING;
  let leftY = slipTop + PADDING;

  // --- PAYER SECTION (уплатилац) ---
  doc.font('Serbian').fontSize(7).fillColor('#666666').text(LABELS.payer, leftX, leftY);
  leftY += 10;

  // Payer box (3 lines)
  doc.strokeColor('#000000').lineWidth(0.5).rect(leftX, leftY, leftWidth, payerBoxHeight).stroke();

  // Payer content
  const payerLines = generatePayerInfo(apartment, building);
  doc.font('Serbian').fontSize(9).fillColor('#000000');
  let payerContentY = leftY + BOX_PADDING;
  payerLines.forEach((line) => {
    doc.text(line, leftX + BOX_PADDING, payerContentY, {
      width: leftWidth - 2 * BOX_PADDING,
    });
    payerContentY += LINE_HEIGHT;
  });
  leftY += payerBoxHeight + 8;

  // --- PAYMENT PURPOSE SECTION (сврха уплате) ---
  doc.font('Serbian').fontSize(7).fillColor('#666666').text(LABELS.purpose, leftX, leftY);
  leftY += 10;

  // Purpose box
  doc
    .strokeColor('#000000')
    .lineWidth(0.5)
    .rect(leftX, leftY, leftWidth, purposeBoxHeight)
    .stroke();

  doc
    .font('Serbian')
    .fontSize(9)
    .fillColor('#000000')
    .text(building.payment_purpose, leftX + BOX_PADDING, leftY + BOX_PADDING, {
      width: leftWidth - 2 * BOX_PADDING,
    });
  leftY += purposeBoxHeight + 8;

  // --- RECIPIENT SECTION (прималац) ---
  doc.font('Serbian').fontSize(7).fillColor('#666666').text(LABELS.recipient, leftX, leftY);
  leftY += 10;

  // Recipient box (2 lines)
  doc
    .strokeColor('#000000')
    .lineWidth(0.5)
    .rect(leftX, leftY, leftWidth, recipientBoxHeight)
    .stroke();

  doc
    .font('Serbian')
    .fontSize(9)
    .fillColor('#000000')
    .text(generateRecipientInfo(building), leftX + BOX_PADDING, leftY + BOX_PADDING, {
      width: leftWidth - 2 * BOX_PADDING,
    });
  leftY += recipientBoxHeight + 12;

  // --- SIGNATURE SECTION ---
  const signatureY = slipBottom - 38;
  const sigFieldWidth = leftWidth / 2 - 10;

  // Payer signature line and label (shorter, on left side)
  doc
    .strokeColor('#000000')
    .lineWidth(0.5)
    .moveTo(leftX, signatureY)
    .lineTo(leftX + sigFieldWidth, signatureY)
    .stroke();

  doc
    .font('Serbian')
    .fontSize(7)
    .fillColor('#666666')
    .text(LABELS.payerSignature, leftX, signatureY + 3, {
      width: sigFieldWidth,
      align: 'center',
    });

  // Date fields at bottom
  const dateY = slipBottom - 18;

  // Place and date of receipt (in the middle, where value date was)
  const datePlaceX = leftX + leftWidth - sigFieldWidth;
  doc.moveTo(datePlaceX, dateY).lineTo(datePlaceX + sigFieldWidth, dateY).stroke();
  doc.text(LABELS.datePlace, datePlaceX, dateY + 3, {
    width: sigFieldWidth,
    align: 'center',
  });

  // ========================================
  // RIGHT SECTION
  // ========================================
  const rightX = DIVIDER_X + PADDING;
  const rightWidth = RIGHT_SECTION_WIDTH - 2 * PADDING;
  let rightY = slipTop + PADDING;

  // --- HEADER (НАЛОГ ЗА УПЛАТУ) ---
  doc
    .font('Serbian-Bold')
    .fontSize(11)
    .fillColor('#000000')
    .text(LABELS.title, rightX, rightY, { width: rightWidth, align: 'right' });
  rightY += 5;

  // Calculate column widths for the 3-column layout (narrower payment code and currency)
  const col1Width = (rightWidth - 4) * 0.15; // Payment code (narrow)
  const col2Width = (rightWidth - 4) * 0.15; // Currency (narrow)
  const col3Width = (rightWidth - 4) * 0.67; // Amount (wide)

  const col1X = rightX;
  const col2X = rightX + col1Width + 5;
  const col3X = rightX + col1Width + col2Width + 10;

  // Labels row
  doc
    .font('Serbian')
    .fontSize(7)
    .fillColor('#666666')
    .text(LABELS.paymentCode, col1X, rightY, { width: col1Width })
    .text(LABELS.currency, col2X, rightY + 9.5, { width: col2Width })
    .text(LABELS.amount, col3X, rightY + 9.5, { width: col3Width });
  rightY += 20;

  // Boxes row
  const topBoxHeight = 20;

  // Payment code box (empty)
  doc.strokeColor('#000000').lineWidth(0.5).rect(col1X, rightY, col1Width, topBoxHeight).stroke();

  // Currency box
  doc.rect(col2X, rightY, col2Width, topBoxHeight).stroke();
  doc
    .font('Serbian')
    .fontSize(9)
    .fillColor('#000000')
    .text('RSD', col2X + BOX_PADDING, rightY + 5, {
      width: col2Width - 2 * BOX_PADDING,
    });

  // Amount box
  doc.rect(col3X, rightY, col3Width, topBoxHeight).stroke();
  const amount = apartment.override_amount || building.default_amount;
  doc
    .font('Serbian')
    .fontSize(9)
    .fillColor('#000000')
    .text(amount.toLocaleString('sr-RS', { minimumFractionDigits: 2 }), col3X + BOX_PADDING, rightY + 5, {
      width: col3Width - 2 * BOX_PADDING,
      align: 'right',
    });

  rightY += topBoxHeight + 8;

  // --- RECIPIENT ACCOUNT (рачун примаоца) - aligned right, same width as reference ---
  const refWidth = rightWidth * 0.85 - 5;
  const accountX = rightX + rightWidth - refWidth;

  doc
    .font('Serbian')
    .fontSize(7)
    .fillColor('#666666')
    .text(LABELS.recipientAccount, accountX, rightY, { width: refWidth });
  rightY += 10;

  const accountBoxHeight = 18;
  doc.strokeColor('#000000').lineWidth(0.5).rect(accountX, rightY, refWidth, accountBoxHeight).stroke();

  doc
    .font('Serbian')
    .fontSize(9)
    .fillColor('#000000')
    .text(formatForDisplay(building.bank_account), accountX + BOX_PADDING, rightY + 4, {
      width: refWidth - 2 * BOX_PADDING,
    });
  rightY += accountBoxHeight + 8;

  // --- MODEL AND REFERENCE NUMBER ROW ---
  const modelWidth = rightWidth * 0.15 - 5;
  const modelX = rightX;
  const refX = rightX + modelWidth + 10;

  // Reference field width (recalculate based on model width)
  const refWidthBottom = rightWidth - modelWidth - 4;

  // Labels
  doc
    .font('Serbian')
    .fontSize(7)
    .fillColor('#666666')
    .text(LABELS.model, modelX, rightY, { width: modelWidth })
    .text(LABELS.reference, refX, rightY + 9.5, { width: refWidthBottom });
  rightY += 20;

  // Boxes
  const modelBoxHeight = 18;
  doc.strokeColor('#000000').lineWidth(0.5).rect(modelX, rightY, modelWidth, modelBoxHeight).stroke();

  doc.rect(refX, rightY, refWidthBottom, modelBoxHeight).stroke();

  // Reference number content
  const refNumber = generateReferenceNumber(apartment.apartment_number, month);
  doc
    .font('Serbian')
    .fontSize(9)
    .fillColor('#000000')
    .text(refNumber, refX + BOX_PADDING, rightY + 4, {
      width: refWidthBottom - 2 * BOX_PADDING,
    });

  rightY += modelBoxHeight + 10;

  // --- QR CODE (no frame, no label) ---
  if (qrCodeBuffer) {
    const qrX = rightX + rightWidth - QR_SIZE;
    const qrY = slipBottom - QR_SIZE - 3;
    const cropBottom = 8;

    // Use clipping to crop the bottom of the QR image
    doc.save();
    doc.rect(qrX, qrY, QR_SIZE, QR_SIZE - cropBottom).clip();
    doc.image(qrCodeBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
    doc.restore();
  }

  // --- VALUE DATE (датум валуте) on the right side at bottom ---
  const valueDateWidth = 80;
  const valueDateY = slipBottom - 18;

  doc.strokeColor('#000000').lineWidth(0.5).moveTo(rightX, valueDateY).lineTo(rightX + valueDateWidth, valueDateY).stroke();

  doc
    .font('Serbian')
    .fontSize(7)
    .fillColor('#666666')
    .text(LABELS.valueDate, rightX, valueDateY + 3, {
      width: valueDateWidth,
      align: 'center',
    });

  // ========================================
  // CUT LINE (dotted) between slips
  // ========================================
  if (slipIndex < 2) {
    const cutLineY = yOffset + SLIP_HEIGHT;
    doc
      .strokeColor('#666666')
      .lineWidth(0.5)
      .dash(5, { space: 3 })
      .moveTo(0, cutLineY)
      .lineTo(SLIP_WIDTH, cutLineY)
      .stroke()
      .undash();
  }
}

/**
 * Generate payment slips PDF for all apartments
 * @param apartments - Array of apartment data
 * @param building - Building data
 * @param month - Billing month (1-12)
 * @param year - Billing year
 * @returns PDF document as ArrayBuffer
 */
export async function generatePaymentSlipsPDF(
  apartments: Apartment[],
  building: Building,
  month: number,
  year: number
): Promise<ArrayBuffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get embedded fonts
      const regularFont = getNotoSansRegular();
      const boldFont = getNotoSansBold();

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      // Register fonts for Serbian text (supports both Latin and Cyrillic)
      doc.registerFont('Serbian', Buffer.from(regularFont));
      doc.registerFont('Serbian-Bold', Buffer.from(boldFont));

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength));
      });
      doc.on('error', reject);

      // Sort apartments by number
      const sortedApartments = [...apartments].sort(
        (a, b) => a.apartment_number - b.apartment_number
      );

      // Generate QR codes for all apartments
      const qrCodes = await Promise.all(
        sortedApartments.map(async (apt) => {
          try {
            return await generatePaymentQRCode(apt, building, month, year, QR_GENERATE_SIZE);
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

        drawPaymentSlip(doc, sortedApartments[i], building, month, year, slipIndex, qrCodes[i]);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate PDF filename
 * @param month - Billing month
 * @param year - Billing year
 * @returns Filename
 */
export function generatePDFFilename(month: number, year: number): string {
  const monthStr = String(month).padStart(2, '0');
  return `uplatnice_${year}_${monthStr}.pdf`;
}
