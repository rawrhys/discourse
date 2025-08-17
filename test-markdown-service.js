import markdownService from './src/services/MarkdownService.js';

// Test the problematic text from the user
const problematicText = `The Formation of the Greek City-States
How did scattered settlements become the cradle of democracy, philosophy, and Western civilization? This lesson explores the birth of the Polis—the independent city-state that defined ancient Greece—during the Archaic Period (800–480 BCE), examining the social, geographic, and political forces that shaped its rise and the emergence of governance systems like Oligarchy and Tyranny
By the end, you'll understand why these small but mighty communities became the building blocks of Greek identity.

The Archaic Period marked a transformative era in Greek history, as the collapse of the Mycenaean palaces (c. 1100 BCE) gave way to a "Dark Age" of decentralization. By 800 BCE, a resurgence of trade, population growth, and cultural exchange—fueled by contacts with Phoenicia and Egypt—sparked the formation of the Polis (plural Unlike earlier kingdoms or empires, a Polis was a self-governing community centered on an urban hub, typically fortified and surrounded by agricultural land. Its independence was fierce
**## Geography and the Birth of the **Polis

The rugged terrain of Greece—mountains, islands, and isolated valleys—played a crucial role in the fragmentation of power. With limited arable land, communities clustered around defensible high points, known as the Acropolis (literally "high city"). The Acropolis served as both a religious sanctuary (housing temples to patron deities like Athena in Athens) and a last-resort fortress during conflicts. Below it lay the Agora, the bustling public square where citizens gathered for trade, political debates, and legal proceedings. The Agora was the heartbeat of the Polis, symbolizing the shift from tribal loyalty to civic participation.
Social and Economic Foundations** The Polis emerged alongside three key developments Population Growth: Increased food production (thanks to iron tools) and colonization (e.g., settlements in southern Italy and Asia Minor) eased pressure on limited land.* 2. Trade Networks: Greek merchants exchanged pottery, olive oil, and wine for metals and grains, enriching coastal Poleis like Corinth and Miletus.** 3. Military Reforms: The rise of the hoplite—a heavily armored foot soldier—created a citizen army. Since hoplites provided their own equipment, wealthier farmers gained political leverage, demanding rights in exchange for military service.

*## Political Evolution: From Kings to Citizens

# Early Poleis were ruled by hereditary kings or aristocratic councils, but by the 7th century BCE, power struggles led to new systems Sparta's dual kingship and council of elders (Gerousia) exemplified this, though its rigid social hierarchy (including enslaved helots) made it an outlier.**

Tyranny: Not inherently cruel as the modern term suggests, a Tyranny was rule by a single leader (tyrant) who seized power illegally but often with popular support. Tyrants like Peisistratos in Athens (6th century BCE) redistributed land, funded public works, and promoted culture, undermining aristocratic dominance. While some tyrants became oppressive, many laid groundwork for later democratic reforms.
*## Cultural and Religious Unity

# Despite their political independence, Poleis shared a common Greek identity through language, religion, and pan-Hellenic festivals like the Olympic Games. Sanctuaries such as Delphi and Olympia became neutral grounds where rival Poleis** could compete peacefully. This cultural cohesion would later enable united action against external threats, like the Persian Wars (490–479 BCE).**

## Challenges and Conflicts
*The rise of the Polis was not without strife. Class tensions between aristocrats and commoners (demos) led to stasis (civil conflict), while territorial disputes sparked wars like the Lelantine War (8th century BCE) between Chalcis and Eretria. These struggles, however, also drove innovationg., Draco's harsh legal code in Athens), and political experiments like Solon's reforms (594 BCE) attempted to balance power between classes.

The Polis was more than a city—it was a revolutionary concept that prioritized civic participation, collective defense, and cultural expression. From the fortified Acropolis to the lively Agora, these city-states fostered systems like Oligarchy and Tyranny that, while flawed, set the stage for democracy's eventual emergence. As we move forward, we'll see how the Persian Wars tested the resilience of the Poleis* and how Athens' radical experiment in democracy would redefine the limits of citizen power. Could these small, squabbling communities unite when faced with an existential threat? The answer would shape the course of Western history.**

References
[1] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc..

[2] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.`;

console.log('=== Testing MarkdownService ===\n');

// Test the general parser
console.log('1. Testing general parser:');
const startTime = performance.now();
const generalResult = markdownService.parse(problematicText);
const endTime = performance.now();
console.log(`Performance: ${(endTime - startTime).toFixed(2)}ms`);
console.log('Result:', generalResult.substring(0, 500) + '...\n');

// Test the Greek City-States parser
console.log('2. Testing Greek City-States parser:');
const startTime2 = performance.now();
const greekResult = markdownService.parseGreekCityStates(problematicText);
const endTime2 = performance.now();
console.log(`Performance: ${(endTime2 - startTime2).toFixed(2)}ms`);
console.log('Result:', greekResult.substring(0, 500) + '...\n');

// Test the Greek content parser
console.log('3. Testing Greek content parser:');
const startTime3 = performance.now();
const greekContentResult = markdownService.parseGreekContent(problematicText);
const endTime3 = performance.now();
console.log(`Performance: ${(endTime3 - startTime3).toFixed(2)}ms`);
console.log('Result:', greekContentResult.substring(0, 500) + '...\n');

// Check for remaining malformed asterisks
console.log('4. Checking for remaining malformed asterisks:');
const remainingAsterisks = (greekResult.match(/\*\*/g) || []).length;
console.log(`Remaining ** patterns: ${remainingAsterisks}`);

// Check for specific problematic patterns
const problematicPatterns = [
  /Polis\*\*/g,
  /Acropolis\*\*/g,
  /Agora\*\*/g,
  /Poleis\*\*/g,
  /Tyranny\*\*/g,
  /Oligarchy\*\*/g,
  /hoplite\*\*/g,
  /stasis\*\*/g,
  /Gerousia\*\*/g,
  /Phoenicia\*\*/g,
  /Egypt\*\*/g,
  /Corinth\*\*/g,
  /Miletus\*\*/g,
  /Chalcis\*\*/g,
  /Eretria\*\*/g,
  /Lelantine War\*\*/g,
  /Draco\*\*/g,
  /Solon\*\*/g,
  /Peisistratos\*\*/g,
  /Lesbos\*\*/g,
  /symposia\*\*/g,
  /helots\*\*/g,
  /demos\*\*/g,
  /Persian Wars\*\*/g,
  /Mycenaean palaces\*\*/g
];

console.log('\n5. Checking for specific problematic patterns:');
problematicPatterns.forEach(pattern => {
  const matches = greekResult.match(pattern);
  if (matches) {
    console.log(`❌ Found problematic pattern: ${pattern.source} (${matches.length} occurrences)`);
  } else {
    console.log(`✅ No problematic pattern: ${pattern.source}`);
  }
});

// Get performance metrics
console.log('\n6. Performance metrics:');
console.log(markdownService.getPerformanceMetrics());

console.log('\n=== Test Complete ===');
