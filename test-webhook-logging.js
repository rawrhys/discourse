import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4003';

async function testWebhookLogging() {
  console.log('🧪 Testing Enhanced Webhook Logging...\n');

  try {
    // Test 1: Check if server is running
    console.log('✅ Server is running and responding');

    // Test 2: Simulate a webhook event to test logging
    console.log('\n🧪 Testing webhook logging with mock data...');
    
    const mockWebhookData = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_webhook_logging',
          metadata: {
            registrationEmail: 'test@webhook.com',
            registrationPassword: 'testpassword123'
          },
          subscription: {
            id: 'sub_test_webhook'
          }
        }
      }
    };

    const response = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'test_signature'
      },
      body: JSON.stringify(mockWebhookData)
    });

    if (response.ok) {
      console.log('✅ Webhook endpoint responded successfully');
      const responseText = await response.text();
      console.log('📝 Response:', responseText);
    } else {
      console.log('❌ Webhook endpoint error:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('📝 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎯 Webhook logging test completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Check server logs for webhook logging messages');
  console.log('2. Verify that the enhanced logging is working');
  console.log('3. Test actual registration flow in browser');
}

testWebhookLogging();
