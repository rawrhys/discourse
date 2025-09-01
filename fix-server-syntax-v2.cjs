#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting server.js syntax fix (v2)...');

// Read the server file
const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

console.log(`📖 Read server.js (${content.length} characters)`);

// Track changes
let changes = [];

// 1. Remove duplicate allowedOrigins declarations
const allowedOriginsPattern = /(let|const)\s+allowedOrigins\s*=/g;
const matches = [...content.matchAll(allowedOriginsPattern)];

if (matches.length > 1) {
  console.log(`Found ${matches.length} allowedOrigins declarations, removing duplicates...`);
  
  // Keep only the first declaration, remove the rest
  let firstFound = false;
  const lines = content.split('\n');
  const filteredLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('allowedOrigins') && (line.includes('let allowedOrigins') || line.includes('const allowedOrigins'))) {
      if (!firstFound) {
        filteredLines.push(line);
        firstFound = true;
        console.log(`Keeping first allowedOrigins declaration on line ${i + 1}`);
      } else {
        console.log(`Removing duplicate allowedOrigins declaration on line ${i + 1}`);
        changes.push(`Removed duplicate allowedOrigins declaration on line ${i + 1}`);
      }
    } else {
      filteredLines.push(line);
    }
  }
  
  content = filteredLines.join('\n');
}

// 2. Remove any remaining illegal return statements at top level
const lines = content.split('\n');
let fixedLines = [];
let inFunction = false;
let braceCount = 0;
let parenCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track function boundaries more accurately
  if (line.includes('function ') || line.includes('=>') || line.includes('async ')) {
    inFunction = true;
  }
  
  // Count braces and parentheses to track scope
  const openBraces = (line.match(/\{/g) || []).length;
  const closeBraces = (line.match(/\}/g) || []).length;
  const openParens = (line.match(/\(/g) || []).length;
  const closeParens = (line.match(/\)/g) || []).length;
  
  braceCount += openBraces - closeBraces;
  parenCount += openParens - closeParens;
  
  // If we're at brace count 0 and not in a function declaration, we're at top level
  if (braceCount === 0 && parenCount === 0 && !line.includes('function ') && !line.includes('=>')) {
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
  
  // Try to identify the specific error
  const errorOutput = error.stdout?.toString() || error.message;
  if (errorOutput.includes('already been declared')) {
    console.log('\n🔍 Found duplicate variable declarations. Let me fix this...');
    
    // Find and remove duplicate variable declarations
    const variablePattern = /(let|const|var)\s+(\w+)\s*=/g;
    const variables = new Map();
    const lines = content.split('\n');
    const fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/(let|const|var)\s+(\w+)\s*=/);
      
      if (match) {
        const [, declaration, varName] = match;
        if (variables.has(varName)) {
          console.log(`Removing duplicate ${declaration} ${varName} on line ${i + 1}`);
          fixedLines.push(`// ${line} // Removed duplicate declaration`);
        } else {
          variables.set(varName, true);
          fixedLines.push(line);
        }
      } else {
        fixedLines.push(line);
      }
    }
    
    content = fixedLines.join('\n');
    fs.writeFileSync(serverPath, content, 'utf8');
    
    // Test again
    try {
      require('child_process').execSync('node -c server.js', { stdio: 'pipe' });
      console.log('✅ Syntax check passed after fixing duplicates!');
    } catch (error2) {
      console.log('❌ Still has syntax errors:');
      console.log(error2.stdout?.toString() || error2.message);
    }
  }
  
  process.exit(1);
}

console.log('\n🎉 All fixes applied successfully!');
