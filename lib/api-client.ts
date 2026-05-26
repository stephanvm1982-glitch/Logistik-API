import axios from 'axios';

const API_BASE = 'https://api.logiztikalliance.com';
const API_KEY = process.env.LOGIZTIK_API_KEY;
const CUSTOMER_CODE = process.env.LOGIZTIK_CUSTOMER_CODE;

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'X-API-Key': API_KEY,
    'X-Customer-Code': CUSTOMER_CODE,
  },
});

export async function getShipments(params?: Record<string, any>) {
  try {
    const response = await client.get('/v2/shipments', { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching shipments:', error.message);
    throw new Error(`Failed to fetch shipments: ${error.message}`);
  }
}

export async function getBarcodes(code: string) {
  try {
    const response = await client.get('/v2/barcodes', {
      params: { code },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching barcode:', error.message);
    throw new Error(`Failed to fetch barcode: ${error.message}`);
  }
}

export async function getShipmentDetails(shipmentId: string) {
  try {
    const response = await client.get(`/v2/shipments/${shipmentId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching shipment details:', error.message);
    throw new Error(`Failed to fetch shipment details: ${error.message}`);
  }
}
