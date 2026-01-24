/**
 * Payment Slip PDF Generator
 * Generates A4 PDF with Serbian payment slips (uplatnica)
 *
 * Layout: 3 payment slips per A4 page with dotted cut lines
 * Labels: Serbian Cyrillic
 * Data: From database (Latin or Cyrillic as entered)
 */

const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const { generatePaymentQRCode } = require("./qrCode");
const { formatForDisplay } = require("./bankAccount");

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

// Font paths - Noto Sans (bundled, cross-platform, full Unicode support)
const FONT_REGULAR = path.join(__dirname, "../../fonts/NotoSans-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "../../fonts/NotoSans-Bold.ttf");

/**
 * Serbian Cyrillic labels for payment slip fields
 */
const LABELS = {
  title: "НАЛОГ ЗА УПЛАТУ",
  payer: "уплатилац",
  purpose: "сврха уплате",
  recipient: "прималац",
  paymentCode: "шифра плаћања",
  currency: "валута",
  amount: "износ",
  recipientAccount: "рачун примаоца",
  model: "број модела",
  reference: "позив на број (одобрење)",
  payerSignature: "печат и потпис уплатиоца",
  datePlace: "место и датум пријема",
  valueDate: "датум валуте",
  qrLabel: "NBS IPS QR",
};

/**
 * Fixed payment purpose text (Serbian Cyrillic)
 */
const PAYMENT_PURPOSE = "Месечно одржавање зграде";

/**
 * Fixed recipient prefix (Serbian Cyrillic)
 */
const RECIPIENT_PREFIX = "Стамбена заједница";

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
  const line2 = `${building.address}, спрат ${apartment.floor_number}, стан ${apartment.apartment_on_floor}`;

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
  return `${RECIPIENT_PREFIX} ${building.address}, ${building.city}`;
}

/**
 * Generate reference number
 * @param {number} apartmentNumber - Apartment number
 * @param {number} month - Billing month
 * @returns {string} Reference number in XX/YY format
 */
function generateReferenceNumber(apartmentNumber, month) {
  const apt = String(apartmentNumber).padStart(2, "0");
  const mon = String(month).padStart(2, "0");
  return `${apt}/${mon}`;
}

/**
 * Draw a box with optional label
 * @param {PDFDocument} doc - PDF document
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Box width
 * @param {number} height - Box height
 * @param {string} label - Optional label above box
 * @param {string} content - Optional content inside box
 * @param {Object} options - Additional options
 */
