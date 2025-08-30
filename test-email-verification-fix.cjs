const fs = require('fs');
const path = require('path');

// Test the email verification system
async function testEmailVerification() {
  console.log('🧪 Testing Email Verification System...\n');
  
  try {
    // Check if db.json exists
    const dbPath = path.join(__dirname, 'db.json');
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database file not found. Please start the server first to create it.');
      return;
    }
    
    // Read database
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    console.log('📊 Database loaded successfully');
    
    // Check users
    if (!dbData.users || dbData.users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`👥 Found ${dbData.users.length} users:`);
    
    for (const user of dbData.users) {
      console.log(`\n👤 User: ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email Verified: ${user.emailVerified !== undefined ? user.emailVerified : '❌ MISSING'}`);
      console.log(`   Verification Token: ${user.verificationToken !== undefined ? (user.verificationToken ? '✅ SET' : '❌ NULL') : '❌ MISSING'}`);
      console.log(`   Token Created At: ${user.verificationTokenCreatedAt !== undefined ? user.verificationTokenCreatedAt : '❌ MISSING'}`);
      console.log(`   Email Verified At: ${user.emailVerifiedAt !== undefined ? user.emailVerifiedAt : '❌ MISSING'}`);
      console.log(`   Password: ${user.password !== undefined ? (user.password ? '✅ SET' : '❌ NULL') : '❌ MISSING'}`);
      
      // Check if user needs migration
      const needsMigration = 
        user.emailVerified === undefined ||
        user.verificationToken === undefined ||
        user.verificationTokenCreatedAt === undefined ||
        user.emailVerifiedAt === undefined ||
        (user.id.startsWith('local_') && user.password === undefined);
      
      if (needsMigration) {
        console.log('   ⚠️  NEEDS MIGRATION');
      } else {
        console.log('   ✅ UP TO DATE');
      }
    }
    
    // Check if server.js has the required endpoints
    const serverPath = path.join(__dirname, 'server.js');
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      
      const hasGetEndpoint = serverContent.includes('app.get(\'/api/auth/verify-email\'');
      const hasPostEndpoint = serverContent.includes('app.post(\'/api/auth/verify-email\'');
      const hasMigrationFunction = serverContent.includes('function migrateExistingUsers');
      const hasEmailInUrl = serverContent.includes('&email=${encodeURIComponent(email)}');
      
      console.log('\n🔧 Server Configuration Check:');
      console.log(`   GET /api/auth/verify-email: ${hasGetEndpoint ? '✅ FOUND' : '❌ MISSING'}`);
      console.log(`   POST /api/auth/verify-email: ${hasPostEndpoint ? '✅ FOUND' : '❌ MISSING'}`);
      console.log(`   Migration Function: ${hasMigrationFunction ? '✅ FOUND' : '❌ MISSING'}`);
      console.log(`   Email in Verification URL: ${hasEmailInUrl ? '✅ FOUND' : '❌ MISSING'}`);
    }
    
    console.log('\n📝 Recommendations:');
    if (dbData.users.some(u => 
      u.emailVerified === undefined ||
      u.verificationToken === undefined ||
      u.verificationTokenCreatedAt === undefined ||
      u.emailVerifiedAt === undefined
    )) {
      console.log('   1. Restart the server to trigger user migration');
      console.log('   2. Check server logs for migration messages');
    }
    
    console.log('   3. Test registration with a new email to verify the system works');
    console.log('   4. Check that verification emails contain both token and email parameters');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testEmailVerification();
