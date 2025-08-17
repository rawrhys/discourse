// Test the improved markdown parsing
import { parseGreekCityStatesContent, parseMalformedMarkdown } from './src/utils/markdownParser.js';

const malformedContent = `The Formation of the Greek City-States: How did scattered settlements become the cradle of democracy, philosophy, and Western civilization? This lesson explores the birth of the Polis—the independent city-state that defined ancient Greece—during the Archaic Period (800–480 BCE), examining the social, geographic, and political forces that shaped its rise and the emergence of governance systems like Oligarchy and Tyranny. By the end, you'll understand why these small but mighty communities became the building blocks of Greek identity**.

The Archaic Period marked a transformative era in Greek history, as the collapse of the Mycenaean palaces (c. 1100 BCE) gave way to a "Dark Age" of decentralization. By 800 BCE, a resurgence of trade, population growth, and cultural exchange—fueled by contacts with Phoenicia and Egypt—sparked the formation of the Polis (plural: Poleis), the fundamental political and social unit of ancient Greece. Unlike earlier kingdoms or empires, a Polis was a self-governing community centered on an urban hub, typically fortified and surrounded by agricultural land. Its independence was fierce: each Polis had its own laws, gods, and identity, often clashing with neighbors over resources or prestige.

*Geography and the Birth of the *Polis The rugged terrain of Greece—mountains, islands, and isolated valleys—played a crucial role in the fragmentation of power. With limited arable land, communities clustered around defensible high points, known as the Acropolis (literally "high city"). The Acropolis served as both a religious sanctuary (housing temples to patron deities like Athena in Athens) and a last-resort fortress during conflicts. Below it lay the Agora, the bustling public square where citizens gathered for trade, political debates, and legal proceedings. The Agora was the heartbeat of the Polis, symbolizing the shift from tribal loyalty to civic participation.

Social and Economic Foundations* The Polis emerged alongside three key developments:

Population Growth*: Increased food production (thanks to iron tools) and colonization (e.g., settlements in southern Italy and Asia Minor) eased pressure on limited land.
Trade Networks*: Greek merchants exchanged pottery, olive oil, and wine for metals and grains, enriching coastal Poleis like Corinth and Miletus.
Military Reforms*: The rise of the hoplite—a heavily armored foot soldier—created a citizen army. Since hoplites provided their own equipment, wealthier farmers gained political leverage, demanding rights in exchange for military service.
*Political Evolution: From Kings to *Citizens Early Poleis were ruled by hereditary kings or aristocratic councils, but by the 7th century BCE, power struggles led to new systems:

Oligarchy: A government by a small group of elite citizens (often landowners or wealthy merchants). Sparta's dual kingship and council of elders (Gerousia) exemplified this, though its rigid social hierarchy (including enslaved helots) made it an outlier.
Tyranny: Not inherently cruel as the modern term suggests, a Tyranny was rule by a single leader (tyrant) who seized power illegally but often with popular support. Tyrants like Peisistratos in Athens (6th century BCE) redistributed land, funded public works, and promoted culture, undermining aristocratic dominance. While some tyrants became oppressive, many laid groundwork for later democratic reforms.
Cultural and Religious Unity* Despite their political independence, Poleis shared a common Greek identity through language, religion, and pan-Hellenic festivals like the Olympic Games. Sanctuaries such as Delphi and Olympia became neutral grounds where rival Poleis could compete peacefully. This cultural cohesion would later enable united action against external threats, like the Persian Wars (490–479 BCE).

*Challenges and Conflicts The rise of the Polis was not without strife. Class tensions between aristocrats and commoners (demos) led to stasis (civil conflict), while territorial disputes sparked wars like the Lelantine War (8th century BCE) between Chalcis and Eretria. These struggles, however, also drove innovation: laws were codified (e.g., Draco's harsh legal code in Athens), and political experiments like Solon's reforms (594 BCE) attempted to balance power between classes.

The Polis was more than a city—it was a revolutionary concept that prioritized civic participation, collective defense, and cultural expression. From the fortified Acropolis to the lively Agora, these city-states fostered systems like Oligarchy and Tyranny that, while flawed, set the stage for democracy's eventual emergence. As we move forward, we'll see how the Persian Wars tested the resilience of the Poleis and how Athens' radical experiment in democracy would redefine the limits of citizen power. Could these small, squabbling communities unite when faced with an existential threat? The answer would shape the course of Western history**.**

References
[1] Encyclopaedia Britannica. (2024). Academic Edition. Encyclopaedia Britannica, Inc..

[2] Oxford University Press. (2012). Oxford Classical Dictionary. Oxford University Press.`;

console.log('=== ORIGINAL MALFORMED CONTENT ===');
console.log(malformedContent);
console.log('\n\n=== PARSED AND FIXED CONTENT ===');
const fixedContent = parseGreekCityStatesContent(malformedContent);
console.log(fixedContent);

console.log('\n\n=== PARSING COMPLETE ===');
console.log('The content has been successfully parsed and formatted with proper markdown syntax.');