function drawBox(
  doc,
  x,
  y,
  width,
  height,
  label = null,
  content = null,
  options = {},
) {
  const {
    labelSize = 7,
    contentSize = 9,
    labelColor = "#666666",
    contentColor = "#000000",
    borderColor = "#000000",
    align = "left",
  } = options;

  // Draw label above box if provided
  let boxY = y;
  if (label) {
    doc
      .font("Serbian")
      .fontSize(labelSize)
      .fillColor(labelColor)
      .text(label, x, y, { width: width });
    boxY = y + labelSize + 2;
  }

  // Draw box border
  doc
    .strokeColor(borderColor)
    .lineWidth(0.5)
    .rect(x, boxY, width, height)
    .stroke();

  // Draw content inside box if provided
  if (content) {
    doc
      .font("Serbian")
      .fontSize(contentSize)
      .fillColor(contentColor)
      .text(content, x + BOX_PADDING, boxY + BOX_PADDING, {
        width: width - 2 * BOX_PADDING,
        height: height - 2 * BOX_PADDING,
        align: align,
      });
  }

  return boxY + height;
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
function drawPaymentSlip(
  doc,
  apartment,
  building,
  month,
  year,
  slipIndex,
  qrCodeBuffer,
) {
  const yOffset = slipIndex * SLIP_HEIGHT;
  const slipTop = yOffset + MARGIN;
  const slipBottom = yOffset + SLIP_HEIGHT - MARGIN;
  const slipContentWidth = SLIP_WIDTH - 2 * MARGIN;

  // Box heights (used for layout calculations)
  const payerBoxHeight = 42;
  const purposeBoxHeight = 28;
  const recipientBoxHeight = 28;

  // Calculate divider bounds (aligned with left section boxes)
  const dividerTop = slipTop + PADDING + 10;  // After payer label
  const dividerBottom = dividerTop + payerBoxHeight + 8 + 10 + purposeBoxHeight + 8 + 10 + recipientBoxHeight;

  // Draw main outer border
  doc
    .strokeColor("#000000")
    .lineWidth(1)
    .rect(MARGIN, slipTop, slipContentWidth, SLIP_HEIGHT - 2 * MARGIN)
    .stroke();

  // Draw vertical divider between left and right sections
  doc
    .lineWidth(0.5)
    .moveTo(DIVIDER_X, dividerTop)
    .lineTo(DIVIDER_X, dividerBottom)
    .stroke();

  // ========================================
  // LEFT SECTION
  // ========================================
  const leftX = MARGIN + PADDING;
  const leftWidth = LEFT_SECTION_WIDTH - 2 * PADDING;
  let leftY = slipTop + PADDING;

  // --- PAYER SECTION (уплатилац) ---
  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.payer, leftX, leftY);
  leftY += 10;

  // Payer box (3 lines)
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .rect(leftX, leftY, leftWidth, payerBoxHeight)
    .stroke();

  // Payer content
  const payerLines = generatePayerInfo(apartment, building);
  doc.font("Serbian").fontSize(9).fillColor("#000000");
  let payerContentY = leftY + BOX_PADDING;
  payerLines.forEach((line) => {
    doc.text(line, leftX + BOX_PADDING, payerContentY, {
      width: leftWidth - 2 * BOX_PADDING,
    });
    payerContentY += LINE_HEIGHT;
  });
  leftY += payerBoxHeight + 8;

  // --- PAYMENT PURPOSE SECTION (сврха уплате) ---
  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.purpose, leftX, leftY);
  leftY += 10;

  // Purpose box
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .rect(leftX, leftY, leftWidth, purposeBoxHeight)
    .stroke();

  doc
    .font("Serbian")
    .fontSize(9)
    .fillColor("#000000")
    .text(PAYMENT_PURPOSE, leftX + BOX_PADDING, leftY + BOX_PADDING, {
      width: leftWidth - 2 * BOX_PADDING,
    });
  leftY += purposeBoxHeight + 8;

  // --- RECIPIENT SECTION (прималац) ---
  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.recipient, leftX, leftY);
  leftY += 10;

  // Recipient box (2 lines)
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .rect(leftX, leftY, leftWidth, recipientBoxHeight)
    .stroke();

  doc
    .font("Serbian")
    .fontSize(9)
    .fillColor("#000000")
    .text(
      generateRecipientInfo(building),
      leftX + BOX_PADDING,
      leftY + BOX_PADDING,
      { width: leftWidth - 2 * BOX_PADDING },
    );
  leftY += recipientBoxHeight + 12;

  // --- SIGNATURE SECTION ---
  const signatureY = slipBottom - 38;
  const sigFieldWidth = leftWidth / 2 - 10;

  // Payer signature line and label (shorter, on left side)
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .moveTo(leftX, signatureY)
    .lineTo(leftX + sigFieldWidth, signatureY)
    .stroke();

  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.payerSignature, leftX, signatureY + 3, {
      width: sigFieldWidth,
      align: "center",
    });

  // Date fields at bottom
  const dateY = slipBottom - 18;

  // Place and date of receipt (in the middle, where value date was)
  const datePlaceX = leftX + leftWidth - sigFieldWidth;
  doc
    .moveTo(datePlaceX, dateY)
    .lineTo(datePlaceX + sigFieldWidth, dateY)
    .stroke();
  doc.text(LABELS.datePlace, datePlaceX, dateY + 3, {
    width: sigFieldWidth,
    align: "center",
  });

  // ========================================
  // RIGHT SECTION
  // ========================================
  const rightX = DIVIDER_X + PADDING;
  const rightWidth = RIGHT_SECTION_WIDTH - 2 * PADDING;
  let rightY = slipTop + PADDING;

  // --- HEADER (НАЛОГ ЗА УПЛАТУ) ---
  doc
    .font("Serbian-Bold")
    .fontSize(11)
    .fillColor("#000000")
    .text(LABELS.title, rightX, rightY, { width: rightWidth, align: "right" });
  rightY += 5;

  // --- TOP ROW: Payment Code | Currency | Amount ---
  // // Draw horizontal line below header
  // doc
  //   .strokeColor("#000000")
  //   .lineWidth(0.5)
  //   .moveTo(DIVIDER_X, rightY)
  //   .lineTo(MARGIN + slipContentWidth, rightY)
  //   .stroke();

  // rightY += 2;

  // Calculate column widths for the 3-column layout (narrower payment code and currency)
  const col1Width = (rightWidth - 4) * 0.15; // Payment code (narrow)
  const col2Width = (rightWidth - 4) * 0.15; // Currency (narrow)
  const col3Width = (rightWidth - 4) * 0.67; // Amount (wide)

  const col1X = rightX;
  const col2X = rightX + col1Width + 5;
  const col3X = rightX + col1Width + col2Width + 10;

  // Labels row
  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.paymentCode, col1X, rightY, { width: col1Width })
    .text(LABELS.currency, col2X, rightY + 9.5, { width: col2Width })
    .text(LABELS.amount, col3X, rightY + 9.5, { width: col3Width });
  rightY += 20;

  // Boxes row
  const topBoxHeight = 20;

  // Payment code box (empty)
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .rect(col1X, rightY, col1Width, topBoxHeight)
    .stroke();

  // Currency box
  doc.rect(col2X, rightY, col2Width, topBoxHeight).stroke();
  doc
    .font("Serbian")
    .fontSize(9)
    .fillColor("#000000")
    .text("RSD", col2X + BOX_PADDING, rightY + 5, {
      width: col2Width - 2 * BOX_PADDING,
    });

  // Amount box
  doc.rect(col3X, rightY, col3Width, topBoxHeight).stroke();
  const amount = apartment.override_amount || building.default_amount;
  doc
    .font("Serbian")
    .fontSize(9)
    .fillColor("#000000")
    .text(
      amount.toLocaleString("sr-RS", { minimumFractionDigits: 2 }),
      col3X + BOX_PADDING,
      rightY + 5,
      { width: col3Width - 2 * BOX_PADDING, align: "right" },
    );

  rightY += topBoxHeight + 8;

  // --- RECIPIENT ACCOUNT (рачун примаоца) - aligned right, same width as reference ---
  const refWidth = rightWidth * 0.85 - 5; // Same width as reference field
  const accountX = rightX + rightWidth - refWidth; // Aligned to right

  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.recipientAccount, accountX, rightY, { width: refWidth });
  rightY += 10;

  const accountBoxHeight = 18;
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .rect(accountX, rightY, refWidth, accountBoxHeight)
    .stroke();

  doc
    .font("Serbian")
    .fontSize(9)
    .fillColor("#000000")
    .text(
      formatForDisplay(building.bank_account),
      accountX + BOX_PADDING,
      rightY + 4,
      { width: refWidth - 2 * BOX_PADDING },
    );
  rightY += accountBoxHeight + 8;

  // --- MODEL AND REFERENCE NUMBER ROW ---
  const modelWidth = rightWidth * 0.15 - 5; // Narrow model field
  const modelX = rightX;
  const refX = rightX + modelWidth + 10;

  // Reference field width (recalculate based on model width)
  const refWidthBottom = rightWidth - modelWidth - 4;

  // Labels
  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    .text(LABELS.model, modelX, rightY, { width: modelWidth })
    .text(LABELS.reference, refX, rightY + 9.5, { width: refWidthBottom });
  rightY += 20;

  // Boxes
  const modelBoxHeight = 18;
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .rect(modelX, rightY, modelWidth, modelBoxHeight)
    .stroke();

  doc.rect(refX, rightY, refWidthBottom, modelBoxHeight).stroke();

  // Reference number content
  const refNumber = generateReferenceNumber(apartment.apartment_number, month);
  doc
    .font("Serbian")
    .fontSize(9)
    .fillColor("#000000")
    .text(refNumber, refX + BOX_PADDING, rightY + 4, {
      width: refWidthBottom - 2 * BOX_PADDING,
    });

  rightY += modelBoxHeight + 10;

  // --- QR CODE (no frame, no label) ---
  if (qrCodeBuffer) {
    const qrX = rightX + rightWidth - QR_SIZE;
    //const qrY = slipBottom - QR_SIZE - 18;
    //const qrY = slipBottom - QR_SIZE - 10;
    const qrY = slipBottom - QR_SIZE - 3;
    const cropBottom = 8; // Amount to crop from bottom

    // doc.image(qrCodeBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
    // Use clipping to crop the bottom of the QR image
    doc.save();
    doc.rect(qrX, qrY, QR_SIZE, QR_SIZE - cropBottom).clip();
    doc.image(qrCodeBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
    doc.restore();
  }

  // --- VALUE DATE (датум валуте) on the right side at bottom ---
  const valueDateWidth = 80;
  const valueDateX = MARGIN + slipContentWidth - valueDateWidth - PADDING;
  const valueDateY = slipBottom - 18;

  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    // .moveTo(valueDateX, valueDateY)
    .moveTo(rightX, valueDateY)
    // .lineTo(valueDateX + valueDateWidth, valueDateY)
    .lineTo(rightX + valueDateWidth, valueDateY)
    .stroke();

  doc
    .font("Serbian")
    .fontSize(7)
    .fillColor("#666666")
    //.text(LABELS.valueDate, valueDateX, valueDateY + 3, { width: valueDateWidth, align: 'center' });
    .text(LABELS.valueDate, rightX, valueDateY + 3, {
      width: valueDateWidth,
      align: "center",
    });

  // ========================================
  // CUT LINE (dotted) between slips
  // ========================================
  if (slipIndex < 2) {
    const cutLineY = yOffset + SLIP_HEIGHT;
    doc
      .strokeColor("#666666")
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
 * @param {Object[]} apartments - Array of apartment data
 * @param {Object} building - Building data
 * @param {number} month - Billing month (1-12)
 * @param {number} year - Billing year
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generatePaymentSlipsPDF(apartments, building, month, year) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if bundled font exists
      if (!fs.existsSync(FONT_REGULAR)) {
        throw new Error(
          `Font file not found at ${FONT_REGULAR}. ` +
            "Please ensure NotoSans-Regular.ttf is in backend/fonts/ directory.",
        );
      }

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      // Register fonts for Serbian text (supports both Latin and Cyrillic)
      doc.registerFont("Serbian", FONT_REGULAR);
      if (fs.existsSync(FONT_BOLD)) {
        doc.registerFont("Serbian-Bold", FONT_BOLD);
      }

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Sort apartments by number
      const sortedApartments = [...apartments].sort(
        (a, b) => a.apartment_number - b.apartment_number,
      );

      // Generate QR codes for all apartments
      const qrCodes = await Promise.all(
        sortedApartments.map(async (apt) => {
          try {
            return await generatePaymentQRCode(
              apt,
              building,
              month,
              year,
              QR_GENERATE_SIZE,
            );
          } catch (err) {
            console.error(
              `Failed to generate QR for apartment ${apt.apartment_number}:`,
              err,
            );
            return null; // Continue without QR if API fails
          }
        }),
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
          qrCodes[i],
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
  const monthStr = String(month).padStart(2, "0");
  return `uplatnice_${year}_${monthStr}.pdf`;
}

module.exports = {
  generatePaymentSlipsPDF,
  generatePDFFilename,
  generateReferenceNumber,
};
