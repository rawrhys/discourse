import markdownService from '../services/MarkdownService.js';

// Test content with in-text citations (exactly as provided by user)
const testContent = `The Early Dynastic Period (c. [1] 3100–2686 BCE) bridges the gap between Egypt's prehistoric era and the Old Kingdom, a time when the foundations of pharaonic civilization were firmly established. At its heart lies the story of unification—a process both political and cultural—that merged the two distinct regions of Upper Egypt (the southern, narrow valley stretching from Aswan to modern-day Cairo) and Lower Egypt (the northern, fan-shaped Delta where the Nile splits into multiple branches). These regions had developed separately for centuries, each with its own customs, deities, and symbols: Upper Egypt's white crown (the Hedjet) and Lower Egypt's red crown (the Deshret) would later become potent emblems of dual kingship.

The traditional narrative credits Narmer, a ruler from the southern city of Thinis, with achieving this unification around 3100 BCE. While historical records from this era are sparse, the most compelling evidence comes from the Palette of Narmer, a ceremonial slate palette discovered in 1898 at Hierakonpolis. This intricately carved artifact—likely used for grinding cosmetics—serves as both a historical document and a piece of propaganda. [2] On one side, Narmer is depicted wearing the red crown of Lower Egypt, smiting an enemy with a mace, while the other side shows him in the white crown of Upper Egypt, inspecting decapitated foes. The palette's imagery, including the intertwined necks of two mythical beasts (possibly representing the united lands), suggests a violent but decisive conquest. [3] Scholars debate whether unification was a single event or a gradual process, but the Palette of Narmer remains a defining symbol of Egypt's birth as a nation.

With unification came the rise of the pharaoh, a term derived from the Egyptian per-aa ("great house"), originally referring to the royal palace but later personifying the king himself. The pharaoh was not merely a political leader but a divine intermediary, believed to be the son of the sun god Ra. This sacred status justified absolute authority and the centralized administration needed to manage a newly unified state. The Early Dynastic Period saw the establishment of the first two dynasties (the 0th and 1st, though numbering varies among scholars), with pharaohs like Narmer, Aha, and Djer consolidating power through military campaigns, trade networks, and monumental architecture—most notably the early tombs at Abydos and Saqqara, precursors to the pyramids.

Administration and record-keeping were critical to maintaining control over the unified kingdom. [4] This era witnessed the full development of hieroglyphs, the sacred script of ancient Egypt. Initially used for labels on pottery and seals, hieroglyphs evolved into a complex system of over 700 symbols representing sounds, words, and ideas. The Narmer palette itself features some of the earliest known hieroglyphs, including the names of gods and the king, as well as symbols for victory and subjugation. The invention of writing enabled the bureaucracy to track taxes, labor, and resources, while also immortalizing the pharaoh's deeds in temple and tomb inscriptions.

Religious and cultural syncretism also played a role in solidifying unity. Gods from Upper Egypt and Lower Egypt were merged or given new significance; for example, the cobra goddess Wadjet of the Delta and the vulture goddess Nekhbet of the south became joint protectors of the pharaoh. The concept of Maat—cosmic order and justice—emerged as a guiding principle, reinforcing the idea that the pharaoh's rule was essential to Egypt's stability. By the end of the Early Dynastic Period, the stage was set for the Old Kingdom, an age of pyramid-building and unparalleled centralized power.

## References [1] Encyclopaedia Britannica. (2024). *Academic Edition*. Encyclopaedia Britannica, Inc.. [2] Oxford University Press. (2012). *Oxford Classical Dictionary*. Oxford University Press. [3] Cambridge University Press. (2018). *The Cambridge Ancient History*. Cambridge University Press. [4] Routledge. (2015). *The Routledge Handbook of Ancient Egypt*. Routledge.`;

// Test the citation removal functionality
export function testCitationRemoval() {
  console.log('=== Testing Citation Removal ===');
  
  console.log('\n--- Original Content (first 200 chars) ---');
  console.log(`${testContent.substring(0, 200)}...`);
  
  console.log('\n--- After Citation Removal ---');
  const cleanedContent = markdownService.removeInTextCitations(testContent);
  console.log(`${cleanedContent.substring(0, 200)}...`);
  
  console.log('\n--- Checking for Remaining Citations ---');
  const remainingCitations = (cleanedContent.match(/\[(\d+)\]/g) || []);
  console.log('Remaining citations in main content:', remainingCitations);
  
  console.log('\n--- References Section ---');
  const referencesMatch = cleanedContent.match(/## References[\s\S]*$/);
  if (referencesMatch) {
    console.log(referencesMatch[0]);
  } else {
    console.log('No References section found');
  }
  
  console.log('\n--- Final Parsed Content (first 300 chars) ---');
  const finalContent = markdownService.parseWithBibliography(cleanedContent);
  console.log(`${finalContent.substring(0, 300)}...`);
  
  return {
    original: testContent,
    cleaned: cleanedContent,
    final: finalContent,
    remainingCitations: remainingCitations
  };
}

// Run test if this file is executed directly
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  testCitationRemoval();
}
