/**
 * NBS IPS QR Code Service
 * Generates QR codes for Serbian payment slips using NBS API
 *
 * API Documentation: docs/Guidelines for using the NBS IPS QR Generator-Validator.pdf
 * API Portal: https://ips.nbs.rs/en/qr-validacija-generisanje
 */

const fetch = require("node-fetch");
const { formatForQR } = require("./bankAccount");

// NBS QR Generator API endpoint
const NBS_API_URL = "https://nbs.rs/QRcode/api/qr/v1/gen";

// Default QR code size (pixels)
const DEFAULT_QR_SIZE = 200;

/**
 * Generate QR code data payload for NBS API
 * @param {Object} params - Payment parameters
 * @param {string} params.bankAccount - Building bank account
 * @param {string} params.recipientName - Recipient name (building info)
 * @param {string} params.recipientAddress - Recipient address
 * @param {string} params.recipientCity - Recipient city
 * @param {number} params.amount - Payment amount in RSD
 * @param {string} params.referenceNumber - Reference number (XXYY format)
 * @param {string} params.paymentPurpose - Payment purpose text
 * @param {string} params.payerName - Payer full name
 * @param {string} params.payerAddress - Payer address (including floor and apartment)
 * @param {string} params.payerCity - Payer city
 * @returns {Object} QR code data payload
 */
function generateQRCodeData(params) {
  const {
    bankAccount,
    recipientName,
    recipientAddress,
    recipientCity,
    amount,
    referenceNumber,
    paymentPurpose,
    payerName,
    payerAddress,
    payerCity,
  } = params;

  // Format bank account as 18 digits (no dashes)
  const formattedAccount = formatForQR(bankAccount);

  // Format recipient info with line break
  // "Stambena zajednica\r\n[Address]"
  let recipientInfo = recipientName + "\r\n" + recipientAddress;
  recipientInfo = recipientInfo.slice(0, 70);

  // Format amount (RSD + amount with 2 decimal places, comma as decimal separator)
  const formattedAmount = `RSD${Number(amount).toFixed(2).replace(".", ",")}`;

  // Format reference number (remove slash for QR)
  // "03/02" -> "0302"
  const formattedReference = referenceNumber.replace("/", "");

  // Format payer info with line breaks
  // "Full Name\r\nAddress\r\nCity"
  const payerInfo = `${payerName}\r\n${payerAddress}\r\n${payerCity}`;

  return {
    K: "PR", // Payment type: PR = Payment Request
    V: "01", // Version
    C: "1", // Character set: 1 = UTF-8
    R: formattedAccount, // Recipient account (18 digits)
    N: recipientInfo, // Recipient name and address
    I: formattedAmount, // Amount with currency
    SF: "289", // Service code: 289 = Ostale komunalne usluge
    S: paymentPurpose, // Payment purpose
    RO: formattedReference, // Reference number
    P: payerInfo, // Payer info (name, address, city)
  };
}

/**
 * Fetch QR code image from NBS API
 * @param {Object} qrData - QR code data payload
 * @param {number} size - QR code size in pixels
 * @returns {Promise<Buffer>} QR code image as buffer
 */
async function fetchQRCode(qrData, size = DEFAULT_QR_SIZE) {
  const url = `${NBS_API_URL}/${size}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(qrData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NBS API error: ${response.status} - ${errorText}`);
    }

    const buffer = await response.buffer();
    return buffer;
  } catch (err) {
    console.error("QR code fetch error:", err);
    throw new Error(`Failed to generate QR code: ${err.message}`);
  }
}

/**
 * Generate QR code for apartment payment slip
 * @param {Object} apartment - Apartment data
 * @param {Object} building - Building data
 * @param {number} month - Billing month (1-12)
 * @param {number} year - Billing year
 * @param {number} size - QR code size in pixels
 * @returns {Promise<Buffer>} QR code image as buffer
 */
async function generatePaymentQRCode(
  apartment,
  building,
  month,
  year,
  size = DEFAULT_QR_SIZE,
) {
  // Calculate amount (apartment override or building default)
  const amount = apartment.override_amount || building.default_amount;

  // Generate reference number: XX/YY (apartment/month)
  const apartmentNum = String(apartment.apartment_number).padStart(2, "0");
  const monthNum = String(month).padStart(2, "0");
  const referenceNumber = `${apartmentNum}/${monthNum}`;

  // Build QR data
  const qrData = generateQRCodeData({
    bankAccount: building.bank_account,
    recipientName: building.recipient_name,
    recipientAddress: building.address,
    recipientCity: building.city,
    amount: amount,
    referenceNumber: referenceNumber,
    paymentPurpose: building.payment_purpose,
    payerName: apartment.owner_name,
    payerAddress:
      building.address +
      ", " +
      apartment.floor_number +
      ", " +
      apartment.apartment_number,
    payerCity: building.city,
  });

  // Fetch QR code from NBS API
  return await fetchQRCode(qrData, size);
}

/**
 * Generate QR code as base64 data URL
 * @param {Object} apartment - Apartment data
 * @param {Object} building - Building data
 * @param {number} month - Billing month (1-12)
 * @param {number} year - Billing year
 * @param {number} size - QR code size in pixels
 * @returns {Promise<string>} Base64 data URL
 */
async function generatePaymentQRCodeBase64(
  apartment,
  building,
  month,
  year,
  size = DEFAULT_QR_SIZE,
) {
  const buffer = await generatePaymentQRCode(
    apartment,
    building,
    month,
    year,
    size,
  );
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

module.exports = {
  generateQRCodeData,
  fetchQRCode,
  generatePaymentQRCode,
  generatePaymentQRCodeBase64,
  DEFAULT_QR_SIZE,
};
