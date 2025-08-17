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
  
  // Final cleanup of any leftover syntax issues
  processedText = cleanupLeftoverSyntax(processedText);

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
  // First, protect already properly formatted bold text
  text = text.replace(/\*\*([^*]+?)\*\*/g, '___BOLD_PROTECTED___$1___BOLD_PROTECTED___');
  
  // Fix specific malformed patterns found in the content
  text = text
    // Fix patterns like "Polis*" -> "**Polis**"
    .replace(/\bPolis\*/g, '**Polis**')
    .replace(/\bAcropolis\*/g, '**Acropolis**')
    .replace(/\bAgora\*/g, '**Agora**')
    .replace(/\bPoleis\*/g, '**Poleis**')
    .replace(/\bTyranny\*\*/g, '**Tyranny**')
    
    // Fix patterns like "*hoplite" -> "**hoplite**"
    .replace(/\*hoplite\b/g, '**hoplite**')
    .replace(/\*stasis\b/g, '**stasis**')
    .replace(/\*Gerousia\b/g, '**Gerousia**')
    
    // Fix patterns like "*text**" -> "**text**" (single asterisk followed by double)
    .replace(/\*([^*\n]+?)\*\*/g, '**$1**')
    
    // Fix patterns like "**text*" -> "**text**" (double asterisk followed by single)
    .replace(/\*\*([^*\n]+?)\*/g, '**$1**');
  
  // Fix patterns like "*text*" -> "**text**" (single asterisk on both sides)
  // But only for specific words that should be bold
  const boldWords = [
    'Polis', 'Acropolis', 'Agora', 'Poleis', 'Citizens', 'Tyranny',
    'Cultural', 'Religious', 'Challenges', 'Conflicts', 'Geography',
    'Social', 'Economic', 'Political', 'Population', 'Trade', 'Military', 'Oligarchy',
    'hoplite', 'stasis', 'Dark Age', 'Archaic Period', 'Mycenaean', 'Gerousia',
    // Add new words from the Archaic Period content
    'Lyric Poetry', 'Oracle of Delphi', 'Olympic Games', 'Sappho', 'Homer',
    'Pythia', 'Apollo', 'Mount Parnassus', 'Delphi', 'Olympia', 'Zeus',
    'arete', 'ekecheiria', 'stadion', 'pankration', 'agoge', 'gymnasia',
    'Sophocles', 'Classical Period', 'Athens', 'democracy'
  ];
  
  boldWords.forEach(word => {
    const regex = new RegExp(`\\*${word}\\b`, 'g');
    text = text.replace(regex, `**${word}**`);
  });
  
  // Restore protected bold text
  text = text.replace(/___BOLD_PROTECTED___([^*]+?)___BOLD_PROTECTED___/g, '**$1**');
  
  // Clean up any remaining malformed patterns
  text = text.replace(/\*\*\*\*/g, '**');
  text = text.replace(/\*\*\*\*\*/g, '**');

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

