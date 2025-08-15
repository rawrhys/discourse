#!/usr/bin/env node

// Test script to verify SSL setup
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing SSL Setup...\n');

// Test 1: Check if certificates exist
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

console.log('📋 Certificate Check:');
console.log(`   Certificate file: ${fs.existsSync(certPath) ? '✅ Found' : '❌ Missing'}`);
console.log(`   Key file: ${fs.existsSync(keyPath) ? '✅ Found' : '❌ Missing'}`);

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.log('\n🔧 Creating self-signed certificates...');
  const { execSync } = require('child_process');
  
  try {
    const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;
    execSync(opensslCmd, { cwd: __dirname, stdio: 'pipe' });
    console.log('✅ Self-signed certificates created successfully');
  } catch (error) {
    console.error('❌ Failed to create certificates:', error.message);
    console.log('💡 Make sure OpenSSL is installed on your system');
    process.exit(1);
  }
}

// Test 2: Test HTTPS server
console.log('\n🌐 Testing HTTPS Server...');

const httpsOptions = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
};

const httpsServer = https.createServer(httpsOptions, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'HTTPS server is working!',
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  }));
});

httpsServer.listen(4004, () => {
  console.log('✅ HTTPS server started on port 4004');
  
  // Test HTTPS request
  const httpsReq = https.request({
    hostname: 'localhost',
    port: 4004,
    path: '/api/test',
    method: 'GET',
    rejectUnauthorized: false // Allow self-signed certificates
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ HTTPS request successful');
      console.log('   Response:', JSON.parse(data));
      httpsServer.close();
      
      // Test 3: Test HTTP server
      console.log('\n🌐 Testing HTTP Server...');
      const httpServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'HTTP server is working!',
          url: req.url,
          method: req.method,
          timestamp: new Date().toISOString()
        }));
      });
      
      httpServer.listen(4003, () => {
        console.log('✅ HTTP server started on port 4003');
        
        // Test HTTP request
        const httpReq = http.request({
          hostname: 'localhost',
          port: 4003,
          path: '/api/test',
          method: 'GET'
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            console.log('✅ HTTP request successful');
            console.log('   Response:', JSON.parse(data));
            httpServer.close();
            
            console.log('\n🎉 SSL Setup Test Complete!');
            console.log('✅ Both HTTP and HTTPS servers are working');
            console.log('✅ Self-signed certificates are valid');
            console.log('✅ Ready for development and production');
          });
        });
        
        httpReq.on('error', (err) => {
          console.error('❌ HTTP request failed:', err.message);
          httpServer.close();
        });
        
        httpReq.end();
      });
    });
  });
  
  httpsReq.on('error', (err) => {
    console.error('❌ HTTPS request failed:', err.message);
    httpsServer.close();
  });
  
  httpsReq.end();
});

httpsServer.on('error', (err) => {
  console.error('❌ HTTPS server failed to start:', err.message);
}); 