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
    
    // Add custom rule to ensure proper paragraph breaks
    this.md.renderer.rules.paragraph_open = function() {
      return '<p style="margin-top: 1.5rem; margin-bottom: 1.5rem; line-height: 1.8;">';
    };
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
      
      // Fix circa abbreviations and date ranges to prevent line breaks
      .replace(/\bc\.\s+/g, 'c. ') // Ensure proper spacing after circa
      .replace(/\(\s*c\.\s+/g, '(c. ') // Fix spacing in parentheses
      .replace(/\bc\.\s*(\d{4})/g, 'c. $1') // Fix circa with year
      .replace(/\bc\.\s*(\d{4})\s*–\s*(\d{4})/g, 'c. $1–$2') // Fix circa with date ranges
      .replace(/\bc\.\s*(\d{4})\s*-\s*(\d{4})/g, 'c. $1-$2') // Fix circa with date ranges (hyphen)
      .replace(/\bc\.\s*(\d{4})\s*BCE/g, 'c. $1 BCE') // Fix circa with BCE
      .replace(/\bc\.\s*(\d{4})\s*CE/g, 'c. $1 CE') // Fix circa with CE
      .replace(/\bc\.\s*(\d{4})\s*BC/g, 'c. $1 BC') // Fix circa with BC
      .replace(/\bc\.\s*(\d{4})\s*AD/g, 'c. $1 AD') // Fix circa with AD
      
      // Ensure proper paragraph structure by adding double newlines
      .replace(/\n\n---\n\n/g, '\n\n<hr>\n\n') // Convert markdown horizontal rules to HTML
      .replace(/\n\n/g, '\n\n') // Ensure double newlines for paragraph breaks
      .replace(/\n/g, '  \n') // Convert single newlines to markdown line breaks (two spaces + newline)
      
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

  // Remove in-text citations and ensure proper bibliography formatting
  removeInTextCitations(content) {
    if (!content) return content;
    
    let processedContent = content;
    
    // Split content into main content and references section
    const parts = processedContent.split(/## References/);
    let mainContent = parts[0];
    let referencesSection = parts.length > 1 ? '## References' + parts[1] : '';
    
    // Remove in-text citations from main content only
    mainContent = mainContent
      // Remove citations like [1], [2], [3], [4] from the main content
      .replace(/\[(\d+)\]/g, '')
      // Clean up any double spaces that might result from citation removal
      .replace(/\s{2,}/g, ' ')
      // Clean up any periods that might be left hanging
      .replace(/\.\s*\./g, '.')
      // Clean up any commas that might be left hanging
      .replace(/,\s*,/g, ',')
      // Clean up any spaces before punctuation
      .replace(/\s+([.,;:!?])/g, '$1')
      // Clean up any spaces after opening parentheses
      .replace(/\(\s+/g, '(')
      // Clean up any spaces before closing parentheses
      .replace(/\s+\)/g, ')');
    
    // Recombine content
    processedContent = referencesSection ? mainContent + '\n\n' + referencesSection : mainContent;
    
    // Ensure the References section is properly formatted
    if (processedContent.includes('## References')) {
      processedContent = processedContent
        // Ensure proper spacing after References header
        .replace(/## References\s*\[/g, '\n## References\n\n[')
        // Ensure each citation is on its own line
        .replace(/\]\.\s*\[(\d+)\]/g, '].\n\n[$1]')
        // Add proper line breaks between citations
        .replace(/\.\s*\[(\d+)\]/g, '.\n\n[$1]')
        // Clean up multiple line breaks
        .replace(/\n{3,}/g, '\n\n');
    }
    
    return processedContent;
  }

  // Post-process HTML to ensure proper paragraph structure
  postprocessHTML(html) {
    if (!html) return html;
    
    return html
      // Ensure proper spacing between paragraphs
      .replace(/<\/p>\s*<p>/g, '</p>\n\n<p>')
      // Ensure proper spacing after headers
      .replace(/<\/h([1-6])>\s*<p>/g, '</h$1>\n\n<p>')
      // Ensure proper spacing before headers
      .replace(/<\/p>\s*<h([1-6])>/g, '</p>\n\n<h$1>')
      // Ensure proper spacing around horizontal rules
      .replace(/<\/p>\s*<hr[^>]*>\s*<p>/g, '</p>\n\n<hr>\n\n<p>')
      // Clean up excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      // Ensure proper line breaks within paragraphs
      .replace(/(<p[^>]*>)([^<]+)(<\/p>)/g, (match, openTag, content, closeTag) => {
        // Add line breaks after sentences for better readability, but preserve circa abbreviations
        const formattedContent = content
          // First, temporarily protect circa abbreviations from line break insertion
          .replace(/\bc\.\s+(\d{4})/g, 'CIRCA_YEAR_$1')
          .replace(/\bc\.\s+(\d{4})\s*–\s*(\d{4})/g, 'CIRCA_RANGE_$1_$2')
          .replace(/\bc\.\s+(\d{4})\s*-\s*(\d{4})/g, 'CIRCA_RANGE_$1_$2')
          .replace(/\bc\.\s+(\d{4})\s+BCE/g, 'CIRCA_BCE_$1')
          .replace(/\bc\.\s+(\d{4})\s+CE/g, 'CIRCA_CE_$1')
          .replace(/\bc\.\s+(\d{4})\s+BC/g, 'CIRCA_BC_$1')
          .replace(/\bc\.\s+(\d{4})\s+AD/g, 'CIRCA_AD_$1')
          // Add line breaks after sentences (but not after circa)
          .replace(/([.!?])\s+/g, '$1<br><br>') // Add double line breaks after sentences
          .replace(/<br><br><br>/g, '<br><br>') // Clean up excessive breaks
          // Restore circa abbreviations
          .replace(/CIRCA_YEAR_(\d{4})/g, 'c. $1')
          .replace(/CIRCA_RANGE_(\d{4})_(\d{4})/g, 'c. $1–$2')
          .replace(/CIRCA_BCE_(\d{4})/g, 'c. $1 BCE')
          .replace(/CIRCA_CE_(\d{4})/g, 'c. $1 CE')
          .replace(/CIRCA_BC_(\d{4})/g, 'c. $1 BC')
          .replace(/CIRCA_AD_(\d{4})/g, 'c. $1 AD');
        return `${openTag}${formattedContent}${closeTag}`;
      })
      .trim();
  }

  // Sanitize fallback content when parsing fails
  sanitizeFallback(content) {
    if (!content) return '';
    
    return content
      .replace(/[<>]/g, '') // Remove any HTML tags
      .replace(/\n\n+/g, '\n\n') // Normalize line breaks
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.trim()}</p>`)
      .join('\n\n');
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