function cleanupLeftoverSyntax(text) {
  // Clean up any remaining malformed patterns
  text = text
    // Fix incomplete bold patterns
    .replace(/\*\*([^*\n]+?)$/gm, '**$1**')  // Unclosed bold at end of line
    .replace(/^([^*\n]+?)\*\*/gm, '**$1**')  // Unclosed bold at start of line
    
    // Fix single asterisks that should be bold
    .replace(/\*Polis\b/g, '**Polis**')
    .replace(/\*Acropolis\b/g, '**Acropolis**')
    .replace(/\*Agora\b/g, '**Agora**')
    .replace(/\*Tyranny\b/g, '**Tyranny**')
    .replace(/\*helots\b/g, '**helots**')
    .replace(/\*stasis\b/g, '**stasis**')
    .replace(/\*hoplite\b/g, '**hoplite**')
    .replace(/\*Gerousia\b/g, '**Gerousia**')
    
    // Fix patterns with asterisk at the end
    .replace(/\bPolis\*/g, '**Polis**')
    .replace(/\bAcropolis\*/g, '**Acropolis**')
    .replace(/\bAgora\*/g, '**Agora**')
    .replace(/\bPoleis\*/g, '**Poleis**')
    .replace(/\bTyranny\*/g, '**Tyranny**')
    
    // Fix patterns with double asterisk at the end
    .replace(/\bTyranny\*\*/g, '**Tyranny**')
    .replace(/\bstasis\*\*/g, '**stasis**')
    
    // Fix malformed headers
    .replace(/^\*Geography and the Birth of the Polis/gm, '## Geography and the Birth of the Polis')
    .replace(/^Social and Economic Foundations/gm, '## Social and Economic Foundations')
    .replace(/^Political Evolution: From Kings to Citizens/gm, '## Political Evolution: From Kings to Citizens')
    .replace(/^Cultural and Religious Unity/gm, '## Cultural and Religious Unity')
    .replace(/^Challenges and Conflicts/gm, '## Challenges and Conflicts')
    
    // Fix malformed subsection headers
    .replace(/^Population Growth/gm, '### Population Growth')
    .replace(/^Trade Networks:/gm, '### Trade Networks')
    .replace(/^Military Reforms:/gm, '### Military Reforms')
    .replace(/^Oligarchy:/gm, '### Oligarchy')
    .replace(/^Tyranny:/gm, '### Tyranny')
    
    // Fix malformed references
    .replace(/References\s*\n\s*\[1\]/g, '\n## References\n\n[1]')
    .replace(/\[1\] Oxford University Press\. \(2012\)\. Oxford Classical Dictionary\. Oxford University Press\./g, 
             '[1] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.')
    .replace(/\[2\] Encyclopaedia Britannica\. \(2024\)\. Academic Edition\. Encyclopaedia Britannica, Inc\.\./g, 
             '[2] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc.')
    
    // Clean up any remaining single asterisks that are clearly meant to be bold
    .replace(/\*([A-Z][a-zA-Z]*)\b/g, '**$1**')
    
    // Remove any remaining malformed patterns
    .replace(/\*\*\*\*/g, '**')
    .replace(/\*\*\*\*\*/g, '**')
    .replace(/\*\*\*\*\*\*/g, '**');

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
    
    // Fix specific malformed bold patterns found in the content
    .replace(/\bPolis\*/g, '**Polis**')
    .replace(/\bAcropolis\*/g, '**Acropolis**')
    .replace(/\bAgora\*/g, '**Agora**')
    .replace(/\bPoleis\*/g, '**Poleis**')
    .replace(/\*hoplite\b/g, '**hoplite**')
    .replace(/\*stasis\b/g, '**stasis**')
    .replace(/\*Gerousia\b/g, '**Gerousia**')
    .replace(/\bTyranny\*\*/g, '**Tyranny**')
    
    // Fix additional malformed patterns
    .replace(/\bChallenges and Conflicts\b/g, '## Challenges and Conflicts')
    .replace(/\bCultural and Religious Unity\b/g, '## Cultural and Religious Unity')
    .replace(/\bPolitical Evolution: From Kings to Citizens\b/g, '## Political Evolution: From Kings to Citizens')
    
    // Fix malformed references
    .replace(/References\s*\n\s*\[1\]/g, '\n## References\n\n[1]')
    .replace(/\[1\] Encyclopaedia Britannica\. \(2024\)\. Academic Edition\. Encyclopaedia Britannica, Inc\.\./g, 
             '[1] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc.')
    .replace(/\[2\] Oxford University Press\. \(2012\)\. Oxford Classical Dictionary\. Oxford University Press\./g, 
             '[2] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.');

  // Apply general fixes
  processedText = parseMalformedMarkdown(processedText);
  
  // Final cleanup for Greek City-States specific issues
  processedText = cleanupLeftoverSyntax(processedText);

  return processedText;
}

/**
 * New function specifically for Archaic Period content
 */
