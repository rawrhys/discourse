/**
 * Test script to verify student progress fixes
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const API_BASE_URL = process.env.API_BASE_URL || 'https://thediscourse.ai';

async function testStudentProgressFixes() {
  console.log('🧪 Testing Student Progress Fixes...\n');

  // Test 0: Check if server is responding at all
  console.log('0️⃣ Testing server connectivity...');
  try {
    const healthUrl = `${API_BASE_URL}/api/test-checkout`;
    console.log('Testing health endpoint:', healthUrl);
    
    const response = await fetch(healthUrl);
    const responseText = await response.text();
    console.log('Health check status:', response.status);
    console.log('Health check response (first 200 chars):', responseText.substring(0, 200));
    
    if (response.status === 200) {
      console.log('✅ Server is responding');
    } else {
      console.log('❌ Server health check failed');
    }
  } catch (error) {
    console.log('❌ Server connectivity failed:', error.message);
  }

  // Test 1: Check if StudentProgressService can be imported using the actual course ID from logs
  console.log('\n1️⃣ Testing StudentProgressService import...');
  try {
    const courseId = 'course_1756759812654_7ilfx3qd0';
    const sessionId = 'test-session-123';
    const url = `${API_BASE_URL}/api/public/courses/${courseId}/student-progress?sessionId=${sessionId}`;
    console.log('Testing URL:', url);
    
    const response = await fetch(url);
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text (first 200 chars):', responseText.substring(0, 200));
    
    if (responseText.includes('<!DOCTYPE html>')) {
      console.log('❌ Server returned HTML error page - endpoint does not exist on deployed server');
      console.log('💡 This means the fixes need to be deployed to the VPS');
      return;
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.log('❌ Response is not valid JSON:', parseError.message);
      return;
    }
    
    console.log('Response data:', data);
    
    if (response.status === 400 && data.error === 'Missing sessionId query parameter') {
      console.log('✅ StudentProgressService import working - endpoint responding correctly');
    } else if (response.status === 404 && data.error === 'Student progress not found') {
      console.log('✅ StudentProgressService import working - service found but no progress data (expected)');
    } else if (response.status === 200) {
      console.log('✅ StudentProgressService import working - endpoint responding successfully');
    } else {
      console.log('❌ Unexpected response:', response.status, data);
    }
  } catch (error) {
    console.log('❌ StudentProgressService import failed:', error.message);
  }

  // Test 2: Test public student progress endpoint
  console.log('\n2️⃣ Testing public student progress endpoint...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/courses/test-course/student-progress?sessionId=test-session-456`);
    const data = await response.json();
    
    if (response.status === 404 && data.error === 'Student progress not found') {
      console.log('✅ Public student progress endpoint working - no progress found (expected for new session)');
    } else {
      console.log('❌ Unexpected response:', response.status, data);
    }
  } catch (error) {
    console.log('❌ Public student progress endpoint failed:', error.message);
  }

  // Test 3: Test authenticated student progress endpoint (should redirect to public)
  console.log('\n3️⃣ Testing authenticated student progress endpoint without token...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses/test-course/student-progress?sessionId=test-session-789`);
    
    if (response.status === 400 && response.url.includes('/api/public/courses/')) {
      console.log('✅ Authenticated endpoint correctly redirects to public endpoint');
    } else {
      console.log('❌ Unexpected response:', response.status, response.url);
    }
  } catch (error) {
    console.log('❌ Authenticated student progress endpoint failed:', error.message);
  }

  console.log('\n🎉 Student Progress Fix Tests Completed!');
}

// Run the tests
testStudentProgressFixes().catch(console.error);