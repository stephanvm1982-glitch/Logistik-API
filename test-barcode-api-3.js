/**
 * Test and show FULL responses
 */

const https = require('https');

const API_HOST = 'cloud.logiztikalliance.com';
const API_PORT = 5005;
const CUSTOMER_CODE = 'CLI0113847';
const API_KEY = 'CGTKPVOHKXAOMGAERLKDKCPITOBMDPCR';
const SHIPMENT_NR = '07160825450';

console.log('Testing with FULL response output...\n');

// Test 1: Current working approach (shipment)
testRequest('Test 1: Shipment endpoint (working)',
  `/logCloudWS/api/ClientesExternosA/ListarTotalesGuiasPorClienteV2/${CUSTOMER_CODE}/2026-05-28?token=${encodeURIComponent(API_KEY)}`);

setTimeout(() => {
  // Test 2: Barcode endpoint current approach
  testRequest('Test 2: Barcode endpoint (NOT working)',
    `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}?token=${encodeURIComponent(API_KEY)}`);
}, 2000);

function testRequest(label, path) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(label);
  console.log(`${'='.repeat(60)}`);
  console.log('URL:', `https://${API_HOST}:${API_PORT}${path}`);

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
      console.log('\nStatus:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      console.log('\nResponse body:');
      console.log(data);
      console.log('\n');
    });
  });

  req.on('error', (err) => {
    console.log('Error:', err.message);
  });

  req.setTimeout(5000, () => {
    req.destroy();
    console.log('Timeout');
  });

  req.end();
}