export function parseArchaicPeriodContent(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return rawText;
  }

  let processedText = rawText;

  // Specific fixes for Archaic Period content
  processedText = processedText
    // Fix malformed bold patterns with ** at the end
    .replace(/\bLyric Poetry\*\*/g, '**Lyric Poetry**')
    .replace(/\bOracle of Delphi\*\*/g, '**Oracle of Delphi**')
    .replace(/\bOlympic Games\*\*/g, '**Olympic Games**')
    .replace(/\bSappho\*\*/g, '**Sappho**')
    .replace(/\bHomer\*\*/g, '**Homer**')
    .replace(/\bPythia\*\*/g, '**Pythia**')
    .replace(/\bApollo\*\*/g, '**Apollo**')
    .replace(/\bMount Parnassus\*\*/g, '**Mount Parnassus**')
    .replace(/\bDelphi\*\*/g, '**Delphi**')
    .replace(/\bOlympia\*\*/g, '**Olympia**')
    .replace(/\bZeus\*\*/g, '**Zeus**')
    .replace(/\barete\*\*/g, '**arete**')
    .replace(/\bekecheiria\*\*/g, '**ekecheiria**')
    .replace(/\bstadion\*\*/g, '**stadion**')
    .replace(/\bpankration\*\*/g, '**pankration**')
    .replace(/\bagoge\*\*/g, '**agoge**')
    .replace(/\bgymnasia\*\*/g, '**gymnasia**')
    .replace(/\bSophocles\*\*/g, '**Sophocles**')
    .replace(/\bClassical Period\*\*/g, '**Classical Period**')
    .replace(/\bAthens\*\*/g, '**Athens**')
    .replace(/\bdemocracy\*\*/g, '**democracy**')
    
    // Fix patterns with single asterisk at the beginning
    .replace(/\*Lyric Poetry\b/g, '**Lyric Poetry**')
    .replace(/\*Oracle of Delphi\b/g, '**Oracle of Delphi**')
    .replace(/\*Olympic Games\b/g, '**Olympic Games**')
    .replace(/\*Sappho\b/g, '**Sappho**')
    .replace(/\*Homer\b/g, '**Homer**')
    .replace(/\*Pythia\b/g, '**Pythia**')
    .replace(/\*Apollo\b/g, '**Apollo**')
    .replace(/\*Mount Parnassus\b/g, '**Mount Parnassus**')
    .replace(/\*Delphi\b/g, '**Delphi**')
    .replace(/\*Olympia\b/g, '**Olympia**')
    .replace(/\*Zeus\b/g, '**Zeus**')
    .replace(/\*arete\b/g, '**arete**')
    .replace(/\*ekecheiria\b/g, '**ekecheiria**')
    .replace(/\*stadion\b/g, '**stadion**')
    .replace(/\*pankration\b/g, '**pankration**')
    .replace(/\*agoge\b/g, '**agoge**')
    .replace(/\*gymnasia\b/g, '**gymnasia**')
    .replace(/\*Sophocles\b/g, '**Sophocles**')
    .replace(/\*Classical Period\b/g, '**Classical Period**')
    .replace(/\*Athens\b/g, '**Athens**')
    .replace(/\*democracy\b/g, '**democracy**')
    
    // Fix patterns with single asterisk at the end
    .replace(/\bLyric Poetry\*/g, '**Lyric Poetry**')
    .replace(/\bOracle of Delphi\*/g, '**Oracle of Delphi**')
    .replace(/\bOlympic Games\*/g, '**Olympic Games**')
    .replace(/\bSappho\*/g, '**Sappho**')
    .replace(/\bHomer\*/g, '**Homer**')
    .replace(/\bPythia\*/g, '**Pythia**')
    .replace(/\bApollo\*/g, '**Apollo**')
    .replace(/\bMount Parnassus\*/g, '**Mount Parnassus**')
    .replace(/\bDelphi\*/g, '**Delphi**')
    .replace(/\bOlympia\*/g, '**Olympia**')
    .replace(/\bZeus\*/g, '**Zeus**')
    .replace(/\barete\*/g, '**arete**')
    .replace(/\bekecheiria\*/g, '**ekecheiria**')
    .replace(/\bstadion\*/g, '**stadion**')
    .replace(/\bpankration\*/g, '**pankration**')
    .replace(/\bagoge\*/g, '**agoge**')
    .replace(/\bgymnasia\*/g, '**gymnasia**')
    .replace(/\bSophocles\*/g, '**Sophocles**')
    .replace(/\bClassical Period\*/g, '**Classical Period**')
    .replace(/\bAthens\*/g, '**Athens**')
    .replace(/\bdemocracy\*/g, '**democracy**')
    
    // Fix the specific pattern at the end of the text
    .replace(/\*\*\.\*\*$/, '')
    
    // Fix malformed references
    .replace(/References\s*\n\s*\[1\]/g, '\n## References\n\n[1]')
    .replace(/\[1\] Oxford University Press\. \(2012\)\. Oxford Classical Dictionary\. Oxford University Press\./g, 
             '[1] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.')
    .replace(/\[2\] Encyclopaedia Britannica\. \(2024\)\. Academic Edition\. Encyclopaedia Britannica, Inc\.\./g, 
             '[2] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc.');

  // Apply general fixes
  processedText = parseMalformedMarkdown(processedText);
  
  // Final cleanup
  processedText = cleanupLeftoverSyntax(processedText);

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
