#!/usr/bin/env node

/**
 * Test script for email verification system
 * Run with: node test-email-verification.js
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4003'; // Adjust port if needed

async function testEmailVerification() {
  console.log('🧪 Testing Email Verification System\n');

  try {
    // Test 1: Check if verification endpoint exists
    console.log('1. Testing verification endpoint accessibility...');
    const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify-email?token=test&email=test@example.com`);
    console.log(`   Status: ${verifyResponse.status}`);
    console.log(`   Response: ${verifyResponse.status === 400 ? 'Expected error for invalid token' : 'Unexpected response'}`);
    
    // Test 2: Check if resend verification endpoint exists
    console.log('\n2. Testing resend verification endpoint...');
    const resendResponse = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    console.log(`   Status: ${resendResponse.status}`);
    console.log(`   Response: ${resendResponse.status === 404 ? 'Expected error for non-existent user' : 'Unexpected response'}`);

    // Test 3: Check if registration endpoint returns verification requirement
    console.log('\n3. Testing registration endpoint...');
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User',
        gdprConsent: true,
        policyVersion: '1.0'
      })
    });
    
    if (registerResponse.ok) {
      const data = await registerResponse.json();
      console.log(`   Status: ${registerResponse.status}`);
      console.log(`   Requires Email Verification: ${data.requiresEmailVerification || false}`);
      console.log(`   Message: ${data.message}`);
    } else {
      const errorData = await registerResponse.text();
      console.log(`   Status: ${registerResponse.status}`);
      console.log(`   Error: ${errorData}`);
    }

    console.log('\n✅ Email verification system test completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure SMTP settings in your .env file');
    console.log('   2. Test with a real email address');
    console.log('   3. Check email delivery and verification flow');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 Make sure your server is running on the correct port');
  }
}

// Run the test
testEmailVerification();
