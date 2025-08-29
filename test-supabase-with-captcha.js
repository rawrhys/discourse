// Test script for Supabase authentication with captcha handling
// Run this with: node test-supabase-with-captcha.js

const SUPABASE_URL = 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

async function testSupabaseWithCaptcha() {
  console.log('🧪 Testing Supabase Authentication with Captcha Handling...\n');

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

  // Test 2: Test authentication WITHOUT captcha token (should fail with captcha error)
  console.log('\n🧪 Testing authentication WITHOUT captcha token...');
  
  try {
    const jsonData = {
      email: 'test@example.com',
      password: 'testpassword123'
      // No captchaToken - this should trigger captcha error
    };

    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(jsonData)
    });

    console.log('📡 Auth Response Status:', authResponse.status);
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ Authentication successful! (Captcha may be disabled)');
      console.log('📊 Response data:', JSON.stringify(authData, null, 2));
    } else {
      const errorData = await authResponse.text();
      console.log('❌ Authentication failed (expected if captcha is required)');
      
      try {
        const parsedError = JSON.parse(errorData);
        console.log('📊 Parsed error:', JSON.stringify(parsedError, null, 2));
        
        // Check if this is a captcha error
        if (parsedError.error_code === 'unexpected_failure' && parsedError.msg?.includes('captcha')) {
          console.log('🔍 This is a captcha verification error - exactly what we expected!');
          console.log('💡 Solution: Add captchaToken to the request body');
        }
      } catch (e) {
        console.log('📊 Raw error response (not JSON)');
      }
    }
  } catch (error) {
    console.log('❌ Authentication request error:', error.message);
  }

  // Test 3: Test authentication WITH captcha token (mock token)
  console.log('\n🧪 Testing authentication WITH captcha token (mock)...');
  
  try {
    const jsonDataWithCaptcha = {
      email: 'test@example.com',
      password: 'testpassword123',
      captchaToken: 'mock_captcha_token_123' // Mock captcha token
    };

    const authResponseWithCaptcha = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(jsonDataWithCaptcha)
    });

    console.log('📡 Auth Response Status (with captcha):', authResponseWithCaptcha.status);
    
    if (authResponseWithCaptcha.ok) {
      const authData = await authResponseWithCaptcha.json();
      console.log('✅ Authentication successful with captcha token!');
      console.log('📊 Response data:', JSON.stringify(authData, null, 2));
    } else {
      const errorData = await authResponseWithCaptcha.text();
      console.log('❌ Authentication failed even with captcha token');
      
      try {
        const parsedError = JSON.parse(errorData);
        console.log('📊 Parsed error:', JSON.stringify(parsedError, null, 2));
        
        if (parsedError.error_code === 'unexpected_failure' && parsedError.msg?.includes('captcha')) {
          console.log('🔍 Captcha token was invalid or expired');
          console.log('💡 Solution: Use a real, valid captcha token from a captcha service');
        }
      } catch (e) {
        console.log('📊 Raw error response (not JSON)');
      }
    }
  } catch (error) {
    console.log('❌ Authentication request error (with captcha):', error.message);
  }

  // Test 4: Test with Supabase client approach (handles captcha automatically)
  console.log('\n🧪 Testing with Supabase client approach...');
  
  try {
    // This simulates what the Supabase client does internally
    const clientAuthResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'X-Client-Info': 'supabase-js/2.39.2'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123'
      })
    });

    console.log('📡 Client Auth Response Status:', clientAuthResponse.status);
    
    if (clientAuthResponse.ok) {
      const authData = await clientAuthResponse.json();
      console.log('✅ Client authentication successful!');
      console.log('📊 Response data:', JSON.stringify(authData, null, 2));
    } else {
      const errorData = await clientAuthResponse.text();
      console.log('❌ Client authentication failed');
      
      try {
        const parsedError = JSON.parse(errorData);
        console.log('📊 Parsed error:', JSON.stringify(parsedError, null, 2));
      } catch (e) {
        console.log('📊 Raw error response (not JSON)');
      }
    }
  } catch (error) {
    console.log('❌ Client authentication request error:', error.message);
  }

  console.log('\n🏁 Captcha handling test completed!');
  console.log('\n📋 Summary:');
  console.log('1. If you get captcha errors, you need to either:');
  console.log('   - Disable captcha in Supabase dashboard, OR');
  console.log('   - Implement proper captcha handling with real tokens');
  console.log('2. The Supabase client handles captcha automatically');
  console.log('3. Direct API calls require manual captcha token handling');
}

// Run the test
testSupabaseWithCaptcha().catch(console.error);
