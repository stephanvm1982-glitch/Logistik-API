import axios from 'axios';

const API_BASE = 'https://cloud.logiztikalliance.com:5005';
const API_KEY = process.env.LOGIZTIK_API_KEY;
const CUSTOMER_CODE = process.env.LOGIZTIK_CUSTOMER_CODE;

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'X-API-Key': API_KEY,
    'X-Customer-Code': CUSTOMER_CODE,
  },
});

export async function getShipments() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endpoint = `/logCloudWS/api/ClientesExternosA/ListarTotalesGuiasPorClienteV2/${CUSTOMER_CODE}/${today}`;
    const response = await client.get(endpoint);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching shipments:', error.message);
    throw new Error(`Failed to fetch shipments: ${error.message}`);
  }
}

export async function getBarcodes(code: string) {
  try {
    const response = await client.get('/logCloudWS/api/ClientesExternosA/BuscaCodigo', {
      params: { codigo: code },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching barcode:', error.message);
    throw new Error(`Failed to fetch barcode: ${error.message}`);
  }
}

export async function getShipmentDetails(shipmentId: string) {
  try {
    const response = await client.get(`/logCloudWS/api/ClientesExternosA/DetallePorGuia/${shipmentId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching shipment details:', error.message);
    throw new Error(`Failed to fetch shipment details: ${error.message}`);
  }
}
