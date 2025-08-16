// Test file for improved markdown parsing
const fixMalformedMarkdown = (text) => {
  if (!text) return text;
  
  let fixed = text;
  
  // Step 1: Fix patterns where bold formatting includes punctuation incorrectly
  fixed = fixed.replace(/\*\*([^*]+?)([.,;:])\*\*/g, '**$1**$2');
  
  // Step 2: Fix patterns where italic formatting includes punctuation incorrectly
  fixed = fixed.replace(/\*([^*]+?)([.,;:])\*/g, '*$1*$2');
  
  // Step 3: Fix patterns where bold formatting has exactly 3 asterisks at the end
  fixed = fixed.replace(/\*\*([^*]+)\*\*\*/g, '**$1**');
  
  // Step 4: Fix patterns where italic formatting has exactly 2 asterisks at the end
  fixed = fixed.replace(/\*([^*]+)\*\*/g, '*$1*');
  
  // Step 5: Fix patterns where bold formatting is broken by spaces
  fixed = fixed.replace(/\*\*([^*\s]+)\s+\*\*/g, '**$1**');
  
  // Step 6: Fix patterns where italic formatting is broken by spaces
  fixed = fixed.replace(/\*([^*\s]+)\s+\*/g, '*$1*');
  
  // Step 7: Fix multiple consecutive asterisks that are clearly malformed (4+ asterisks)
  fixed = fixed.replace(/\*\*\*\*\*/g, '**');
  fixed = fixed.replace(/\*\*\*\*/g, '**');
  
  // Step 8: Fix unclosed bold formatting at the very end of text
  fixed = fixed.replace(/\*\*([^*]+)$/g, '**$1**');
  
  // Step 9: Fix unclosed italic formatting at the very end of text
  fixed = fixed.replace(/\*([^*]+)$/g, '*$1*');
  
  // Step 10: Fix specific patterns found in the problematic text
  fixed = fixed.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\*\*/g, '**$1**');
  
  // Step 11: Fix patterns where bold formatting spans across line breaks
  fixed = fixed.replace(/\*\*([^*\n]+)\n([^*\n]+)\*\*/g, '**$1 $2**');
  
  // Step 12: Fix patterns where words have comma and asterisks
  fixed = fixed.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\*\*/g, '**$1**,');
  
  // Step 13: Fix patterns where words have single asterisks but no opening/closing
  fixed = fixed.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\*/g, '**$1**');
  
  // Step 14: Fix patterns where words have single asterisks at the beginning
  fixed = fixed.replace(/\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, '**$1**');
  
  // Step 15: Fix patterns where words have single asterisks in the middle of text
  fixed = fixed.replace(/(\s)\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(\s)/g, '$1**$2**$3');
  
  // Step 16: Fix patterns where words have single asterisks followed by punctuation
  fixed = fixed.replace(/\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)([.,;:])/g, '**$1**$2');
  
  // Step 17: Fix patterns where words have single asterisks at the end of sentences
  fixed = fixed.replace(/\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\./g, '**$1**.');
  
  // Step 18: Fix the specific pattern at the end of the text
  fixed = fixed.replace(/\*\.\*$/g, '**');
  
  // Step 19: Fix patterns where words have single asterisks followed by spaces and more text
  fixed = fixed.replace(/\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s/g, '**$1** ');
  
  // Step 20: Fix patterns where words have single asterisks in parentheses or brackets
  fixed = fixed.replace(/\(\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\)/g, '(**$1**)');
  
  // Step 21: Fix patterns where words have single asterisks in numbered lists
  fixed = fixed.replace(/(\d+\.\s*)\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, '$1**$2**');
  
  // Step 22: Fix patterns where words have single asterisks in bullet points
  fixed = fixed.replace(/([-•]\s*)\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, '$1**$2**');
  
  // Step 23: Fix patterns where words have single asterisks in section headers
  fixed = fixed.replace(/(#{1,6}\s*)\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, '$1**$2**');
  
  // Step 24: Fix any remaining single asterisks that should be bold
  fixed = fixed.replace(/\*([^*]+)\*/g, '**$1**');
  
  return fixed;
};

// Test the problematic text
const problematicText = `The Formation of the Greek City-States: How did scattered settlements become the cradle of democracy, philosophy, and Western civilization? This lesson explores the birth of the Polis—the independent city-state that defined ancient Greece—during the Archaic Period (800–480 BCE), examining the social, geographic, and political forces that shaped its rise and the emergence of governance systems like Oligarchy and Tyranny. By the end, you'll understand why these small but mighty communities became the building blocks of Greek identity.

The Archaic Period marked a transformative era in Greek history, as the collapse of the Mycenaean palaces (c. 1100 BCE) gave way to a "Dark Age" of decentralization. By 800 BCE, a resurgence of trade, population growth, and cultural exchange—fueled by contacts with Phoenicia and Egypt—sparked the formation of the Polis (plural: Poleis), the fundamental political and social unit of ancient Greece. Unlike earlier kingdoms or empires, a *Polis was a self-governing community centered on an urban hub, typically fortified and surrounded by agricultural land. Its independence was fierce: each *Polis had its own laws, gods, and identity, often clashing with neighbors over resources or prestige.

*Geography and the Birth of the *Polis The rugged terrain of Greece—mountains, islands, and isolated valleys—played a crucial role in the fragmentation of power. With limited arable land, communities clustered around defensible high points, known as the *Acropolis (literally "high city"). The *Acropolis served as both a religious sanctuary (housing temples to patron deities like Athena in Athens) and a last-resort fortress during conflicts. Below it lay the *Agora, the bustling public square where citizens gathered for trade, political debates, and legal proceedings. The *Agora was the heartbeat of the *Polis, symbolizing the shift from tribal loyalty to civic participation.

*Social and *Economic Foundations The *Polis emerged alongside three key developments: 1. *Population Growth: Increased food production (thanks to iron tools) and colonization (e.g., settlements in southern Italy and Asia Minor) eased pressure on limited land. 2. *Trade Networks: Greek merchants exchanged pottery, olive oil, and wine for metals and grains, enriching coastal *Poleis like Corinth and Miletus. 3. *Military Reforms: The rise of the hoplite—a heavily armored foot soldier—created a citizen army. Since hoplites provided their own equipment, wealthier farmers gained political leverage, demanding rights in exchange for military service.

*Political Evolution: From Kings to *Citizens Early *Poleis were ruled by hereditary kings or aristocratic councils, but by the 7th century BCE, power struggles led to new systems: - *Oligarchy: A government by a small group of elite citizens (often landowners or wealthy merchants). Sparta's dual kingship and council of elders (Gerousia) exemplified this, though its rigid social hierarchy (including enslaved helots) made it an outlier.

*Tyranny: Not inherently cruel as the modern term suggests, a *Tyranny was rule by a single leader (tyrant) who seized power illegally but often with popular support. Tyrants like Peisistratos in Athens (6th century BCE) redistributed land, funded public works, and promoted culture, undermining aristocratic dominance. While some tyrants became oppressive, many laid groundwork for later democratic reforms.
*Cultural and *Religious Unity Despite their political independence, *Poleis shared a common Greek identity through language, religion, and pan-Hellenic festivals like the Olympic Games. Sanctuaries such as Delphi and Olympia became neutral grounds where rival *Poleis could compete peacefully. This cultural cohesion would later enable united action against external threats, like the Persian Wars (490–479 BCE).

*Challenges and *Conflicts The rise of the Polis was not without strife. Class tensions between aristocrats and commoners (demos) led to stasis (civil conflict), while territorial disputes sparked wars like the Lelantine War (8th century BCE) between Chalcis and Eretria. These struggles, however, also drove innovation: laws were codified (e.g., Draco's harsh legal code in Athens), and political experiments like Solon's reforms (594 BCE) attempted to balance power between classes.

The Polis was more than a city—it was a revolutionary concept that prioritized civic participation, collective defense, and cultural expression. From the fortified Acropolis to the lively Agora, these city-states fostered systems like Oligarchy and Tyranny that, while flawed, set the stage for democracy's eventual emergence. As we move forward, we'll see how the Persian Wars tested the resilience of the Poleis and how Athens' radical experiment in democracy would redefine the limits of citizen power. Could these small, squabbling communities unite when faced with an existential threat? The answer would shape the course of Western history*.*`;

console.log('=== ORIGINAL TEXT ===');
console.log(problematicText.substring(0, 500) + '...');
console.log('\n=== FIXED TEXT ===');
const fixedText = fixMalformedMarkdown(problematicText);
console.log(fixedText.substring(0, 500) + '...');

// Check for specific patterns that should be fixed
const patternsToCheck = [
  '*Polis',
  '*Acropolis', 
  '*Agora',
  '*Poleis',
  '*Citizens',
  '*Tyranny',
  '*Cultural',
  '*Religious',
  '*Challenges',
  '*Conflicts',
  '*.*'
];

console.log('\n=== PATTERN CHECK ===');
patternsToCheck.forEach(pattern => {
  const originalCount = (problematicText.match(new RegExp(pattern.replace(/\*/g, '\\*'), 'g')) || []).length;
  const fixedCount = (fixedText.match(new RegExp(pattern.replace(/\*/g, '\\*'), 'g')) || []).length;
  const boldPattern = pattern.replace(/\*/g, '\\*\\*');
  const boldCount = (fixedText.match(new RegExp(boldPattern, 'g')) || []).length;
  
  console.log(`${pattern}: Original=${originalCount}, Fixed=${fixedCount}, Bold=${boldCount}`);
});

console.log('\n=== VERIFICATION ===');
console.log('All single asterisk patterns should be converted to bold (**pattern**):');
const singleAsteriskPatterns = fixedText.match(/\*[^*]+\*/g);
if (singleAsteriskPatterns) {
  console.log('Remaining single asterisk patterns:', singleAsteriskPatterns);
} else {
  console.log('✅ No remaining single asterisk patterns found!');
}
