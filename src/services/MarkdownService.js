import MarkdownIt from 'markdown-it';

class MarkdownService {
  constructor() {
    // Configure markdown-it for better malformed markdown handling
    this.md = new MarkdownIt({
      html: true,        // Enable HTML tags in source
      xhtmlOut: false,   // Use '/' to close single tags (<br />)
      breaks: true,      // Convert '\n' in paragraphs into <br>
      langPrefix: 'language-', // CSS language prefix for fenced blocks
      linkify: true,     // Autoconvert URL-like text to links
      typographer: true, // Enable some language-neutral replacement + quotes beautification
    });

    // Enable GitHub Flavored Markdown
    this.md.enable(['table', 'strikethrough', 'autolink']);
  }

  // Main parsing function with pre-processing
  parse(content, options = {}) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    try {
      // Pre-process content to fix common malformed patterns
      let processedContent = this.preprocessContent(content);
      
      // Parse with markdown-it
      const html = this.md.render(processedContent);
      
      // Post-process HTML to clean up any remaining issues
      return this.postprocessHTML(html);
    } catch (error) {
      console.warn('[MarkdownService] Parsing error:', error);
      // Return sanitized content as fallback
      return this.sanitizeFallback(content);
    }
  }

  // Pre-process content to fix malformed patterns
  preprocessContent(content) {
    return content
      // Remove any separator patterns first
      .replace(/\|\|\|---\|\|\|/g, '') // Remove |||---||| patterns
      .replace(/\|\|\|/g, '') // Remove all remaining ||| patterns
      
      // Fix malformed headers (more conservative)
      .replace(/^\*\*##\s*/gm, '## ')  // Fix malformed headers
      .replace(/^\*##\s*/gm, '## ')    // Fix malformed headers
      .replace(/^##\s*\*\*/gm, '## ')  // Fix malformed headers
      
      // Fix malformed list items
      .replace(/^([^*]+?)\*\s*$/gm, '- $1')  // Fix list items with asterisks
      .replace(/^([^*]+?)\*\*\s*$/gm, '- $1') // Fix list items with double asterisks
      
      // Fix specific Greek content patterns (only for known terms)
      .replace(/\bPolis\*\*/g, '**Polis**')
      .replace(/\bAcropolis\*\*/g, '**Acropolis**')
      .replace(/\bAgora\*\*/g, '**Agora**')
      .replace(/\bPoleis\*\*/g, '**Poleis**')
      .replace(/\bTyranny\*\*/g, '**Tyranny**')
      .replace(/\bOligarchy\*\*/g, '**Oligarchy**')
      .replace(/\bhoplite\*\*/g, '**hoplite**')
      .replace(/\bstasis\*\*/g, '**stasis**')
      .replace(/\bGerousia\*\*/g, '**Gerousia**')
      
      // Fix patterns with single asterisk (only for known terms)
      .replace(/\*Polis\b/g, '**Polis**')
      .replace(/\*Acropolis\b/g, '**Acropolis**')
      .replace(/\*Agora\b/g, '**Agora**')
      .replace(/\*Poleis\b/g, '**Poleis**')
      .replace(/\*Tyranny\b/g, '**Tyranny**')
      .replace(/\*Oligarchy\b/g, '**Oligarchy**')
      .replace(/\*hoplite\b/g, '**hoplite**')
      .replace(/\*stasis\b/g, '**stasis**')
      .replace(/\*Gerousia\b/g, '**Gerousia**')
      
      // Fix patterns with asterisk at end (only for known terms)
      .replace(/\bPolis\*/g, '**Polis**')
      .replace(/\bAcropolis\*/g, '**Acropolis**')
      .replace(/\bAgora\*/g, '**Agora**')
      .replace(/\bPoleis\*/g, '**Poleis**')
      .replace(/\bTyranny\*/g, '**Tyranny**')
      .replace(/\bOligarchy\*/g, '**Oligarchy**')
      .replace(/\bhoplite\*/g, '**hoplite**')
      .replace(/\bstasis\*/g, '**stasis**')
      .replace(/\bGerousia\*/g, '**Gerousia**')
      
      // Fix references-specific patterns
      .replace(/\*Academic Edition\*/g, '*Academic Edition*')
      .replace(/\*Oxford Classical Dictionary\*/g, '*Oxford Classical Dictionary*')
      .replace(/\*Encyclopaedia Britannica\*/g, '*Encyclopaedia Britannica*')
      .replace(/\*Oxford University Press\*/g, '*Oxford University Press*')
      
      // Clean up multiple consecutive asterisks
      .replace(/\*\*\*\*/g, '**')
      .replace(/\*\*\*\*\*/g, '**')
      .replace(/\*\*\*\*\*\*/g, '**')
      
      // Final separator cleanup
      .replace(/\|\|\|---\|\|\|/g, '')
      .replace(/\|\|\|/g, '');
  }

  // Post-process HTML to clean up any remaining issues
  postprocessHTML(html) {
    return html
      // Remove any remaining malformed patterns
      .replace(/<strong>\s*<\/strong>/g, '')  // Remove empty strong tags
      .replace(/<em>\s*<\/em>/g, '')          // Remove empty em tags
      .replace(/<p>\s*<\/p>/g, '')            // Remove empty p tags
      .replace(/<li>\s*<\/li>/g, '')          // Remove empty li tags
      
      // Remove any separator patterns that might have been converted to HTML
      .replace(/\|\|\|---\|\|\|/g, '')        // Remove |||---||| patterns
      .replace(/\|\|\|/g, '')                 // Remove all remaining ||| patterns
      
      // Fix any malformed HTML
      .replace(/<([^>]+)\s*\/>/g, '<$1 />')   // Fix self-closing tags
      .replace(/\s+/g, ' ')                   // Normalize whitespace
      .trim();
  }

  // Fallback sanitization for when parsing fails
  sanitizeFallback(content) {
    return content
      .replace(/[<>]/g, '')  // Remove HTML tags
      .replace(/\*\*/g, '')  // Remove asterisks
      .replace(/\*/g, '')    // Remove single asterisks
      .replace(/\n{3,}/g, '\n\n')  // Normalize line breaks
      .trim();
  }

  // Parse content for specific content types
  parseGreekContent(content) {
    if (!content) return '';
    
    // Apply Greek-specific preprocessing
    let processedContent = content
      // Add Greek-specific patterns
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
      .replace(/\bdemocracy\*\*/g, '**democracy**');
    
    return this.parse(processedContent);
  }

  // Parse content for Greek City-States specifically
  parseGreekCityStates(content) {
    if (!content) return '';
    
    // Apply Greek City-States specific preprocessing
    let processedContent = content
      // Add additional Greek City-States patterns
      .replace(/\bPhoenicia\*\*/g, '**Phoenicia**')
      .replace(/\bEgypt\*\*/g, '**Egypt**')
      .replace(/\bCorinth\*\*/g, '**Corinth**')
      .replace(/\bMiletus\*\*/g, '**Miletus**')
      .replace(/\bChalcis\*\*/g, '**Chalcis**')
      .replace(/\bEretria\*\*/g, '**Eretria**')
      .replace(/\bLelantine War\*\*/g, '**Lelantine War**')
      .replace(/\bDraco\*\*/g, '**Draco**')
      .replace(/\bSolon\*\*/g, '**Solon**')
      .replace(/\bPeisistratos\*\*/g, '**Peisistratos**')
      .replace(/\bLesbos\*\*/g, '**Lesbos**')
      .replace(/\bsymposia\*\*/g, '**symposia**')
      .replace(/\bhelots\*\*/g, '**helots**')
      .replace(/\bdemos\*\*/g, '**demos**')
      .replace(/\bPersian Wars\*\*/g, '**Persian Wars**')
      .replace(/\bMycenaean palaces\*\*/g, '**Mycenaean palaces**');
    
    return this.parse(processedContent);
  }

  // Parse content with bibliography support
  parseWithBibliography(content) {
    if (!content) return '';
    
    // First, handle the specific problematic pattern
    let processedContent = content;
    
    // Fix the specific pattern: "## References [1] Encyclopaedia Britannica. (2024). *Academic Edition*. Encyclopaedia Britannica, Inc.. [2] Oxford University Press. (2012). *Oxford Classical Dictionary*. Oxford University Press."
    if (processedContent.includes('## References [')) {
      processedContent = processedContent
        // Replace the problematic pattern with proper formatting
        .replace(/## References\s*\[(\d+)\]/g, '\n## References\n\n[$1]')
        // Ensure each citation is on its own line
        .replace(/\]\s*\[(\d+)\]/g, '.\n\n[$1]')
        // Add proper line breaks between citations
        .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
        // Handle the specific pattern with inline citations
        .replace(/## References\s*\[(\d+)\]\s*([^[]+?)\s*\[(\d+)\]/g, '\n## References\n\n[$1] $2\n\n[$3]')
        // Ensure proper spacing after periods before citations
        .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
        // Handle multiple citations on the same line
        .replace(/\]\.\s*\[(\d+)\]/g, '].\n\n[$1]');
    }
    
    // Handle other bibliography patterns
    processedContent = processedContent
      // Fix "References [1]" pattern (without ##)
      .replace(/^References\s*\[(\d+)\]/gm, '\n## References\n\n[$1]')
      // Fix "## References\n[1]" pattern
      .replace(/## References\s*\n\s*\[(\d+)\]/g, '\n## References\n\n[$1]')
      // Ensure proper spacing after References header
      .replace(/## References\s*\[/g, '\n## References\n\n[')
      // Add line breaks between citations
      .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
      // Clean up any remaining issues
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
      // Remove any duplicate References headers
      .replace(/(## References\s*\n)+/g, '\n## References\n\n');
    
    // Additional fix: Ensure citations are properly separated into paragraphs
    processedContent = processedContent
      // First, ensure proper spacing after References header
      .replace(/## References\n\n\[(\d+)\]/g, '## References\n\n<p>[$1]')
      // Split citations that are running together and wrap each in paragraph tags
      .replace(/\]\.\s*\[(\d+)\]/g, '].</p>\n\n<p>[$1]')
      // Ensure each citation starts with proper paragraph tag (but not if already wrapped)
      .replace(/(?<!<p>)\n\[(\d+)\]/g, '\n\n<p>[$1]')
      // Close any open paragraph at the end
      .replace(/([^>])\s*$/, '$1</p>');
    
    return this.parse(processedContent);
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      parser: 'markdown-it',
      version: this.md.version,
      features: ['gfm', 'breaks', 'linkify', 'typographer'],
      malformedHandling: true,
      errorRecovery: true
    };
  }
}

// Create singleton instance
const markdownService = new MarkdownService();

export default markdownService;
