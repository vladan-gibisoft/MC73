/**
 * NBS IPS QR Code Service
 * Generates QR codes for Serbian payment slips using NBS API
 *
 * API Documentation: docs/Guidelines for using the NBS IPS QR Generator-Validator.pdf
 * API Portal: https://ips.nbs.rs/en/qr-validacija-generisanje
 */

import { formatForQR } from './bankAccount';
import type { QRCodeData, Apartment, Building } from '../types';

// NBS QR Generator API endpoint
const NBS_API_URL = 'https://nbs.rs/QRcode/api/qr/v1/gen';

// Default QR code size (pixels)
export const DEFAULT_QR_SIZE = 200;

/**
 * Generate QR code data payload for NBS API
 */
export function generateQRCodeData(params: {
  bankAccount: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  amount: number;
  referenceNumber: string;
  paymentPurpose: string;
  payerName: string;
  payerAddress: string;
  payerCity: string;
}): QRCodeData {
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
  let recipientInfo = recipientName + '\r\n' + recipientAddress;
  recipientInfo = recipientInfo.slice(0, 70);

  // Format amount (RSD + amount with 2 decimal places, comma as decimal separator)
  const formattedAmount = `RSD${Number(amount).toFixed(2).replace('.', ',')}`;

  // Format reference number (remove slash for QR)
  // "03/02" -> "0302"
  const formattedReference = referenceNumber.replace('/', '').replace('-', '');

  // Format payer info with line breaks
  // "Full Name\r\nAddress\r\nCity"
  const payerInfo = `${payerName}\r\n${payerAddress}\r\n${payerCity}`;

  return {
    K: 'PR', // Payment type: PR = Payment Request
    V: '01', // Version
    C: '1', // Character set: 1 = UTF-8
    R: formattedAccount, // Recipient account (18 digits)
    N: recipientInfo, // Recipient name and address
    I: formattedAmount, // Amount with currency
    SF: '289', // Service code: 289 = Ostale komunalne usluge
    S: paymentPurpose, // Payment purpose
    RO: formattedReference, // Reference number
    P: payerInfo, // Payer info (name, address, city)
  };
}

/**
 * Fetch QR code image from NBS API
 * @param qrData - QR code data payload
 * @param size - QR code size in pixels
 * @returns QR code image as ArrayBuffer
 */
export async function fetchQRCode(qrData: QRCodeData, size = DEFAULT_QR_SIZE): Promise<ArrayBuffer> {
  const url = `${NBS_API_URL}/${size}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'image/png',
      },
      body: JSON.stringify(qrData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NBS API error: ${response.status} - ${errorText}`);
    }

    return await response.arrayBuffer();
  } catch (err) {
    console.error('QR code fetch error:', err);
    throw new Error(`Failed to generate QR code: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Generate QR code for apartment payment slip
 * @param apartment - Apartment data
 * @param building - Building data
 * @param month - Billing month (1-12)
 * @param year - Billing year
 * @param size - QR code size in pixels
 * @returns QR code image as ArrayBuffer
 */
export async function generatePaymentQRCode(
  apartment: Apartment,
  building: Building,
  month: number,
  year: number,
  size = DEFAULT_QR_SIZE
): Promise<ArrayBuffer> {
  // Calculate amount (apartment override or building default)
  const amount = apartment.override_amount || building.default_amount;

  // Generate reference number: XX/YY (apartment/month)
  const apartmentNum = String(apartment.apartment_number).padStart(2, '0');
  const monthNum = String(month).padStart(2, '0');
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
      building.address + ', ' + apartment.floor_number + ', ' + apartment.apartment_number,
    payerCity: building.city,
  });

  // Fetch QR code from NBS API
  return await fetchQRCode(qrData, size);
}

/**
 * Generate QR code as base64 data URL
 */
export async function generatePaymentQRCodeBase64(
  apartment: Apartment,
  building: Building,
  month: number,
  year: number,
  size = DEFAULT_QR_SIZE
): Promise<string> {
  const buffer = await generatePaymentQRCode(apartment, building, month, year, size);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:image/png;base64,${base64}`;
}
