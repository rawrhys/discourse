// Test script to verify Supabase authentication
// Run this with: node test-supabase-auth.js

const SUPABASE_URL = 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

async function testSupabaseAuth() {
  console.log('🧪 Testing Supabase Authentication...\n');

  // Test 1: Check if Supabase is accessible
  try {
    const healthCheck = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (healthCheck.ok) {
      console.log('✅ Supabase is accessible');
    } else {
      console.log('❌ Supabase health check failed:', healthCheck.status);
    }
  } catch (error) {
    console.log('❌ Supabase health check error:', error.message);
  }

  // Test 2: Test authentication endpoint format
  console.log('\n🧪 Testing authentication endpoint...');
  
  try {
    // Create form-encoded data as required by Supabase
    const formData = new URLSearchParams({
      email: 'test@example.com',
      password: 'testpassword123',
      grant_type: 'password'
    });

    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': SUPABASE_ANON_KEY
      },
      body: formData.toString()
    });

    console.log('📡 Auth Response Status:', authResponse.status);
    console.log('📡 Auth Response Headers:', Object.fromEntries(authResponse.headers.entries()));

    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ Authentication successful!');
      console.log('📊 Response data:', JSON.stringify(authData, null, 2));
    } else {
      const errorData = await authResponse.text();
      console.log('❌ Authentication failed');
      console.log('📊 Error response:', errorData);
      
      // Try to parse as JSON for better error details
      try {
        const parsedError = JSON.parse(errorData);
        console.log('📊 Parsed error:', JSON.stringify(parsedError, null, 2));
      } catch (e) {
        console.log('📊 Raw error response (not JSON)');
      }
    }
  } catch (error) {
    console.log('❌ Authentication request error:', error.message);
  }

  // Test 3: Test with wrong content type (should fail)
  console.log('\n🧪 Testing with wrong content type (should fail)...');
  
  try {
    const wrongContentTypeResponse = await fetch(`${SUPABASE_URL}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
        grant_type: 'password'
      })
    });

    console.log('📡 Wrong Content-Type Response Status:', wrongContentTypeResponse.status);
    
    if (!wrongContentTypeResponse.ok) {
      const errorData = await wrongContentTypeResponse.text();
      console.log('✅ Correctly rejected wrong content type');
      console.log('📊 Error response:', errorData);
    } else {
      console.log('❌ Should have failed with wrong content type');
    }
  } catch (error) {
    console.log('❌ Wrong content type test error:', error.message);
  }

  console.log('\n🏁 Test completed!');
}

// Run the test
testSupabaseAuth().catch(console.error);
