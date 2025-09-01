#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting final server.js syntax fix...');

// Read the server file
const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

console.log(`📖 Read server.js (${content.length} characters)`);

// Track changes
let changes = [];

// 1. Fix the orphaned method chain from line 1189
const orphanedPattern = /^\s*\.split\(','\)\s*\n\s*\.map\(s => s\.trim\(\)\)\s*\n\s*\.filter\(Boolean\);\s*$/gm;
if (orphanedPattern.test(content)) {
  content = content.replace(orphanedPattern, '');
  changes.push('Removed orphaned method chain from duplicate allowedOrigins');
}

// 2. Remove any remaining illegal return statements at top level
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

// 3. Clean up any trailing whitespace and excessive empty lines
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
