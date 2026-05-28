/**
 * Test token as path parameter instead of query parameter
 */

const https = require('https');

const API_HOST = 'cloud.logiztikalliance.com';
const API_PORT = 5005;
const CUSTOMER_CODE = 'CLI0113847';
const API_KEY = 'CGTKPVOHKXAOMGAERLKDKCPITOBMDPCR';
const SHIPMENT_NR = '07160825450';

console.log('Testing token as PATH parameter...\n');

// Test 1: Token as path parameter (4th segment)
testRequest('Test 1: Token in path (4th segment)',
  `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}/${encodeURIComponent(API_KEY)}`);

setTimeout(() => {
  // Test 2: With no token at all (control)
  testRequest('Test 2: No token (control)',
    `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}`);
}, 2000);

setTimeout(() => {
  // Test 3: Token with &
  testRequest('Test 3: With & separator',
    `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}&token=${encodeURIComponent(API_KEY)}`);
}, 4000);

function testRequest(label, path) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(label);
  console.log(`${'='.repeat(60)}`);
  const fullUrl = `https://${API_HOST}:${API_PORT}${path}`;
  console.log('URL:', fullUrl.substring(0, 100) + (fullUrl.length > 100 ? '...' : ''));

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
      console.log('Status:', res.statusCode);
      try {
        const json = JSON.parse(data);
        if (json.ok || (json.data && json.data.length > 0)) {
          console.log('✅ SUCCESS!');
          if (json.data) {
            if (Array.isArray(json.data)) {
              console.log('Data count:', json.data.length);
            } else {
              console.log('Data keys:', Object.keys(json.data).slice(0, 5));
            }
          }
        } else {
          console.log('Response:', data.substring(0, 150));
        }
      } catch (e) {
        console.log('Response (first 150 chars):', data.substring(0, 150));
      }
    });
  });

  req.on('error', (err) => console.log('Error:', err.message));
  req.setTimeout(5000, () => { req.destroy(); console.log('Timeout'); });
  req.end();
}
