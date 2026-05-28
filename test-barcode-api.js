/**
 * Test different ways of calling the Logiztik barcode API
 * Run with: node test-barcode-api.js
 */

const https = require('https');

const API_HOST = 'cloud.logiztikalliance.com';
const API_PORT = 5005;
const CUSTOMER_CODE = process.env.CUSTOMER_CODE || '';
const API_KEY = process.env.API_KEY || '';
const SHIPMENT_NR = '07160825450';

console.log('Testing Logiztik Barcode API...\n');
console.log('Config:', {
  CUSTOMER_CODE: CUSTOMER_CODE ? `${CUSTOMER_CODE.substring(0, 5)}...` : 'NOT SET',
  API_KEY: API_KEY ? `${API_KEY.substring(0, 5)}...` : 'NOT SET',
});

if (!API_KEY || !CUSTOMER_CODE) {
  console.error('\n❌ API_KEY or CUSTOMER_CODE not set!');
  process.exit(1);
}

// Test 1: Query parameter "token"
testRequest('Test 1: ?token=', `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}?token=${encodeURIComponent(API_KEY)}`);

// Test 2: Query parameter "authenticationToken"
setTimeout(() => {
  testRequest('Test 2: ?authenticationToken=', `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}?authenticationToken=${encodeURIComponent(API_KEY)}`);
}, 1000);

// Test 3: Token in header only (no query param)
setTimeout(() => {
  testRequest('Test 3: Header only (Api-Key)', `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}`, 'Api-Key');
}, 2000);

// Test 4: Token in custom header "authenticationToken"
setTimeout(() => {
  testRequest('Test 4: Header only (authenticationToken)', `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}`, 'authenticationToken');
}, 3000);

// Test 5: POST with body
setTimeout(() => {
  testPostRequest('Test 5: POST with body', `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}`);
}, 4000);

function testRequest(label, path, headerName = null) {
  console.log(`\n${label}`);
  console.log('Path:', path.substring(0, 100) + '...');

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

  if (headerName) {
    options.headers[headerName] = API_KEY;
  }

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('Status:', res.statusCode);
        console.log('Response:', JSON.stringify(json, null, 2));
        if (json.ok) {
          console.log('✅ SUCCESS!');
        } else {
          console.log('❌ Error from API:', json.data?.mensaje || json.data?.error);
        }
      } catch (e) {
        console.log('Status:', res.statusCode);
        console.log('Response (raw):', data.substring(0, 200));
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

function testPostRequest(label, path) {
  console.log(`\n${label}`);
  console.log('Path:', path.substring(0, 100) + '...');

  const body = JSON.stringify({
    token: API_KEY,
    authenticationToken: API_KEY,
  });

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
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
        console.log('Response:', JSON.stringify(json, null, 2));
        if (json.ok) {
          console.log('✅ SUCCESS!');
        } else {
          console.log('❌ Error from API:', json.data?.mensaje || json.data?.error);
        }
      } catch (e) {
        console.log('Status:', res.statusCode);
        console.log('Response (raw):', data.substring(0, 200));
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

  req.write(body);
  req.end();
}
