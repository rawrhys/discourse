import { parseArchaicPeriodContent, parseMalformedMarkdown } from './src/utils/markdownParser.js';

// Test the problematic text from the user
const problematicText = `The Archaic Period (c. 800–480 BCE) was a transformative era in ancient Greece, marked by the rise of the polis (city-state) and a flourishing of cultural and intellectual achievements that laid the foundation for later Greek civilization. This lesson explores how innovations in literature, religion, and athletics—from the emotional depth of Lyric Poetry** to the sacred authority of the Oracle of Delphi**—reflected and shaped the values of a society in transition. By examining figures like Sappho and Homer, as well as institutions like the Olympic Games**, we'll uncover how these developments fostered a shared Greek identity while celebrating individual expression.**

The Archaic Period witnessed a remarkable burst of creativity and intellectual exploration as Greeks grappled with political fragmentation, colonization, and the emergence of the polis. These changes were mirrored in cultural productions that blended tradition with innovation, leaving a lasting legacy on Western civilization.

One of the most significant literary developments was the rise of Lyric Poetry**, a deeply personal and musical form of verse that contrasted with the epic narratives of earlier times. Unlike the grand, heroic tales of Homer's Iliad and Odyssey—which recounted the deeds of warriors and gods—Lyric Poetry** focused on individual emotions, love, and daily life. This genre was often performed with a lyre (hence its name) at symposia (drinking parties) or religious festivals, making it an intimate yet communal art form. Among its most celebrated practitioners was Sappho, a poet from the island of Lesbos whose works explored themes of desire, longing, and female friendship with unprecedented honesty. Though only fragments of her poetry survive, Sappho's influence was so profound that Plato later called her the "tenth Muse," elevating her to the rank of divine inspiration. Her work also reflects the broader social changes of the Archaic Period, as the polis created spaces for new voices—including those of women—to be heard, albeit within limited spheres.

Religion, too, played a central role in unifying the Greek world, and no institution embodied this more than the Oracle of Delphi**. Located on the slopes of Mount Parnassus, Delphi was home to the sanctuary of Apollo, where a priestess known as the Pythia delivered cryptic prophecies believed to be the god's words. The Oracle of Delphi** was consulted on matters ranging from personal dilemmas to state decisions, such as whether to found a new colony. Its influence extended across the Mediterranean, reinforcing a pan-Hellenic identity even as individual poleis competed with one another. The oracle's responses were often ambiguous, requiring interpretation, which underscored the Greeks' belief in the interplay between divine will and human agency—a theme that would later permeate philosophy and drama.

Athletics also became a cornerstone of Greek culture during this period, with the Olympic Games** serving as both a religious festival and a display of physical prowess. First recorded in 776 BCE, the Olympic Games** were held every four years in Olympia to honor Zeus, attracting competitors and spectators from across the Greek world. Victory in the games brought immense prestige not just to the athlete but to their home polis, reinforcing the idea that excellence (arete) was a collective as well as individual pursuit. The games also promoted a sense of shared Hellenic identity, as participants observed a sacred truce (ekecheiria) that halted warfare during the competition. Events like the stadion (foot race) and pankration (a brutal mix of boxing and wrestling) showcased the Greek ideal of balancing body and mind—a concept that would later influence educational systems, including Sparta's agoge and Athens' gymnasia.

The cultural and intellectual developments of the Archaic Period were not isolated phenomena but interconnected expressions of a society defining itself. Homer's epics provided a mythic past that bound Greeks together, while Lyric Poetry** and figures like Sappho gave voice to personal experiences within that shared framework. The Oracle of Delphi** offered divine guidance in an uncertain world, and the Olympic Games** celebrated human achievement under the watchful eyes of the gods. Together, these elements fostered a distinct Greek identity that would flourish in the Classical Period, even as the polis continued to evolve.

The Archaic Period was a time of dynamic cultural and intellectual growth, where Lyric Poetry**, religious institutions like the Oracle of Delphi**, and pan-Hellenic traditions such as the Olympic Games** shaped a collective Greek consciousness. Figures like Sappho and Homer bridged the personal and the mythic, reflecting the tensions and aspirations of a society in transition. As we move forward in the course, we'll see how these foundations influenced the political and artistic revolutions of the Classical Period, from the democracy of Athens to the tragedies of Sophocles.**

References
[1] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.

[2] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc..`;

console.log('=== Testing Archaic Period Markdown Parsing ===\n');

// Test the specific Archaic Period parser
console.log('1. Testing parseArchaicPeriodContent:');
const archaicResult = parseArchaicPeriodContent(problematicText);
console.log('Result:', archaicResult.substring(0, 500) + '...\n');

// Test the general malformed markdown parser
console.log('2. Testing parseMalformedMarkdown:');
const generalResult = parseMalformedMarkdown(problematicText);
console.log('Result:', generalResult.substring(0, 500) + '...\n');

// Check for remaining malformed asterisks
console.log('3. Checking for remaining malformed asterisks:');
const remainingAsterisks = (archaicResult.match(/\*\*/g) || []).length;
console.log(`Remaining ** patterns: ${remainingAsterisks}`);

// Check for specific problematic patterns
const problematicPatterns = [
  /Lyric Poetry\*\*/g,
  /Oracle of Delphi\*\*/g,
  /Olympic Games\*\*/g,
  /Sappho\*\*/g,
  /Homer\*\*/g,
  /Pythia\*\*/g,
  /Apollo\*\*/g,
  /Mount Parnassus\*\*/g,
  /Delphi\*\*/g,
  /Olympia\*\*/g,
  /Zeus\*\*/g,
  /arete\*\*/g,
  /ekecheiria\*\*/g,
  /stadion\*\*/g,
  /pankration\*\*/g,
  /agoge\*\*/g,
  /gymnasia\*\*/g,
  /Sophocles\*\*/g,
  /Classical Period\*\*/g,
  /Athens\*\*/g,
  /democracy\*\*/g
];

console.log('\n4. Checking for specific problematic patterns:');
problematicPatterns.forEach(pattern => {
  const matches = archaicResult.match(pattern);
  if (matches) {
    console.log(`❌ Found problematic pattern: ${pattern.source} (${matches.length} occurrences)`);
  } else {
    console.log(`✅ No problematic pattern: ${pattern.source}`);
  }
});

console.log('\n=== Test Complete ===');
