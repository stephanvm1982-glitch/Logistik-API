/**
 * Test different token encoding approaches
 */

const https = require('https');

const CUSTOMER_CODE = 'CLI0113847';
const API_KEY = 'CGTKPVOHKXAOMGAERLKDKCPITOBMDPCR';
const SHIPMENT_NR = '07160825450';

const variations = [
  {
    name: 'Token plain (no encoding)',
    param: `token=${API_KEY}`,
  },
  {
    name: 'Token uppercase AUTHENTICATIONTOKEN',
    param: `AUTHENTICATIONTOKEN=${API_KEY}`,
  },
  {
    name: 'Token uppercase TOKEN',
    param: `TOKEN=${API_KEY}`,
  },
  {
    name: 'Token with Api-Key in query',
    param: `Api-Key=${API_KEY}`,
  },
  {
    name: 'Multiple params: cc, shipment, token',
    param: `cc=${CUSTOMER_CODE}&shipment=${SHIPMENT_NR}&token=${API_KEY}`,
  },
];

const basePath = `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}`;

let index = 0;

function runTest() {
  if (index >= variations.length) return;

  const test = variations[index];
  const path = basePath + '?' + test.param;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Path: ...${path.substring(Math.max(0, path.length - 100))}`);

  const options = {
    hostname: 'cloud.logiztikalliance.com',
    port: 5005,
    path: path,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    rejectUnauthorized: false,
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const json = JSON.parse(data);
        if (json.ok) {
          console.log('✅ SUCCESS! Data received');
        } else if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          console.log('✅ SUCCESS! Got array data');
          console.log(`Data count: ${json.data.length}`);
        } else {
          console.log(`Message: ${json.mensaje || json.message || 'No message'}`);
        }
      } catch (e) {
        console.log('Response:', data.substring(0, 100));
      }

      index++;
      setTimeout(runTest, 500);
    });
  });

  req.on('error', (err) => {
    console.log(`Error: ${err.message}`);
    index++;
    setTimeout(runTest, 300);
  });

  req.setTimeout(3000, () => {
    req.destroy();
    console.log('Timeout');
    index++;
    setTimeout(runTest, 300);
  });

  req.end();
}

console.log('Testing different token encoding variations...\n');
runTest();
