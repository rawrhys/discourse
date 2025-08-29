// Corrected test script for Supabase authentication
// Run this with: node test-supabase-auth-corrected.js

const SUPABASE_URL = 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

async function testSupabaseAuthCorrected() {
  console.log('🧪 Testing Corrected Supabase Authentication...\n');

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

  // Test 2: Test with JSON data (correct format)
  console.log('\n🧪 Testing authentication with JSON data...');
  
  try {
    const jsonData = {
      email: 'test@example.com',
      password: 'testpassword123'
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
    console.log('📡 Auth Response Headers:', Object.fromEntries(authResponse.headers.entries()));

    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ Authentication successful!');
      console.log('📊 Response data:', JSON.stringify(authData, null, 2));
    } else {
      const errorData = await authResponse.text();
      console.log('❌ Authentication failed');
      console.log('📊 Error response:', errorData);
      
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

  // Test 3: Test with Supabase signup endpoint first
  console.log('\n🧪 Testing user creation with signup endpoint...');
  
  try {
    const signupData = {
      email: 'test@example.com',
      password: 'testpassword123'
    };

    const signupResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(signupData)
    });

    console.log('📡 Signup Response Status:', signupResponse.status);
    
    if (signupResponse.ok) {
      const signupResult = await signupResponse.json();
      console.log('✅ User created successfully!');
      console.log('📊 Signup data:', JSON.stringify(signupResult, null, 2));
    } else {
      const errorData = await signupResponse.text();
      console.log('❌ Signup failed');
      console.log('📊 Error response:', errorData);
      
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.msg && parsedError.msg.includes('already registered')) {
          console.log('ℹ️ User already exists, this is expected');
        } else {
          console.log('📊 Parsed error:', JSON.stringify(parsedError, null, 2));
        }
      } catch (e) {
        console.log('📊 Raw error response (not JSON)');
      }
    }
  } catch (error) {
    console.log('❌ Signup request error:', error.message);
  }

  // Test 4: Test with proper Supabase client approach
  console.log('\n🧪 Testing with proper Supabase client approach...');
  
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
      console.log('📊 Error response:', errorData);
      
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

  console.log('\n🏁 Corrected test completed!');
}

// Run the corrected test
testSupabaseAuthCorrected().catch(console.error);
