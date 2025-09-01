#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive duplicate removal...');

// Read the server file
const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

console.log(`📖 Read server.js (${content.length} characters)`);

// Track changes
let changes = [];

// Remove ALL duplicate variable declarations
const lines = content.split('\n');
const fixedLines = [];
const declaredVariables = new Set();
const declaredFunctions = new Set();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check for variable declarations
  const varMatch = line.match(/^(let|const|var)\s+(\w+)\s*=/);
  if (varMatch) {
    const [, declaration, varName] = varMatch;
    if (declaredVariables.has(varName)) {
      console.log(`Removing duplicate ${declaration} ${varName} on line ${i + 1}`);
      fixedLines.push(`// ${line} // Removed duplicate declaration`);
      changes.push(`Removed duplicate ${declaration} ${varName} on line ${i + 1}`);
    } else {
      declaredVariables.add(varName);
      fixedLines.push(line);
    }
    continue;
  }
  
  // Check for function declarations
  const funcMatch = line.match(/^function\s+(\w+)\s*\(/);
  if (funcMatch) {
    const [, funcName] = funcMatch;
    if (declaredFunctions.has(funcName)) {
      console.log(`Removing duplicate function ${funcName} on line ${i + 1}`);
      fixedLines.push(`// ${line} // Removed duplicate function`);
      changes.push(`Removed duplicate function ${funcName} on line ${i + 1}`);
    } else {
      declaredFunctions.add(funcName);
      fixedLines.push(line);
    }
    continue;
  }
  
  // Check for arrow function assignments
  const arrowMatch = line.match(/^(let|const|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
  if (arrowMatch) {
    const [, declaration, varName] = arrowMatch;
    if (declaredVariables.has(varName)) {
      console.log(`Removing duplicate arrow function ${varName} on line ${i + 1}`);
      fixedLines.push(`// ${line} // Removed duplicate arrow function`);
      changes.push(`Removed duplicate arrow function ${varName} on line ${i + 1}`);
    } else {
      declaredVariables.add(varName);
      fixedLines.push(line);
    }
    continue;
  }
  
  // Regular line - keep as is
  fixedLines.push(line);
}

content = fixedLines.join('\n');

// Remove any remaining illegal return statements at top level
const finalLines = content.split('\n');
let finalFixedLines = [];
let inFunction = false;
let braceCount = 0;

for (let i = 0; i < finalLines.length; i++) {
  const line = finalLines[i];
  
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
    finalFixedLines.push(line.replace('return null;', '// return null; // Fixed: removed illegal return at top level'));
    changes.push(`Fixed illegal return statement on line ${i + 1}`);
  } else {
    finalFixedLines.push(line);
  }
}

content = finalFixedLines.join('\n');

// Clean up any trailing whitespace and excessive empty lines
content = content
  .split('\n')
  .map(line => line.trimEnd())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n'); // Replace 3+ consecutive newlines with 2

changes.push('Cleaned up whitespace and empty lines');

// Write the fixed content back
fs.writeFileSync(serverPath, content, 'utf8');

console.log('✅ Comprehensive duplicate removal completed!');
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
