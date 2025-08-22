import fs from 'fs';

const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

let braceStack = [];
let bracketStack = [];
let parenStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const lineNum = i + 1;
    
    switch (char) {
      case '{':
        braceStack.push({ char, line: lineNum, col: j });
        break;
      case '}':
        if (braceStack.length === 0) {
          console.log(`Extra } at line ${lineNum}, col ${j}`);
        } else {
          braceStack.pop();
        }
        break;
      case '[':
        bracketStack.push({ char, line: lineNum, col: j });
        break;
      case ']':
        if (bracketStack.length === 0) {
          console.log(`Extra ] at line ${lineNum}, col ${j}`);
        } else {
          bracketStack.pop();
        }
        break;
      case '(':
        parenStack.push({ char, line: lineNum, col: j });
        break;
      case ')':
        if (parenStack.length === 0) {
          console.log(`Extra ) at line ${lineNum}, col ${j}`);
        } else {
          parenStack.pop();
        }
        break;
    }
  }
}

console.log('Unmatched braces {:', braceStack.length);
console.log('Unmatched brackets [:', bracketStack.length);
console.log('Unmatched parentheses (:', parenStack.length);

if (braceStack.length > 0) {
  console.log('Unmatched braces:');
  braceStack.forEach(b => console.log(`  { at line ${b.line}, col ${b.col}`));
}

if (bracketStack.length > 0) {
  console.log('Unmatched brackets:');
  bracketStack.forEach(b => console.log(`  [ at line ${b.line}, col ${b.col}`));
}

if (parenStack.length > 0) {
  console.log('Unmatched parentheses:');
  parenStack.forEach(b => console.log(`  ( at line ${b.line}, col ${b.col}`));
}
