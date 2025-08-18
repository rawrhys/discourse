// Test utility for references functionality
import markdownService from '../services/MarkdownService.js';

// Test the specific format mentioned in the user query
export const testReferencesFormat = () => {
  const testContent = `Some lesson content here.

## References [1] Encyclopaedia Britannica. (2024). *Academic Edition*. Encyclopaedia Britannica, Inc.. [2] Oxford University Press. (2012). *Oxford Classical Dictionary*. Oxford University Press.`;

  console.log('=== Testing References Format ===');
  console.log('Original content:', testContent);
  
  // Test markdown parsing
  const parsedContent = markdownService.parseWithBibliography(testContent);
  console.log('Parsed content:', parsedContent);
  
  // Test references extraction (simplified version)
  const refMatch = testContent.match(/## References\s*([\s\S]*?)(?=\n## |\n# |$)/i);
  if (refMatch) {
    const referencesText = refMatch[1].trim();
    console.log('Extracted references text:', referencesText);
    
    // Parse individual references
    const refLines = referencesText.split(/\n+/).filter(line => line.trim());
    const references = [];
    
    refLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // Look for numbered references like [1], [2], etc.
        const numberedMatch = trimmedLine.match(/^\[(\d+)\]\s*(.+)$/);
        if (numberedMatch) {
          references.push({
            number: numberedMatch[1],
            citation: numberedMatch[2].trim()
          });
        } else {
          // Look for patterns like "## References [1] Encyclopaedia Britannica..."
          const inlineMatch = trimmedLine.match(/\[(\d+)\]\s*(.+)$/);
          if (inlineMatch) {
            references.push({
              number: inlineMatch[1],
              citation: inlineMatch[2].trim()
            });
          }
        }
      }
    });
    
    console.log('Extracted references:', references);
  }
  
  return {
    original: testContent,
    parsed: parsedContent,
    hasReferences: testContent.includes('## References')
  };
};

// Test bibliography formatting
export const testBibliographyFormatting = () => {
  const bibliography = [
    {
      author: 'Encyclopaedia Britannica',
      year: '2024',
      title: 'Academic Edition',
      publisher: 'Encyclopaedia Britannica, Inc.'
    },
    {
      author: 'Oxford University Press',
      year: '2012',
      title: 'Oxford Classical Dictionary',
      publisher: 'Oxford University Press'
    }
  ];
  
  console.log('=== Testing Bibliography Formatting ===');
  console.log('Bibliography:', bibliography);
  
  // Simulate the formatBibliographyAsMarkdown function
  let markdown = '\n\n## References\n\n';
  
  bibliography.forEach((ref, index) => {
    const citationNumber = index + 1;
    const citation = `[${citationNumber}] ${ref.author}. (${ref.year}). *${ref.title}*. ${ref.publisher}.`;
    markdown += citation + '\n\n';
  });
  
  console.log('Formatted markdown:', markdown);
  
  return markdown;
};

// Run tests if in development
if (process.env.NODE_ENV === 'development') {
  console.log('Running references tests...');
  testReferencesFormat();
  testBibliographyFormatting();
}
