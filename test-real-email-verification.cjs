const http = require('http');

// Test the complete email verification flow with real email
async function testRealEmailVerification() {
  console.log('🧪 Testing Email Verification System with Real Email...\n');
  
  // Step 1: Register a new user with real email
  console.log('📝 Step 1: Registering new user with rhys.higgs@outlook.com...');
  const registerData = JSON.stringify({
    email: 'rhys.higgs@outlook.com',
    password: 'testpassword123',
    name: 'Rhys Higgs',
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
        console.log('✅ User registration successful!');
        
        // Parse the response to get user details
        try {
          const response = JSON.parse(data);
          if (response.requiresEmailVerification) {
            console.log('✅ Email verification required as expected');
            console.log('📧 Verification email should now be sent to rhys.higgs@outlook.com');
            
            // Step 2: Check verification email
            console.log('\n📝 Step 2: Email Verification Process');
            console.log('🔍 Check your Outlook inbox for the verification email');
            console.log('📧 Subject: "Verify Your Email - Discourse AI"');
            console.log('🔗 The verification link should contain both token and email parameters');
            
            // Step 3: Instructions for manual testing
            console.log('\n📋 Step 3: Manual Testing Instructions');
            console.log('1. 📧 Check your email (including spam/junk folder)');
            console.log('2. 🔗 Click the verification link in the email');
            console.log('3. ✅ You should see "Email Verified!" message');
            console.log('4. 🔄 You\'ll be redirected to login page');
            console.log('5. 🔐 Try logging in with the credentials you just created');
            
            // Step 4: Test resend verification
            console.log('\n📝 Step 4: Testing Resend Verification...');
            setTimeout(testResendVerification, 1000);
            
          } else {
            console.log('❌ Email verification not required - this is unexpected');
          }
        } catch (error) {
          console.log('❌ Failed to parse registration response');
        }
      } else {
        console.log('❌ User registration failed');
        console.log('💡 This might mean the email is already registered');
        
        // Try to resend verification for existing user
        console.log('\n📝 Attempting to resend verification for existing user...');
        setTimeout(testResendVerification, 1000);
      }
    });
  });

  registerReq.on('error', (error) => {
    console.error('❌ Registration request failed:', error.message);
  });

  registerReq.write(registerData);
  registerReq.end();
}

// Test resend verification endpoint
function testResendVerification() {
  console.log('\n🧪 Testing Resend Verification Endpoint...\n');
  
  const resendData = JSON.stringify({
    email: 'rhys.higgs@outlook.com'
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
        console.log('📧 A new verification email has been sent to rhys.higgs@outlook.com');
      } else {
        console.log('❌ Resend verification failed');
        console.log('💡 This might mean the user doesn\'t exist or email is already verified');
      }
    });
  });

  resendReq.on('error', (error) => {
    console.error('❌ Resend verification request failed:', error.message);
  });

  resendReq.write(resendData);
  resendReq.end();
}

// Test login after verification
function testLoginAfterVerification() {
  console.log('\n🧪 Testing Login After Verification...\n');
  
  const loginData = JSON.stringify({
    email: 'rhys.higgs@outlook.com',
    password: 'testpassword123'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 4003,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  const loginReq = http.request(loginOptions, (res) => {
    console.log(`📡 Login Response Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`📡 Login Response: ${data}`);
      
      if (res.statusCode === 200) {
        console.log('✅ Login successful! Email verification is working properly');
      } else if (res.statusCode === 401) {
        const response = JSON.parse(data);
        if (response.code === 'EMAIL_NOT_CONFIRMED') {
          console.log('❌ Login failed - Email not confirmed yet');
          console.log('💡 Please check your email and click the verification link first');
        } else {
          console.log('❌ Login failed - Invalid credentials or other issue');
        }
      } else {
        console.log('❌ Login failed with unexpected status');
      }
    });
  });

  loginReq.on('error', (error) => {
    console.error('❌ Login request failed:', error.message);
  });

  loginReq.write(loginData);
  loginReq.end();
}

// Run the complete test
console.log('🚀 Starting Real Email Verification Test...\n');
testRealEmailVerification();

// Test login after a delay (to allow time for manual verification)
console.log('\n⏰ Will test login in 30 seconds (to allow time for manual verification)...');
setTimeout(() => {
  console.log('\n🧪 Testing Login After Manual Verification...');
  testLoginAfterVerification();
}, 30000);
