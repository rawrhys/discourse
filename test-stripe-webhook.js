#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4003';

async function testStripeWebhook() {
  console.log('🧪 Testing Stripe Webhook and User Creation...\n');

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
      return;
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible:', error.message);
    return;
  }

  // Test 2: Test complete-registration endpoint
  try {
    console.log('\n🧪 Testing complete-registration endpoint...');
    const completeResp = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stripe-test@example.com',
        name: 'Stripe Test User',
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

  // Test 3: Test registration endpoint
  try {
    console.log('\n🧪 Testing registration endpoint...');
    const registerResp = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stripe-test2@example.com',
        password: 'testpassword123',
        name: 'Stripe Test User 2',
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

  // Test 4: Test Stripe checkout session creation
  try {
    console.log('\n🧪 Testing Stripe checkout session creation...');
    const checkoutResp = await fetch(`${BASE_URL}/api/auth/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stripe-test3@example.com',
        password: 'testpassword123'
      })
    });

    if (checkoutResp.ok) {
      const data = await checkoutResp.json();
      console.log('✅ Stripe checkout session created successfully');
      console.log('   Checkout URL:', data.url ? 'Available' : 'Missing');
    } else {
      const errorData = await checkoutResp.json();
      console.log('❌ Stripe checkout session creation failed:', errorData.error);
    }
  } catch (error) {
    console.log('❌ Stripe checkout session creation failed:', error.message);
  }

  console.log('\n🎯 Test completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Check if users were created in db.json');
  console.log('2. Verify Stripe webhook is receiving events');
  console.log('3. Test payment flow in browser');
}

// Run the tests
testStripeWebhook().catch(console.error);
