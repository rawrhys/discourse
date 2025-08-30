#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4003';

async function testAuthEndpoints() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  // Test 1: Check if server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/auth/can-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    
    if (healthCheck.ok) {
      console.log('✅ Server is running and responding');
    } else {
      console.log('❌ Server responded with status:', healthCheck.status);
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible:', error.message);
    return;
  }

  // Test 2: Test registration endpoint
  try {
    console.log('\n🧪 Testing registration endpoint...');
    const registerResp = await fetch(`${BASE_URL}/api/auth/register`, {
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

    if (registerResp.ok) {
      const data = await registerResp.json();
      console.log('✅ Registration endpoint working:', data.message);
    } else {
      const errorData = await registerResp.json();
      console.log('❌ Registration endpoint error:', errorData.error);
    }
  } catch (error) {
    console.log('❌ Registration endpoint failed:', error.message);
  }

  // Test 3: Test complete-registration endpoint
  try {
    console.log('\n🧪 Testing complete-registration endpoint...');
    const completeResp = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        gdprConsent: true,
        policyVersion: '1.0'
      })
    });

    if (completeResp.ok) {
      const data = await completeResp.json();
      console.log('✅ Complete-registration endpoint working:', data.message);
    } else {
      const errorData = await completeResp.json();
      console.log('❌ Complete-registration endpoint error:', errorData.error);
    }
  } catch (error) {
    console.log('❌ Complete-registration endpoint failed:', error.message);
  }

  // Test 4: Test verify-email endpoint
  try {
    console.log('\n🧪 Testing verify-email endpoint...');
    const verifyResp = await fetch(`${BASE_URL}/api/auth/verify-email?token=test123&email=test@example.com`);
    
    if (verifyResp.ok) {
      const data = await verifyResp.json();
      console.log('✅ Verify-email endpoint working:', data.message);
    } else {
      const errorData = await verifyResp.json();
      console.log('❌ Verify-email endpoint error:', errorData.error);
    }
  } catch (error) {
    console.log('❌ Verify-email endpoint failed:', error.message);
  }

  console.log('\n🎯 Test completed!');
}

// Run the tests
testAuthEndpoints().catch(console.error);
