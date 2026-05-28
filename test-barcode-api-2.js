/**
 * Test different parameter placements for barcode API
 */

const https = require('https');

const API_HOST = 'cloud.logiztikalliance.com';
const API_PORT = 5005;
const CUSTOMER_CODE = process.env.CUSTOMER_CODE || '';
const API_KEY = process.env.API_KEY || '';
const SHIPMENT_NR = '07160825450';

console.log('Testing parameter placements...\n');

// Test 1: All as query parameters
testRequest('Test 1: All query params',
  `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew?customerCode=${CUSTOMER_CODE}&shipmentNr=${SHIPMENT_NR}&token=${encodeURIComponent(API_KEY)}`);

setTimeout(() => {
  // Test 2: Customer and shipment in path, token in query (current approach)
  testRequest('Test 2: Path + ?token=',
    `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}?token=${encodeURIComponent(API_KEY)}`);
}, 1000);

setTimeout(() => {
  // Test 3: Just the base endpoint with all query params
  testRequest('Test 3: Base endpoint + all query',
    `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew?cc=${CUSTOMER_CODE}&shipment=${SHIPMENT_NR}&token=${encodeURIComponent(API_KEY)}`);
}, 2000);

setTimeout(() => {
  // Test 4: Check shipment endpoint for reference
  testRequest('Test 4: Shipment endpoint (reference)',
    `/logCloudWS/api/ClientesExternosA/ListarTotalesGuiasPorClienteV2/${CUSTOMER_CODE}/2026-05-28?token=${encodeURIComponent(API_KEY)}`);
}, 3000);

function testRequest(label, path) {
  console.log(`\n${label}`);
  console.log('Path:', path.substring(0, 150) + (path.length > 150 ? '...' : ''));

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: path,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    rejectUnauthorized: false,
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('Status:', res.statusCode);
        if (json.ok) {
          console.log('✅ SUCCESS! Got data');
          console.log('Keys:', Object.keys(json.data || {}).slice(0, 5));
        } else {
          console.log('❌ Error:', json.data?.mensaje || json.data?.error || 'Unknown error');
        }
      } catch (e) {
        console.log('Status:', res.statusCode);
        console.log('Response (first 100 chars):', data.substring(0, 100));
      }
    });
  });

  req.on('error', (err) => {
    console.log('❌ Request error:', err.message);
  });

  req.setTimeout(5000, () => {
    req.destroy();
    console.log('❌ Timeout');
  });

  req.end();
}
