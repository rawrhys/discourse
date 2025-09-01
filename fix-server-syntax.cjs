#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting server.js syntax fix...');

// Read the server file
const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

console.log(`📖 Read server.js (${content.length} characters)`);

// Track changes
let changes = [];

// 1. Remove the large duplicate code block (lines ~1189-1348)
// This is the duplicate email functionality and app initialization
const duplicateStartPattern = /\/\/ Email verification and password reset functionality\s*\n\s*\n\s*if \(!process\.env\.SMTP_HOST/;
const duplicateEndPattern = /const app = express\(\);\s*\n\s*\n\s*\n\s*\/\/ --- CORE MIDDLEWARE ---/;

if (duplicateStartPattern.test(content) && duplicateEndPattern.test(content)) {
  const beforeLength = content.length;
  
  // Find the start of the duplicate block
  const startMatch = content.match(duplicateStartPattern);
  if (startMatch) {
    const startIndex = content.indexOf(startMatch[0]);
    
    // Find the end of the duplicate block
    const endMatch = content.match(duplicateEndPattern);
    if (endMatch) {
      const endIndex = content.indexOf(endMatch[0]);
      
      // Remove the duplicate block
      content = content.substring(0, startIndex) + content.substring(endIndex);
      
      changes.push(`Removed duplicate code block (${beforeLength - content.length} characters)`);
    }
  }
}

// 2. Fix any remaining illegal return statements at top level
// Look for return statements that are not inside functions
const lines = content.split('\n');
let fixedLines = [];
let inFunction = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track function boundaries
  if (line.includes('function ') || line.includes('=>') || line.includes('async ')) {
    inFunction = true;
  }
  
  // Count braces to track function scope
  const openBraces = (line.match(/\{/g) || []).length;
  const closeBraces = (line.match(/\}/g) || []).length;
  braceCount += openBraces - closeBraces;
  
  // If we're at brace count 0 and not in a function declaration, we're at top level
  if (braceCount === 0 && !line.includes('function ') && !line.includes('=>')) {
    inFunction = false;
  }
  
  // Fix illegal return statements at top level
  if (!inFunction && line.trim().startsWith('return null;')) {
    fixedLines.push(line.replace('return null;', '// return null; // Fixed: removed illegal return at top level'));
    changes.push(`Fixed illegal return statement on line ${i + 1}`);
  } else {
    fixedLines.push(line);
  }
}

content = fixedLines.join('\n');

// 3. Fix any remaining syntax issues with allowedOrigins
// Ensure the allowedOrigins declaration is properly formatted
const allowedOriginsPattern = /let allowedOrigins = \(process\.env\.CORS_ALLOWED_ORIGINS[\s\S]*?\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\);/;

if (allowedOriginsPattern.test(content)) {
  // The pattern is already correct, just ensure it's properly formatted
  content = content.replace(allowedOriginsPattern, (match) => {
    // Clean up any formatting issues
    return match.replace(/\s+/g, ' ').trim();
  });
  changes.push('Cleaned up allowedOrigins formatting');
}

// 4. Remove any duplicate function definitions
const functionNames = new Set();
const functionPattern = /^(function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?function|let\s+(\w+)\s*=\s*(?:async\s+)?function)/gm;
let match;

// First pass: collect all function names
while ((match = functionPattern.exec(content)) !== null) {
  const functionName = match[2] || match[3] || match[5];
  if (functionName) {
    if (functionNames.has(functionName)) {
      console.log(`⚠️  Found duplicate function: ${functionName}`);
    }
    functionNames.add(functionName);
  }
}

// 5. Clean up any trailing whitespace and empty lines
content = content
  .split('\n')
  .map(line => line.trimEnd())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n'); // Replace 3+ consecutive newlines with 2

changes.push('Cleaned up whitespace and empty lines');

// Write the fixed content back
fs.writeFileSync(serverPath, content, 'utf8');

console.log('✅ Server.js syntax fix completed!');
console.log(`📊 Changes made:`);
changes.forEach(change => console.log(`   - ${change}`));

// Test syntax
console.log('\n🧪 Testing syntax...');
try {
  require('child_process').execSync('node -c server.js', { stdio: 'pipe' });
  console.log('✅ Syntax check passed!');
} catch (error) {
  console.log('❌ Syntax check failed:');
  console.log(error.stdout?.toString() || error.message);
  process.exit(1);
}

console.log('\n🎉 All fixes applied successfully!');
