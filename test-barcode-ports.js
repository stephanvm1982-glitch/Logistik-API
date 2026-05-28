/**
 * Test different ports
 */

const https = require('https');

const CUSTOMER_CODE = 'CLI0113847';
const API_KEY = 'CGTKPVOHKXAOMGAERLKDKCPITOBMDPCR';
const SHIPMENT_NR = '07160825450';

const tests = [
  {
    name: 'Port 5005 (current)',
    host: 'cloud.logiztikalliance.com',
    port: 5005,
  },
  {
    name: 'Port 443 (HTTPS default)',
    host: 'cloud.logiztikalliance.com',
    port: 443,
  },
  {
    name: 'Port 80 (HTTP)',
    host: 'cloud.logiztikalliance.com',
    port: 80,
  },
  {
    name: 'logiztikalliance.com:5005',
    host: 'logiztikalliance.com',
    port: 5005,
  },
  {
    name: 'api.logiztikalliance.com:443',
    host: 'api.logiztikalliance.com',
    port: 443,
  },
];

let index = 0;

function runTest() {
  if (index >= tests.length) return;

  const test = tests[index];
  const path = `/logCloudWS/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/${CUSTOMER_CODE}/${SHIPMENT_NR}?token=${encodeURIComponent(API_KEY)}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Host: ${test.host}:${test.port}`);
  console.log(`Path: ${path.substring(0, 80)}...`);

  const options = {
    hostname: test.host,
    port: test.port,
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
        if (json.ok || (json.data && Array.isArray(json.data) && json.data.length > 0)) {
          console.log('✅ WORKING! Got data');
          console.log(JSON.stringify(json, null, 2).substring(0, 200));
        } else {
          console.log('Response:', JSON.stringify(json).substring(0, 100));
        }
      } catch (e) {
        console.log('Response:', data.substring(0, 100));
      }

      index++;
      setTimeout(runTest, 1000);
    });
  });

  req.on('error', (err) => {
    console.log(`❌ Error: ${err.message}`);
    index++;
    setTimeout(runTest, 500);
  });

  req.setTimeout(3000, () => {
    req.destroy();
    console.log('❌ Timeout');
    index++;
    setTimeout(runTest, 500);
  });

  req.end();
}

console.log('Testing different ports and hosts...');
runTest();
