/**
 * Test file for content formatter functionality
 */

import { 
  fixMalformedContent, 
  cleanContentFormatting, 
  stripSectionKeys, 
  getContentAsString,
  getContentAsArray 
} from './contentFormatter.js';

// Test the improved newline handling
const testNewlineHandling = () => {
  console.log('🧪 Testing newline handling...');
  
  const testCases = [
    {
      name: 'Basic escaped newlines',
      input: 'Hello\\n\\nworld',
      expected: 'Hello\n\nworld'
    },
    {
      name: 'Newlines near words',
      input: 'Hello\\n\\nmonkey world',
      expected: 'Hello\n\nmonkey world'
    },
    {
      name: 'Mixed newlines',
      input: 'Hello\\n\\nworld\\n\\nmonkey\\nbanana',
      expected: 'Hello\n\nworld\n\nmonkey\nbanana'
    },
    {
      name: 'Newlines with spaces',
      input: 'Hello\\n\\n world',
      expected: 'Hello\n\n world'
    }
  ];

  testCases.forEach(testCase => {
    const result = cleanContentFormatting(testCase.input);
    const passed = result === testCase.expected;
    console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASSED' : 'FAILED'}`);
    if (!passed) {
      console.log(`  Expected: "${testCase.expected}"`);
      console.log(`  Got:      "${result}"`);
    }
  });
};

// Test section stripping
const testSectionStripping = () => {
  console.log('\n🧪 Testing section stripping...');
  
  const testContent = {
    introduction: 'This is the intro\\n\\nwith newlines',
    main_content: 'This is the main content\\n\\nwith more newlines',
    conclusion: 'This is the conclusion'
  };

  // Test stripSectionKeys
  const stripped = stripSectionKeys(testContent);
  console.log('✅ stripSectionKeys result:', stripped);
  
  // Test getContentAsString
  const asString = getContentAsString(testContent);
  console.log('✅ getContentAsString result:', asString);
  
  // Test getContentAsArray
  const asArray = getContentAsArray(testContent);
  console.log('✅ getContentAsArray result:', asArray);
};

// Test malformed JSON handling
const testMalformedJson = () => {
  console.log('\n🧪 Testing malformed JSON handling...');
  
  const malformedJson = '{"introduction":"Hello\\n\\nworld","main_content":"This is\\n\\nmonkey content","conclusion":"The end"}';
  
  const fixed = fixMalformedContent(malformedJson);
  console.log('✅ Fixed malformed JSON:', fixed);
  
  const asString = getContentAsString(malformedJson);
  console.log('✅ As string:', asString);
};

// Run all tests
export const runContentFormatterTests = () => {
  console.log('🚀 Running Content Formatter Tests...\n');
  
  try {
    testNewlineHandling();
    testSectionStripping();
    testMalformedJson();
    
    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Auto-run tests in development
if (process.env.NODE_ENV === 'development') {
  runContentFormatterTests();
}

export default runContentFormatterTests;
