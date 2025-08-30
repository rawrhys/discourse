#!/usr/bin/env node

/**
 * Test script for email verification system
 * Run with: node test-email-verification.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:4003'; // Adjust port if needed

// Load the database
const dbPath = path.join(__dirname, 'db.json');
let db = { users: [] };

try {
  if (fs.existsSync(dbPath)) {
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    db = JSON.parse(dbContent);
  }
} catch (error) {
  console.error('Error loading database:', error);
}

console.log('=== Email Verification Debug ===\n');

// Check database structure
console.log('Database users count:', db.users.length);

// Check if users have verification fields
const usersWithVerification = db.users.filter(u => u.verificationToken || u.emailVerified !== undefined);
console.log('Users with verification fields:', usersWithVerification.length);

// Show user details
db.users.forEach((user, index) => {
  console.log(`\nUser ${index + 1}:`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Email Verified: ${user.emailVerified || 'undefined'}`);
  console.log(`  Verification Token: ${user.verificationToken ? user.verificationToken.substring(0, 20) + '...' : 'none'}`);
  console.log(`  Token Created: ${user.verificationTokenCreatedAt || 'none'}`);
  console.log(`  Created At: ${user.createdAt}`);
});

// Check for any users that might need verification
const unverifiedUsers = db.users.filter(u => u.emailVerified === false);
console.log(`\nUnverified users: ${unverifiedUsers.length}`);

if (unverifiedUsers.length > 0) {
  console.log('\nUnverified users details:');
  unverifiedUsers.forEach(user => {
    console.log(`  - ${user.email}: ${user.verificationToken ? 'Has token' : 'No token'}`);
  });
}

// Check for users with verification tokens
const usersWithTokens = db.users.filter(u => u.verificationToken);
console.log(`\nUsers with verification tokens: ${usersWithTokens.length}`);

if (usersWithTokens.length > 0) {
  console.log('\nVerification tokens:');
  usersWithTokens.forEach(user => {
    const tokenAge = user.verificationTokenCreatedAt ? 
      Date.now() - new Date(user.verificationTokenCreatedAt).getTime() : 
      'unknown';
    const tokenAgeHours = typeof tokenAge === 'number' ? Math.round(tokenAge / (1000 * 60 * 60)) : 'unknown';
    console.log(`  - ${user.email}: ${tokenAgeHours} hours old`);
  });
}

console.log('\n=== End Debug ===');

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
