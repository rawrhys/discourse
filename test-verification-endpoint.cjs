const http = require('http');

// Test the email verification endpoint
function testVerificationEndpoint() {
  console.log('🧪 Testing Email Verification Endpoint...\n');
  
  const options = {
    hostname: 'localhost',
    port: 4003,
    path: '/api/auth/verify-email?token=test123&email=test@example.com',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`📡 Response Status: ${res.statusCode}`);
    console.log(`📡 Response Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`📡 Response Body: ${data}`);
      
      if (res.statusCode === 400) {
        console.log('✅ GET endpoint is working (returning expected error for invalid token)');
      } else {
        console.log('❌ Unexpected response status');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });

  req.end();
}

// Test the POST endpoint as well
function testPostVerificationEndpoint() {
  console.log('\n🧪 Testing POST Email Verification Endpoint...\n');
  
  const postData = JSON.stringify({
    token: 'test123'
  });

  const options = {
    hostname: 'localhost',
    port: 4003,
    path: '/api/auth/verify-email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`📡 POST Response Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`📡 POST Response Body: ${data}`);
      
      if (res.statusCode === 400) {
        console.log('✅ POST endpoint is working (returning expected error for invalid token)');
      } else {
        console.log('❌ Unexpected POST response status');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ POST request failed:', error.message);
  });

  req.write(postData);
  req.end();
}

// Run tests
testVerificationEndpoint();
setTimeout(testPostVerificationEndpoint, 1000);
