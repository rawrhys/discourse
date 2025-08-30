const http = require('http');

// Test the complete email verification flow
async function testCompleteVerificationFlow() {
  console.log('🧪 Testing Complete Email Verification Flow...\n');
  
  // Step 1: Register a new user
  console.log('📝 Step 1: Registering new user...');
  const registerData = JSON.stringify({
    email: 'test-verification@example.com',
    password: 'testpassword123',
    name: 'Test User',
    gdprConsent: true,
    policyVersion: '1.0'
  });

  const registerOptions = {
    hostname: 'localhost',
    port: 4003,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerData)
    }
  };

  const registerReq = http.request(registerOptions, (res) => {
    console.log(`📡 Registration Response Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`📡 Registration Response: ${data}`);
      
      if (res.statusCode === 200) {
        console.log('✅ User registration successful');
        
        // Parse the response to get user details
        try {
          const response = JSON.parse(data);
          if (response.requiresEmailVerification) {
            console.log('✅ Email verification required as expected');
            
            // Step 2: Check if user was created with verification token
            console.log('\n📝 Step 2: Checking user verification status...');
            checkUserVerificationStatus('test-verification@example.com');
          } else {
            console.log('❌ Email verification not required');
          }
        } catch (error) {
          console.log('❌ Failed to parse registration response');
        }
      } else {
        console.log('❌ User registration failed');
      }
    });
  });

  registerReq.on('error', (error) => {
    console.error('❌ Registration request failed:', error.message);
  });

  registerReq.write(registerData);
  registerReq.end();
}

// Check user verification status
function checkUserVerificationStatus(email) {
  // This would require a database query endpoint, but for now we'll just log
  console.log(`🔍 User ${email} should now have verification token in database`);
  console.log('📧 Verification email should have been sent');
  console.log('🔗 Verification link should contain both token and email parameters');
  
  console.log('\n📋 Next steps to test manually:');
  console.log('1. Check your email for verification link');
  console.log('2. Click the verification link');
  console.log('3. Verify the user is marked as verified in database');
  console.log('4. Test login with the verified account');
}

// Test resend verification endpoint
function testResendVerification() {
  console.log('\n🧪 Testing Resend Verification Endpoint...\n');
  
  const resendData = JSON.stringify({
    email: 'test-verification@example.com'
  });

  const resendOptions = {
    hostname: 'localhost',
    port: 4003,
    path: '/api/auth/resend-verification',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(resendData)
    }
  };

  const resendReq = http.request(resendOptions, (res) => {
    console.log(`📡 Resend Verification Response Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`📡 Resend Verification Response: ${data}`);
      
      if (res.statusCode === 200) {
        console.log('✅ Resend verification successful');
      } else {
        console.log('❌ Resend verification failed');
      }
    });
  });

  resendReq.on('error', (error) => {
    console.error('❌ Resend verification request failed:', error.message);
  });

  resendReq.write(resendData);
  resendReq.end();
}

// Run the complete test
testCompleteVerificationFlow();

// Test resend verification after a delay
setTimeout(testResendVerification, 2000);
