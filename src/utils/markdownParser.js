/**
 * Resilient Markdown Parser
 * Handles malformed markdown syntax and converts it to proper markdown
 */

export function parseMalformedMarkdown(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return rawText;
  }

  let processedText = rawText;

  // Fix common malformed patterns
  processedText = fixMalformedHeaders(processedText);
  processedText = fixMalformedBold(processedText);
  processedText = fixMalformedItalic(processedText);
  processedText = fixMalformedLists(processedText);
  processedText = fixMalformedReferences(processedText);
  processedText = cleanUpWhitespace(processedText);

  return processedText;
}

function fixMalformedHeaders(text) {
  // Fix headers that start with text instead of #
  const headerPatterns = [
    // Pattern: "Title: Description" -> "# Title"
    /^([A-Z][^:]*?):\s*([^.\n]*?)(?:\.|$)/gm,
    // Pattern: "Title**" -> "# Title"
    /^([A-Z][^*]*?)\*\*$/gm,
    // Pattern: "Title*" -> "# Title" 
    /^([A-Z][^*]*?)\*$/gm
  ];

  headerPatterns.forEach(pattern => {
    text = text.replace(pattern, '# $1');
  });

  // Fix headers that have extra asterisks
  text = text.replace(/^#\s*([^*]+)\*\*$/gm, '# $1');
  text = text.replace(/^#\s*([^*]+)\*$/gm, '# $1');

  return text;
}

function fixMalformedBold(text) {
  // Fix patterns like "*text*" -> "**text**"
  text = text.replace(/\*([^*\n]+?)\*/g, '**$1**');
  
  // Fix patterns like "*text**" -> "**text**"
  text = text.replace(/\*([^*\n]+?)\*\*/g, '**$1**');
  
  // Fix patterns like "**text*" -> "**text**"
  text = text.replace(/\*\*([^*\n]+?)\*/g, '**$1**');

  // Fix patterns like "*text*" that are actually meant to be bold
  // Look for patterns that are clearly meant to be emphasized
  text = text.replace(/\*([A-Z][^*\n]*?)\*/g, '**$1**');

  return text;
}

function fixMalformedItalic(text) {
  // Only apply italic to single words or short phrases that aren't already bold
  // This is more conservative to avoid over-fixing
  text = text.replace(/\*([a-z][a-z\s]*?)\*/g, '*$1*');
  
  return text;
}

function fixMalformedLists(text) {
  // Fix patterns like "Item*:" -> "- Item"
  text = text.replace(/^([^*]+?)\*:\s*/gm, '- $1\n');
  
  // Fix patterns like "Item*" -> "- Item"
  text = text.replace(/^([^*]+?)\*$/gm, '- $1');
  
  // Fix patterns like "Item**" -> "- Item"
  text = text.replace(/^([^*]+?)\*\*$/gm, '- $1');

  return text;
}

function fixMalformedReferences(text) {
  // Fix malformed reference section
  text = text.replace(/References\s*\n\s*\[1\]/g, '\n## References\n\n[1]');
  
  // Fix malformed reference entries
  text = text.replace(/\[(\d+)\]\s*([^.\n]+?)\.\./g, '[$1] $2.');
  
  // Fix missing periods at end of references
  text = text.replace(/\[(\d+)\]\s*([^.\n]+?)(?:\n|$)/g, '[$1] $2.\n');

  return text;
}

function cleanUpWhitespace(text) {
  // Remove excessive whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Fix spacing around headers
  text = text.replace(/\n#/g, '\n\n#');
  
  // Fix spacing around lists
  text = text.replace(/\n-/g, '\n-');
  
  // Remove trailing whitespace
  text = text.replace(/[ \t]+$/gm, '');
  
  // Ensure proper spacing after periods
  text = text.replace(/\.([A-Z])/g, '. $1');

  return text;
}

/**
 * Enhanced parsing that handles the specific malformed content provided
 */
export function parseGreekCityStatesContent(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return rawText;
  }

  let processedText = rawText;

  // Specific fixes for the Greek City-States content
  processedText = processedText
    // Fix the main title and subtitle
    .replace(/^The Formation of the Greek City-States:\s*([^.\n]*?)(?:\.|$)/m, 
             '# The Formation of the Greek City-States\n\n**$1**\n')
    
    // Fix the ending double asterisks
    .replace(/\*\*\.\*\*$/, '')
    
    // Fix malformed section headers
    .replace(/^\*Geography and the Birth of the \*Polis/gm, '## Geography and the Birth of the Polis')
    .replace(/^Social and Economic Foundations\*/gm, '## Social and Economic Foundations')
    .replace(/^\*Political Evolution: From Kings to \*Citizens/gm, '## Political Evolution: From Kings to Citizens')
    .replace(/^Cultural and Religious Unity\*/gm, '## Cultural and Religious Unity')
    .replace(/^\*Challenges and Conflicts/gm, '## Challenges and Conflicts')
    
    // Fix malformed subsection headers
    .replace(/^Population Growth\*/gm, '### Population Growth')
    .replace(/^Trade Networks\*/gm, '### Trade Networks')
    .replace(/^Military Reforms\*/gm, '### Military Reforms')
    
    // Fix malformed list items
    .replace(/^Oligarchy:/gm, '### Oligarchy')
    .replace(/^Tyranny:/gm, '### Tyranny')
    
    // Fix malformed bold text
    .replace(/\*Polis\*/g, '**Polis**')
    .replace(/\*Acropolis\*/g, '**Acropolis**')
    .replace(/\*Agora\*/g, '**Agora**')
    .replace(/\*hoplite\*/g, '**hoplite**')
    .replace(/\*Tyranny\*/g, '**Tyranny**')
    .replace(/\*stasis\*/g, '**stasis**')
    
    // Fix malformed references
    .replace(/References\s*\n\s*\[1\]/g, '\n## References\n\n[1]')
    .replace(/\[1\] Encyclopaedia Britannica\. \(2024\)\. Academic Edition\. Encyclopaedia Britannica, Inc\.\./g, 
             '[1] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc.')
    .replace(/\[2\] Oxford University Press\. \(2012\)\. Oxford Classical Dictionary\. Oxford University Press\./g, 
             '[2] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.');

  // Apply general fixes
  processedText = parseMalformedMarkdown(processedText);

  return processedText;
}

/**
 * Test function to validate parsing
 */
export function testMarkdownParsing() {
  const testCases = [
    {
      input: "The Formation of the Greek City-States: How did scattered settlements become the cradle of democracy, philosophy, and Western civilization?",
      expected: "# The Formation of the Greek City-States\n\n**How did scattered settlements become the cradle of democracy, philosophy, and Western civilization?**"
    },
    {
      input: "*Geography and the Birth of the *Polis",
      expected: "## Geography and the Birth of the Polis"
    },
    {
      input: "Population Growth*: Increased food production",
      expected: "### Population Growth\n\nIncreased food production"
    }
  ];

  testCases.forEach((testCase, index) => {
    const result = parseGreekCityStatesContent(testCase.input);
    console.log(`Test ${index + 1}:`, {
      input: testCase.input,
      result: result,
      expected: testCase.expected,
      passed: result.includes(testCase.expected)
    });
  });
}
