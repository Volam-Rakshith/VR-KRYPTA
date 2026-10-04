// LEARN MODE — teaching cards for every operation. Flagship systems get a
// hand-written DEEP DIVE (steps, history, examples, uses, limits, security);
// the whole library still gets an honest AUTO PROFILE generated from each
// op's own metadata — nothing is inventented where the registry tells the truth.
import { getOp, allOps } from '../operations/core/registry';
import type { CategoryId, OperationDefinition } from '../operations/core/types';
import '../operations';

export interface LearnExample {
  label: string;
  input: string;
  output: string;
  /** True when the output is an error note rather than a result. */
  err?: boolean;
}

export interface LearnCard {
  opId: string;
  name: string;
  category: CategoryId;
  engine: string;
  reversible: boolean;
  oneWay: boolean;
  curated: boolean;
  what: string;
  howSteps: string[];
  history: string;
  uses: string[];
  limits: string[];
  security: string;
  tags: string[];
}

export interface CuratedLearn {
  what: string;
  howSteps: string[];
  history: string;
  uses: string[];
  limits: string[];
  security: string;
}

const LOCKER_KEY_NOTE = 'AES-256-GCM with a PBKDF2-derived key. Authentication is part of the design: a wrong key fails loudly, it never yields wrong plaintext. This is the one operation in the library suitable for secrets that actually matter.';

export const CURATED: Record<string, CuratedLearn> = {
  morse: {
    what: 'The alphabet turned into sound. Every letter, digit and common mark becomes a short pattern of dots (dit) and dashes (dah) — short and long signals of any kind: light, taps, flags, horn blasts.',
    howSteps: [
      'Look up each letter in the International Morse table (A = ·−, B = −···, …).',
      'Write the symbols of one letter back-to-back, then a single space between letters.',
      'Separate words with " / " or three spaces.',
      'Dots are 1 unit long, dashes 3; pauses inside a letter are 1, between letters 3, between words 7 units of silence.',
      'To decode: match each dot-dash run against the reversed table — ambiguity vanishes because no letter is a prefix of another in the standard tree.'
    ],
    history: 'Developed in the 1840s by Samuel Morse and Alfred Vail for the electric telegraph; the modern international table was fixed in 1865. Vail optimized for the fastest letters — E and T get one symbol each because they dominate English. SOS (···−−−···) became the maritime distress call in 1906 and was officially retired from sea duty only in 1999.',
    uses: ['Emergency signalling when speech or text is impossible', 'Amateur radio (CW) to this day', 'Aviation beacon identifiers', 'Assistive tech input for limited mobility'],
    limits: ['Letters only — no punctuation beyond a small core set in most tables', 'Slow: a trained operator does ~20 words per minute', 'Separators matter; losing letter spacing corrupts meaning'],
    security: 'Morse hides nothing — any listener can look up the table. Its strength is error-tolerance across terrible channels, not secrecy. If you must hold a secret, pair Morse with a real cipher and treat every dit-dah as public.'
  },
  'morse-audio': {
    what: 'Hear it instead of reading it — text becomes real 440–880 Hz sine beeps (or fullscreen light flashes), plus a downloadable WAV so the message survives as a file.',
    howSteps: [
      'Text is converted to Morse using the same table as the Morse op.',
      'Each dot = 1 unit of sound, dash = 3, letter gap = 3, word gap = 7.',
      'The synthesizer generates a sine wave of configurable pitch and speed (WPM).',
      'The WAV writer packs the same waveform into a standard RIFF file you can attach anywhere.',
      'Light mode flashes the same timing fullscreen — a torch signal across a dark room.'
    ],
    history: 'The authentic channel. Morse was *designed* to be sound-on-wire: in WW2, radio operators recognized each other by the "fist" — the micro-timing quirks of their keying. A screen of dots is the shadow; the beep-and-pause rhythm is the actual object.',
    uses: ['Learning real Morse by ear (the only way people actually receive it)', 'Puzzle or escape-room audio clues', 'Casual signalling that looks like a phone glitch'],
    limits: ['Speakers/light must be able to reach the target', 'Auto play is often blocked by browsers until you click', 'High WPM blurs into unintelligible for untrained ears'],
    security: 'Same as Morse: zero secrecy, excellent reach. Anyone recording the beeps has the plaintext.'
  },
  a1z26: {
    what: 'The most democratic code: A=1, B=2, … Z=26. Write the alphabet, number it, spell with the numbers.',
    howSteps: ['A→1, B→2, C→3 … Z→26.', 'Letters become two-digit or one-digit numbers; keep a separator (space, dash, comma) so 1-9 (AI) vs 19 (S) never collide.', 'Decode by walking numbers against the alphabet — or by splitting carefully between digits 1–26.'],
    history: 'A modern puzzle-hunt staple rather than a historical system; the numbering appears in recreational cryptography from the 19th century onward. Its staying power is that it needs no key, no sheet — a kid can do it on the back of a napkin with the alphabet itself as the only lookup.',
    uses: ['Puzzle hunts and geocaches', 'Teaching code breaking fundamentals', 'Quick, speakable letter IDs'],
    limits: ['Only 26 letters — no digits, punctuation, case', 'Ambiguity without separators (12 could be AB or L)', 'Efficiency: nothing'],
    security: 'None whatsoever. A1Z26 is numerology dress-up games, not cryptography — never trust it with anything beyond a spoiler.'
  },
  baconian: {
    what: "Sir Francis Bacon's 1605 biliteral cipher: hide letters as groups of two distinct symbols — classically A/B — five symbols per letter. The symbols can be anything: two fonts, two faces, two states.",
    howSteps: ['Each plaintext letter becomes a 5-symbol block of the two symbols (A = AAAAA, B = AAAAB, …).', 'The 24-letter version merges I/J and U/V — classic XVIIth-century typography.', 'The blocks are laid beneath any carrier text (one symbol visible per underlying character).', 'Decode by reading runs of 5 and matching against the biliteral alphabet.'],
    history: "One of the foundational texts of steganography. Bacon's 1623 *De Dignitate Scientiarum* describes hiding a message inside a perfectly innocent letter by alternating two types of any glyph — an insight that needed 350 years before Shannon proved binary encoding was fundamental. The 24-letter canonical version predates most modern alphabets.",
    uses: ['The original steganographic handshake', 'Hiding inside printed letters by font/weight choices', 'Puzzle hunts that love the 5-length grid'],
    limits: ['24 or 26 letters only', 'Tight alignment needed — one symbol slips and everything desyncs', '5× message growth'],
    security: 'No secrecy — the cipher alphabet is public knowledge. Security came from the carrier text looking unremarkable, not from any key. Modern TLS would be proud of Bacon but only metaphorically.'
  },
  'tap-code': {
    what: 'The 5×5 knock grid: tap twice per letter — row then column. I/J merge (or C/K in some variants) so 25 cells hold 26 letters.',
    howSteps: ['5×5 Polybius-style grid: row 1 = ABCDE, row 2 = FGHIK, …', 'Each letter = (row, column), tapped or written as two digits from 1–5.', 'A then . . = 1,1; X knocks 5,5.', 'Decode: pair digits, walk the grid.'],
    history: 'Documented as the survival communication of prisoners — especially Vietnamese War POWs in the Hanoi Hilton, where guards could not suppress tapping through walls but could punish anything spoken. It is the Polybius Square (2nd century BC) flattened into audible action.',
    uses: ['Wall/body communication when speech is impossible', 'Teaching grids and coordinate systems', 'Puzzle hunts that exploit the two-finger knock syntax'],
    limits: ['25 cells — one letter must merge (I=J or C=K)', 'Painfully slow: two symbols per letter, no delimiters', 'Needs a live clock or a careful listener'],
    security: 'No secrecy — yet to guards who never learned the grid it sounds like random plumbing. That is not encryption, that is unfamiliarity.'
  },
  braille: {
    what: 'Reading by touch: each letter is a 2×3 cell of raised dots. Grade 1 Braille is a direct alphabet mapping — the same 26 letters, one cell each.',
    howSteps: ['The cell has 6 positions: 1 4 / 2 5 / 3 6.', 'A = dot 1, B = dots 1,2, C = dots 1,4 …', 'Grade 1 spells letter by letter exactly like print (contractions belong to Grade 2).', 'Unicode devotes the whole block U+2800–U+28FF to pattern display — our display form, not the reading form.'],
    history: 'Louis Braille (1809–1852), blind at age three, adapted it from Charles Barbier’s 12-dot “sonography” for Napoleonic soldiers to read silently in the dark. Braille cut it to six dots reachable by a single fingertip and published it at age 15 — an accessibility revolution that still beats print-to-speech for precision.',
    uses: ['Accessibility: the primary reading format for blind readers', 'Tactile signage (elevators, rooms)', 'Puzzle hunts where raised dots matter'],
    limits: ['Unicode braille glyphs are a display trick; they are NOT raised and convey nothing tactile', 'Grade 2 contractions are a different, complex system', 'Display scripts without screen readers decode poorly'],
    security: 'Braille hides nothing — it is designed to be decoded by anyone who touches it. What it does beautifully is translation across senses, in both directions.'
  },
  semaphore: {
    what: 'Signal flags at a distance: two flags held at two of 8 compass positions spell one letter. Rotary pattern (1,2)=A … (7,8)=Z.',
    howSteps: ['Position 1 = arm down at side; positions ascend 45° per step to 8 = arm raised.', 'Each letter is an ordered pair like 3-6 — first flag position, second.', 'A–G use pair 1 with 2-8; H, I use pair 2 with 3-4 (J omitted — rarest English letter); K-L-M-N use 2 with 5-8; and so on.', 'Decode: match both positions against the rotary table.'],
    history: 'Invented by the Chappe brothers’ optical telegraph (1790s France) and formalized for naval combat by the British Admiralty. It needed only lines of sight and two people — the entire Royal Navy could spell across ships against fog of war. Radio killed it commercially; kids’ flags in summer camps keep it alive.',
    uses: ['Ship-to-ship / line-of-sight signalling', 'Video call semaphores when mics fail', 'Escape rooms'],
    limits: ['α to ω only as letters (digits start with a special sign)', 'The receiver must already understand the table (a two-operand alphabet)', 'Line-of-sight is fragile: arms, camera angles, daylight'],
    security: 'None — the table is the key, and the table is printed on millions of scout manuals. Semaphore trusts the observer, not the algorithm.'
  },
  'nato-phonetic': {
    what: 'Spelling over bad audio: say Alfa, Bravo, Charlie and nobody mishears B as P. An entire alphabet of unambiguous word spellings.',
    howSteps: ['A=Alfa, B=Bravo … Z=Zulu (ICAO standard).', 'Digits have their own fixed forms: Fife, Niner etc.', 'Use it letter by letter when the speaking channel distorts.', 'Decode: look up each word, take its first letter.'],
    history: 'Standardized by ICAO in 1956 after five messy alphabets (Able-Baker, RAF, …). The words survive international phonetic testing: each is hard to confuse, travels across accents, and doesn’t fade into another on a noisy radio. Aviation, military and call centers depend on it daily.',
    uses: ['Voice channels with marginal quality', 'Reading license plates / serial numbers aloud', 'Password vulnerability: leaking one letter at a time'],
    limits: ['Words are slow (5 syllables for one letter)', 'Standardization bar: half-learned variants break it', 'Digits differ by service (Zero/Novembers confusion)'],
    security: 'The opposite of hiding — NATO phonetics exist to make transcription unambiguous. Anyone with a phrasebook decodes it instantly.'
  },
  pigpen: {
    what: 'The tic-tac-toe cipher: 26 letters sit inside two grids + two X shapes; each letter is written as the keyhole outline around its square.',
    howSteps: ['First grid: A B C / D E F / G H I inside a 3×3.', 'Second grid same, but each cell gets a dot (J·…R).', 'Two X shapes hold S–Z (with and without dots).', 'Encode: draw the boundary shape of the letter’s cell; E is the simple box, □.'],
    history: 'Masonic-adjacent: the Lodge version guarded lists in the 1700s, but dead certainty about its origin is a myth. Variants surfaced with KKK labels and Revolutionary War graffiti. Its recognizability means it is now one of the first symbols any puzzler learns to spot — exactly the worst property a secrecy system can grow old with.',
    uses: ['Children’s codes and Scout traditions', 'Puzzle of the few-glyph family', 'Embedding symbols in drawing margins'],
    limits: ['Shapes get confused when hand-drawn (┘ vs └ with weak penwork)', 'Only letters', 'Recognition kills it: any onlooker with a zine can decode'],
    security: 'Pigpen is a zero-key system: security = how obscure the shapes look to a modern screen generation. That lasted about 200 years but no longer — every puzzle book starts with it.'
  },
  'dancing-men': {
    what: "Sherlock Holmes' dancing stick figures — each glyph is a letter, and figure-with-flag = end of word. Doyle invented them for 'The Adventure of the Dancing Men' (1903).",
    howSteps: ['Each stick figure maps canon letters: A B E F H L M N O P R T.', 'A trailing flag on a figure marks word end.', 'Our accessible text form is ⟦A⟧⟦B⟧… — same letter mapping, printable in any chat.', 'Decode: split tokens, look up canon letters, unknown figures stay ?.'],
    history: 'Conan Doyle reportedly sketched the alphabet without specifying all 26; only 18 letters are attested in story dialogue. Every “complete” alphabet online is fan reconstruction. The story itself is a nice early crypto-bite: Holmes breaks the substitution by frequency analysis and habit of E.',
    uses: ['Sherlock-flavoured puzzle content', 'Accessible textual coding where real glyph drawing is fragile', 'Teaching substitution basics via fiction'],
    limits: ['Only the canon-attested letters decode — J, K, Q etc never appear in Doyle’s sample', 'Full alphabet claims are modern guesses', 'Accessible form trades costume for reliability'],
    security: 'None: the story itself teaches its break. Its enduring value is cultural — the first cipher most readers can name, murdered by frequency analysis inside 23 pages.'
  },
  'invisible-ink': {
    what: 'Steganography in plain sight: your secret becomes a sequence of zero-width characters — bytes rendered as NOTHING — pasted behind harmless cover text. 8 zero-width bits = 1 secret byte.',
    howSteps: ['Secret is UTF-8 encoded, one bit becomes one of two zero-width code points (bit 0 / bit 1).', 'A length-prefixed marker WAKE the decoder.', 'The zero-width stream welds behind or inside cover text.', 'Decode: scan for zero-widths, group bits into bytes, render the hidden string.'],
    history: 'Descended from classical steganography — invisible inks made of lemon juice, milk, or UV — re-imagined in Unicode. Zero-width steganography became a serious threat model with ZWSP-based watermarking and invisible fingerprinting of leaked documents.',
    uses: ['Hiding a payload inside a chat message that looks like small talk', 'Leak tracing: watermarking documents invisibly per-recipient', 'Puzzles where a blank-looking message *is* the data'],
    limits: ['Max 500 characters — by design, keep the carrier plausible', 'Rich text editors may strip zero-widths', 'Not encryption: anyone who knows to look reads the hidden text — this lip service has always been stated in the docs'],
    security: 'Zeroth law of steganography: security by obscurity dies at first inspection. If someone suspects invisibility, the cover is already broken. This op *says so in the UI*: only pair with real encryption (our locker/timelock) for secrets that matter.'
  },
  'emoji-skin': {
    what: 'A costume, not a cipher: every byte becomes two emoji from your chosen theme. High nibble → first emoji, low nibble → second. 16 emoji per theme, byte-perfect reversible, zero secrecy.',
    howSteps: ['Each contributed theme provides a 16-emoji nibble alphabet.', 'Every UTF-8 byte splits into hi/lo nibbles → two theme emoji.', 'Spaces and newlines pass through untouched for readability.', 'Decode: greedy-match emoji tokens, rebuild nibbles, join bytes.'],
    history: 'Born from the “binary as emoji” meme but weaponized for completeness — our renderer handles compound emoji (VS16) correctly, so ☄️ and 🌶️ decode cleanly while a naïve splitter would eat itself. It’s the postcard format of the library: the fun is the look, everyone already knows how to read a postcard.',
    uses: ['Sending binary-ish payloads through chat where text is the only allowed type', 'Dressing up spoilers/keys', 'The Zoo: combine with a lock — the “public postcard” that only one passphrase opens'],
    limits: ['4 bytes of emoji per input byte → 8 emoji → 4× growth', 'Pure costume: decoder is public', 'Mixing themes across the same text breaks decoding'],
    security: 'Zero — and the docs say so. Emoji skin treats secrecy as comedy. It reverses perfectly for anyone (and our AUTO-DETECT will snitch on your theme in seconds).'
  },
  caesar: {
    what: "Julius Caesar's shift cipher: every letter moves a fixed number of places around the alphabet. A shift of 3 turns ATTACK into DWWDFN.",
    howSteps: ['Pick a shift n (1–26).', 'Each letter moves n steps forward; past Z it wraps to A.', 'Decode with the same shift backwards (26 − n).', 'Break it: try all 26 shifts and read the one that yields text — the first brute force any student meets.'],
    history: 'Suetonius records Caesar using a shift of 3 in his private correspondence (~58 BC). Two millennia later, ROT13 (shift 13) became the internet’s spoiler veil only because 13 is its own inverse. The cipher marks the beginning of documented military cryptography — and also the beginning of cryptanalysis arrogance: brute force was always 26 tries long.',
    uses: ['Teaching substitution and brute force simultaneously', 'puzzle of shift-of-the-day', 'Sarcastic veil (ROT13) where everyone knows the veil'],
    limits: ['Effective keyspace of 25', 'Ignores digits / punctuation (can leak style fingerprints)', 'Frequency profile survives the shift — cryptanalysis remains trivial'],
    security: 'None. 25 keys, automatic brute force, statistical fingerprints — Caesar dies in under a second. Educational only; the only security it ever had was the expectation that most people would not bother to count to 26.'
  },
  rot13: {
    what: 'The celebrity Caesar: a shift of exactly 13, so encoding and decoding are the same operation. ROT13(ROT13(x)) = x.',
    howSteps: ['A becomes N, B becomes O, …, N becomes A.', 'Apply the same step again and it undoes itself.', 'Nothing else happens: digits, case flip helpers, everything passes through.'],
    history: 'Popularized by Usenet in the 1980s to hide punchlines, spoilers and “potentially offensive” posts behind voluntary decoding. The joke was that everyone could decode it and had to *choose* not to — a social contract enforced by interface, not mathematics. Several email clients shipped ROT13 as their entire “scramble” feature.',
    uses: ['Spoiler hiding on forums', 'ANSI-sanitizing puzzle answers in plain view', 'Teaching reciprocal ciphers conceptually'],
    limits: ['One fixed key — literally a single-point keyspace', 'Alphabet-only; punctuation is a free hint', 'The veil depends on reader etiquette'],
    security: 'Absolute zero. ROT13 protects against accidental reading, not adversaries. Use it as the training-wheels of “we are agreeing not to look” — cryptography is not even in the room.'
  },
  atbash: {
    what: 'The mirror cipher: A↔Z, B↔Y, … M↔N. Encode and decode are identical.',
    howSteps: ['Flip each letter about the middle of the alphabet (a 26-N reflection).', 'Confirm: Atbash(Atbash(x)) = x.', 'Numbers and punctuation pass through untouched.'],
    history: 'One of the oldest known substitution systems: Jeremiah uses it for Babylon in Hebrew. As the alphabet was smaller and audiences illiterate, a mirror could genuinely smuggle a prophecy past a soldier. It survives today under the label “reverse-alphabet cipher”.',
    uses: ['Teaching reciprocal ciphers', 'Puzzle hunts (hiding in margins)', 'Historical nodes in the cryptography timeline'],
    limits: ['Single fixed map — no key at all', 'Distribution in the clear; statistics intact', '“Hidden” only to people who skip the last page of the alphabet'],
    security: 'None, but charmingly old. An Atbash message is one index card away from being read with a ruler.'
  },
  vigenere: {
    what: 'The polyalphabetic revolution: a key word selects a different Caesar shift for every letter. LEMON key + ATTACK = LXFOPV.',
    howSteps: ['Repeat the key over the message (ATTACKATDAWN + LEMON…).', 'Each plaintext letter shifts by its key letter (A=0…Z=25).', 'Decode: shift backwards by each key letter.', 'Attack: Kasiski repeats → key length, then coset-IC and chi² per column — exactly what our breaker automates.'],
    history: 'Conceived in the Renaissance (Bellaso 1553 — Vigenère republished improved machinery in 1586 and inherited the name), it resisted formal attack for ~300 years — “le chiffre indéchifiable”. Kasiski published the length trick in 1863 while Babbage had quietly cracked it around 1846. Confédérés died by it in 1863; that did not save their letters.',
    uses: ['Teaching cyclic keys and their failure', 'Puzzles & ARGs with themed keys', 'Understanding why modern ciphers need IVs and nonces'],
    limits: ['Weak key reuse = Kasiski pinpoints the period', 'Frequency analysis per coset cracks each shift individually', 'Short keys ruin everything'],
    security: 'Broken since 1863. Educational, atmospheric, and historically critical — but any Vigenère ciphertext beyond a few hundred characters with a short key is unwrapped by our own breaker in this very library.'
  },
  'enigma-m3': {
    what: 'The Wehrmacht’s 3-rotor machine, faithfully: plugboard swaps + three calibrated rotors + a reflector U-turn the signal through their wirings. Reciprocal: same settings decrypt.',
    howSteps: ['Plugboard: 10 Stecker pairs swap letters symmetrically at in/out.', 'Each rotor implements a fixed crossed wiring (I–V historically) and steps like an odometer.', 'Double-stepping: the middle rotor’s mechanical quirk is a cryptanalytic feature — our implementation does it.', 'The reflector returns the current through a different path, guaranteeing reciprocity.'],
    history: 'Commercial Enigma shipped in the 1920s; the military machine held German confidence through the 30s. First broken by Poland’s Marian Rejewski in 1932 using pure math, then by Bletchley Park with the Bombes. Historians shorten the war by two years to acknowledge the break. The Allied lesson was that procedures (indicator repeat, cribs, no-A plug) kill machines faster than brute force ever does.',
    uses: ['The canonical machine cipher for education', 'Historical reenactment of actual messages', 'Studying combo machines: wiring + stepping + reflection'],
    limits: ['No letter ever enciphers to itself — a free mapable property', '$ early indicator/stecker weaknesses made traffic solvable', 'A machine of its time — computable by a 1930s relay tiny but browsable by anything modern'],
    security: 'Educational only. Modern computing disassembles an Enigma ciphertext in human seconds. It shows, perfectly, how a machine’s strength dies under process hygiene failure, not mathematics alone.'
  },
  playfair: {
    what: 'Digraph cipher on a keyed 5×5 square: pairs of letters become rectangle corners. Encrypts two letters per operation, killing single-letter statistics.',
    howSteps: ['Build the keyed square (keyword first, remainder alphabetically, I/J merge).', 'Digraph rules: same row → shift right; same column → shift down; box → swap corners.', 'Pad odd length with X; split doubles (LL → LX L).', 'Decode: reverse the three rules.'],
    history: 'Designed by Charles Wheatstone in 1854, named for Lord Playfair who promoted it. Britain used it tactically into WWI — Wheatstone’s Terrace. Frank Miller cracked it in 1882 with digraph statistics; “Hillsboro” E went YE, DE stayed reversed… Same war, both sides fluent. It earned a permanent slot in cryptography education for being *just* harder than monoalphabetic while still breakable by hand.',
    uses: ['Undead favorite of instruction sets (film, books, puzzles)', 'Teaching how digraphs flatten but not fully flatten statistics', 'Dating evidence in historical documents'],
    limits: ['Digraph statistics are still stable', 'No double letters → structure leaks', 'I/J or X padding leaks metadata'],
    security: 'Cracked in 1882, hand-in-hand with statistics. Trust it with nothing unless the enemy died before digraph counting was invented.'
  },
  'rail-fence': {
    what: 'Pure transposition: the text zigzags across N rails and reads back row by row. All the letters of the message, none of the order.',
    howSteps: ['Choose rails (3: A…B..C pattern — 1,2,3,2,1,…).', 'Write letters diagonally up and down across the rails.', 'Read rail 1 left-to-right, then rail 2, …', 'Decode: reconstruct the zigzag path and travel it again.'],
    history: 'Known since antiquity — some say Spartan couriers before the Scytale, the fence itself popular by Civil War courier traffic. Its lesson is structural: frequency analysis is helpless against a transposition (letter counts unchanged), but anagramming destroys it instantly.',
    uses: ['First-grade transposition teaching', 'Puzzles where one more rail = one more hour', 'Illustrating that transposition ≠ substitution'],
    limits: ['Rail count is a guess (try 2..8)', 'Letter frequency is completely preserved — one look knows it', 'Single mistake breaks row boundaries of decoding'],
    security: 'None. Restructuring letters in patterns does nothing against letter mathematics; recommended only with a strong cipher in front (transposition over substitution, historically).'
  },
  'solitaire-cipher': {
    what: 'A hand cipher from Neal Stephenson’s *Cryptonomicon*: 54 cards act as a physical PRNG — generate a keystream, add it to letters. Designed by Bruce Schneier (Pontifex) for offline skeptics.',
    howSteps: ['Start with a keyed deck (arrangement = passphrase order).', 'Move Joker A one card down, Joker B two; triple cut at jokers; count cut on bottom card.', 'Output card → letter value 1–26 = stream item; encrypt letters by adding and decoding by subtracting.', 'Discard numbers >26 and reroll the cut.'],
    history: 'Published in 1999 as the fictional-but-real cipher character Enoch Root uses. Schneier designed it deliberately for *configuration in the head and coins on the table* — a post-Cold-War idea of sovereign-cryptography-without-electronics. Its security analysis found deck-bias in the generator modest but real.',
    uses: ['Learning stream ciphers with physical intuition', 'The romance of paper cryptography', 'Puzzle hunt brilliance (a deck of cards as key)'],
    limits: ['Slow: hand operation in minutes per character', 'Deck bias is documented; security is theoretical', 'Lose the deck order = lose everything'],
    security: 'Far stronger than the classical neighbors, audited, and still not of this century’s standards. Educational-then-practical for offline use — for online secrets, it’s AES-256 and we have that operation too.'
  },
  'message-locker': {
    what: 'The only modern cipher: passphrase → PBKDF2-SHA-256 (200,000 rounds) → AES-256-GCM with per-message salt and IV. Blob format VK1.*, timelocked variant VK1.T.* adds a hash-chain grind.',
    howSteps: ['Passphrase is stretched 200k times through PBKDF2 — a password-stretching checksum that defends against tables.', 'Random 16-byte salt and 12-byte IV per message defeat precomputation and keystream repetition.', 'AES-256-GCM encrypts and authenticates: wrong passphrase = explicit failure, not garbage.', 'VK1.T adds a sequential SHA-256 grind — both sides must hash-chain once, proof of time on this device.'],
    history: 'AES-256-GCM is the standard: NIST 2001 pick from the Rijndael competition, Galois/Counter Mode from 2003. Every modern VPN, TLS connection and encrypted disk either uses it or explains why not. PBKDF2 is RFC 8018 — boring, vetted, and what your password manager runs on. This operation is how the library graduates from walking museum to actual vault.',
    uses: ['Real secrets: passwords, keys, diaries', 'SECRET DROP messages to friends', 'The timelock: grind-as-theater for time-delayed reveals'],
    limits: ['Passphrase strength is the entire security budget', 'No forward secrecy/rotation — one compromised copy with a weak pass is unpackable', 'Losing the passphrase = losing the message, forever'],
    security: LOCKER_KEY_NOTE
  },
  base64: {
    what: 'The internet’s postcard format: 3 bytes of anything ⟶ 4 letters from a 64-symbol alphabet. An encoding, NOT a cipher.',
    howSteps: ['Take the byte stream 3 at a time (24 bits).', 'Split into four 6-bit groups; each becomes a symbol of A–Z a–z 0–9 + /.', 'Missing tail bytes get = padding.', 'Decode: four characters to three bytes, discard padding tails.'],
    history: 'MIME (RFC 4648, originally 1992’s RFC 1521) needed a text-safe way to ship attachments in the 7-bit email pipes of the era. Base64 cost is a strict +33% size and infinite confusion in modern crypto 101 classes — “I encrypted it in Base64!” is a laugh line that has hurt real users.',
    uses: ['Embedding binary in JSON/XML text fields', 'Data URIs in HTML', 'Every API that pretends binary isn’t a thing'],
    limits: ['33% inflation', 'Padding mismatch between URL and standard variants', 'A zillion gotchas around whitespace wrapping considered harmful'],
    security: 'Zero. Encoding is free for everyone; decoding is one line of code. Doubly dangerous because a Base64 string *looks* encrypted to the untrained eye — that’s how secrets end up in logs unprotected.'
  },
  base64url: {
    what: 'Base64 with URL passports: + becomes -, / becomes _, padding is optional — safe inside paths, filenames, cookies and JWTs.',
    howSteps: ['Encode like Base64.', 'Replace + with -, / with _.', 'Padding = becomes optional (drop it; the kernel knows)', 'Decode with the same two swaps reversed.'],
    history: 'The URL spec (RFC 3986) reserves + and /, forcing applications to re-encode if standard Base64 appears inside a query. Base64URL (RFC 4648 §5) fixed the mutation properly rather than per-framework hack. Now the favorite of session tokens, filenames, and every JSON Web Token ever signed.',
    uses: ['JSON Web Tokens (header.payload.signature)', 'URL-safe identifiers / attachment names', 'Any place where "%2F" death spirals'],
    limits: ['Padding conventions differ between implementations', 'A b64 string and a b64url string collide silently if you forget to swap — verify the framing'],
    security: 'Same postcard law: no secrecy, and JWTs have fooled so many apps into trusting decoded-but-unverified payloads that unsigned-token bugs get their own CVE families.'
  },
  'percent-encoding': {
    what: 'URL escaping: every unsafe byte becomes %XX so a string can ride inside a URL without breaking its parsing.',
    howSteps: ['Reserved characters (: / ? # & % etc.) get percent-escaped.', 'Non-ASCII bytes UTF-8 first, then %XX per byte.', 'Space becomes + in query string contexts, %20 everywhere else.', 'Decode: walk %XX escapes back to bytes, then UTF-8 decode.'],
    history: 'RFC 3986 (T. Berners-Lee et al.) defined it because URLs solved hypertext routing before anybody thought about sending bytes as data. The modern form feeds through every browser, but 1990s URL-parameter hacker folk know the +/%20 schism cost decades of bug bounty money.',
    uses: ['Deep links and query strings', 'Encoding entire strings for mailforms', 'URL-embedded JSON fragments (jwt?u=…)'],
    limits: ['Variable behavior between contexts for space', 'Length growth up to 9× for unicode text', 'Some applications decode twice; some never — injection origin'],
    security: 'Zero secrecy; max parser danger. Percent-encoding attacks (double decode, overlong UTF-8) sit under real vulns — keep raw secret values out of URLs regardless.'
  },
  sha256: {
    what: 'The backbone hash: any data ⟶ 64 hex digits. Deterministic, avalanche-brutal, one-way. Not encryption.',
    howSteps: ['Message is padded and split into 512-bit blocks.', 'Each block folds into a 256-bit running state through 64 rounds of bitwise mixing (SHA-2).', 'Output the state as 32 bytes → 64 hex chars.', 'Verify integrity: same message → same digest; flip a bit → a completely different digest.'],
    history: 'NIST published SHA-2 in 2001, designed by the NSA as SHA-1’s fate was already suspect (collision 2005, public Shattered 2017). SHA-256 became the most deployed digest on the planet: TLS, Bitcoin, package registries, password stretching. It has had 24 years of the world’s best cryptanalysts and still stands unbloodied.',
    uses: ['Integrity verification (file fingerprints)', 'Commit-style identity (commit hash = sha of content)', 'Password stretching, Merkle trees, blockchains'],
    limits: ['One-way by design: you can never “decrypt” a digest', 'Rainbow tables exist for weak inputs', 'Length-extension applies to raw H(m) only — use HMAC for attestations'],
    security: 'Gold standard with caveats: fast = brute-forceable for low-entropy inputs (yes, GPU farms at billions/s); fine as integrity protector, not a slow password hash. HMAC / HKDF / bcrypt+ / Argon2 pick up where this leaves off.'
  },
  md5: {
    what: 'The fallen digest: 128-bit fingerprint (32 hex digits) — fast, elegant, and collision-broken since 2004. Showcases why hash security is time-limited.',
    howSteps: ['Pad message, split into 512-bit blocks.', 'Run the MD4-style mixing rounds (4 rounds × 16 ops each).', 'Output 16 bytes → 32 hex digits.', 'Same input always → the same fingerprint.'],
    history: "Ron Rivest, MIT, RFC 1321, 1992 — the most elegant compact digest of its decade. Wang & Yu's 2004 collision attack killed it for signatures; a 2008 rogue CA certificate attack made it real. Flame malware used an MD5 collision to forge Windows update signatures in 2012. Also the reason the unix lore that MD5 was still fine became a cautionary lecture; they are still used for legacy checksums where adversaries aren't in the threat model.",
    uses: ['Legacy checksums (non-adversarial corruption only)', 'Teaching collision attacks', 'IPv6 duplicate addressing internals (non-adversarial)'],
    limits: ['PAIRED collisions in seconds on a laptop', 'Length-extension vulnerable at the raw level', 'Absolutely forbidden for password hashing'],
    security: 'Broken. Any certificate, signature or password system using raw MD5 since 2004 has been unsafe — the lesson is that hash functions are retirement systems that one day refuse to be retired, because every file integrity system online was taught on it.'
  },
  gzip: {
    what: 'DEFLATE on duty: the universal compress-until-it-hurts stream behind .gz files, HTTP bodies and PNG’s DNA.',
    howSteps: ['LZ77 finds repeats and replaces them with (back-pointer, length) pointers.', 'Huffman coding squeezes the resulting symbols (common = few bits).', 'A CRC-32 integrity trailer ends the stream.', 'Inflate: walk the Huffman tables, expand pointers byte-by-byte.'],
    history: 'Phil Katz’s ZIP/DEFLATE (1989) → GNU gzip (1992, J.-l. Gailly & M. Adler), designed to dodge the patented LZW GIF mess of the era. DEFLATE is the compressor that never lost on merit: the modern web speaks Content-Encoding: gzip natively; its own successor Brotli fights for the throne and concedes gzip durability.',
    uses: ['HTTP compression — you already get it without asking', 'Log/archive packing', 'Fitting reality in the ASCII-bandwidth era'],
    limits: ['Random data does not compress (may even grow)', 'Side channels: compressed length leaks information (CRIME/BREACH attacks)', 'Text-in-text: small payloads barely benefit'],
    security: 'None. Compression is a code. Combined with length-driven crypto attacks, leaked size can reconstitute your secret — another lesson in why static formats carry threats from their neighbors.'
  },
  'xor-cipher': {
    what: 'The atom of symmetric crypto: ciphertext = plaintext XOR key, byte by byte. Self-inverse: same operation encrypts/decrypts.',
    howSteps: ['Choose a key (text or bytes).', 'Repeat it over the plaintext (key cycling).', 'XOR each byte — 0s pass, 1s flip.', 'Decrypt: run XOR again with the same key.'],
    history: 'The Vernam one-time pad (1917) is the field’s only provably perfect cipher provided key = message length, random, and used exactly once. Everything after is a compromise toward practicality — stream ciphers, keystreams, OTP clones. WW2’s Fish (Tunny) fell when Lorenz operators reused a key; “key reuse” was born that day and has had a relentless six-decade career.',
    uses: ['Learning why key reuse = self-XOR of plaintexts', 'Stream cipher teaching primitives', 'CTF/step-0 exploitation'],
    limits: ['Key cycling is crib-draggable across messages (see our crib attack op)', 'A one-time pad needs exactly the same OTP hygiene everywhere', 'Lucky keys keep patterns — poor entropy visible in output'],
    security: 'Depends 100% on keystream: true random, equal length, one time → mathematically unbreakable (entirely impractical). Repeat the key and our XOR² crib drag start spelling your message back inside the ciphertext hex.'
  },
  'frequency-analysis': {
    what: 'The original decryption autopilot: count the letters — in English, E is ~12.7%, T ~9.1%; any monoalphabetic cipher preserves these shapes with different symbols.',
    howSteps: ['Strip to A–Z, count occurrences per letter.', 'Compare against the reference language distribution.', 'The top cipher letters are most likely E / T / A / I / N , in some order.', 'Map, guess, and iterate against readability (with single-letter confirmations).'],
    history: 'Al-Kindi’s 9th-century Baghdad manuscript is the first known cryptanalytic method; it broke the monopoly of substitution secrecy for six centuries until Vigenère blurred letters under a key per position. It is still the first lens on any unknown monoalphabetic red, and one of our nine analysis tools.',
    uses: ['Breaking Caesar / Atbash / substitution', 'Teaching why ciphers fall long before computers', 'Profiling unknown text (lang guess, weirdness)'],
    limits: ['Needs volume — 30 chars is a shrug, 300 is a conviction', 'Polyalphabetic ciphers flatten the signal (Vigenère was the reaction)', 'Non-English references mislead'],
    security: 'Frequency analysis isn’t security — it is the compiler end that kills every naive alphabet. If your system can survive it naked, it’s at least not monoalphabetic (a 1,000-character floor of any serious story).'
  },
  'caesar-brute-force': {
    what: 'Auto-breaker for shift ciphers: try all 26 Caesar shifts, score each outcome with English statistics, rank and show.' ,
    howSteps: ['Ciphertext letters A–Z only.', 'Rotate through all 26 possible shifts.', 'For each, compute a score (chi-squared of letter distribution + common word hits).', 'Best score wins; second place shows how close the call was.'],
    history: 'Weakness automation — the intellectual child of “Caesar has 25 keys so yes, try them all”. It formalizes why keyspace size is security’s first budget: a 25-key cipher teaches more cryptography than any algorithm ever invented after.',
    uses: ['Instantly unwrapping Caesar/ROT puzzles', 'Teaching chi-squared and consolation ranking', 'Seeding deeper attacks (Vigenère cosets are Caesar columns)'],
    limits: ['Only handles shift ciphers — useless on Vigenère without key length', 'Short/intentional gibberish confuses scores', 'Statistics lie under 15 letters'],
    security: 'It is the insecurity. If a cipher dies in 26 tries, its security space is zero and this tool is the proof.'
  },
  'text-to-bytes': {
    what: 'The foundational bridge: exactly which bytes does my phone send for an A, an é, a 🚀? UTF-8 splits characters into variable-width byte sequences; A = 41, é = C3 A9, 🚀 = F0 9F 9A 80.',
    howSteps: ['Encode each code point: ASCII 7-bit, Latin-1 supplement 2 bytes, BMP 3, astral planes 4.', 'Prefixes (110, 1110, 11110) mark multi-byte lengths; continuation bytes start 10.', 'The result is unambiguous, order-independent, self-synchronizing.', 'Decode: read prefix bytes to know how many continuation bytes the point needs.'],
    history: 'Ken Thompson + Rob Pike, 1992, on a napkin for Plan 9. It crushed UTF-16’s endianness wars by being ASCII-backward-compatible, and is now ~98% of the web. The other 2% is where CJK empire systems (Shift-JIS, Big5) still leak.',
    uses: ['Learning where mojibake comes from (UTF-8 ↔ Latin-1 confusion)', 'Hex analysis of unknown data', 'Everything the text bytes ops depend on'],
    limits: ['Long EST: emoji = 4 bytes each', 'Legacy code pages exist everywhere and eat innocent text', 'Overlong sequences are an attack (and rejected by well-behaved decoders)'],
    security: 'UTF-8 is a representation, not protection. It *reduces* some attacks (NUL-free strings) but hides nothing — it is the platform beneath all secrecy, not a player.'
  },
  'hmac-sha256': {
    what: 'Authenticated digest: SHA-256 with a shared secret folded in via HMAC — two nested hashes guarding the message, so only key holders can verify or forge it.',
    howSteps: ['Pad the key to the block size and XOR inner pad.', 'Hash(inner-pad + message) → intermediate.', 'Hash(outer-pad like inner, different constant)()', 'The final digest authenticates both content and key possession.'],
    history: 'Bellare, Canetti & Krawczyk, 1996 — the fix for the naive mistakes of “hash(key || message)” which suffered length-extension attacks with raw hashes. HMAC became RFC 2104 and now signs every JWT, webhook, Stripe header and API request you’ve ever used.',
    uses: ['API/webhook request signing', 'JWT signature (HS256)', 'Message authenticity between shared-secret parties'],
    limits: ['Shared secret = both sides can forge; no non-repudiation', 'Slow brute-forceable keys are the same old story', 'Replay attacks need timestamps added outside'],
    security: 'Strong authentication when the key is strong. One weak key and it’s plain-text-plus-plain-text — but with 32 random bytes, this is the industrial standard for “you could verify, but only if”.'
  }
};

/* --------------------------- auto profile templates ----------------------- */

const CATEGORY_HISTORY: Record<CategoryId, string> = {
  codes: 'Born at the boundary of telegraphy, military signalling and accessibility: Morse (1840s), Braille (1824), semaphore (1790s) all took the alphabet across distances it had never travelled. Modern unicode tools let the same inventions live on every screen.',
  ciphers: 'Classical pen-and-paper cryptography: the systems that guarded messages from antiquity through the Second World War, designed to be run by hand with rule, alphabet and patience. Computers unmade all of them; their study still builds any serious cryptographer.',
  encodings: 'Standardized as the industry fought over moving binary through text channels: MIME mail, URLs, JSON payloads, terminal pipes. RFC 4648 and friends — not secret, never secret, not trying to be secret.',
  hashing: 'One-way digests standardized by NIST and ISO. MD5 (1992) fell to collisions in 2004; SHA-1 (1995) followed in 2017; SHA-2 (2001) rules the modern web and SHA-3 (2015) waits on tap as backup.',
  compression: 'Dictionary algorithms from LZ77 (Ziv & Lempel, 1977) to DEFLATE (Katz 1989, gzip 1992) — the techniques behind ZIP files, PNG images and HTTP Content-Encoding everywhere.',
  bytes: 'Machine-architecture primitives: how CPUs actually represent integers (two’s complement), floats (IEEE 754), and bit streams (endianness, shifts, masking) — knowledge that separates “was it decoded wrong?” from “are the bytes wrong?”',
  text: 'Word-level tools from typesetting, editors and internet culture — reversals, casings, line disciplines. Small machines built on strings.',
  analysis: 'Cryptanalytic statistics: frequency analysis descends from Al-Kindi (9th century); the Index of Coincidence from William Friedman (1922). Numerical eyes for codebreaking.',
  cryptanalysis: 'Attacks on classical systems: Kasiski (1863) for key length, Friedman for indexing, Hamming-distance key sizing from modern method. They demonstrate precisely why classical systems fell — without pretending they didn’t.'
};

const CATEGORY_SECURITY: Record<CategoryId, string> = {
  codes: 'Codes are notation, not protection. Every table here is public; comfort equals vulnerability.',
  ciphers: 'Classical ciphers are educational artifacts. Modern computing unwraps any of them in human seconds. The Message Locker (AES-256-GCM) is the only op in this category suitable for actual secrets.',
  encodings: 'Encodings have no secrecy whatsoever: the alphabet is the codec, and codecs are public. Never mistake "looks scrambled" for "is encrypted" — a fatal confusion that has leaked real secrets for decades.',
  hashing: 'Hashes are one-way by design and never decode; verify by recomputation. Fast hashes (MD5, SHA-1) are broken or deprecated — prefer SHA-2+, HMAC or PBKDF2 for new secret-sensitive use.',
  compression: 'Compression is a code, not a cipher. Combined with traffic analysis it leaks information (CRIME/BREACH-length attacks) because secrets compress differently than padding.',
  bytes: 'Bit ops introduce no secrecy beyond the transformed key material you choose. They are primitives — the raw atoms from which ciphers like XOR are assembled.',
  text: 'Text transforms are formatting — never confuse aesthetic arrangement with security.',
  analysis: 'Analysis tools are the other side of the coin: they exist to break ciphers and measure unknown data, never to grant secrecy.',
  cryptanalysis: 'Cryptanalysis tools prove that classical systems fall; they provide no defence themselves — just the sober evidence.'
};

const CATEGORY_USES: Record<CategoryId, string[]> = {
  codes: ['Distance signalling and accessibility', 'Teaching representation systems', 'Puzzle hunts'],
  ciphers: ['Learning cryptanalysis', 'Historic message reproduction', 'Puzzles and fiction'],
  encodings: ['Embedding binary in text transports', 'Interoperating over protocols', 'Avoiding parser death by raw bytes'],
  hashing: ['Integrity verification', 'Commit-style identity', 'Password storage (slow hashes) and attestations'],
  compression: ['Smaller transfers and archives', 'Teaching dictionary algorithms', 'Bandwidth conservation'],
  bytes: ['Bit-level debugging', 'Understanding machine data', 'Seed material for ciphers'],
  text: ['Text cleanup and styling', 'Anagram and wordplay tools', 'Editor-quality operations on the web'],
  analysis: ['Language/statistics teaching', 'Unknown-data triage', 'First lenses on ciphertext'],
  cryptanalysis: ['Proving the fall of classical systems', 'Puzzle cracking automation', 'Studying why keyspace + statistics = doom']
};

function firstSentences(text: string, n: number): string {
  const parts = text.split(/(?<=[.?!])\s+/);
  return parts.slice(0, n).join(' ');
}

function autoCard(op: OperationDefinition): LearnCard {
  const category = op.category;
  const steps: string[] = [];
  const acts = op.actions.map((a) => a.label.toLowerCase()).join(' / ');
  switch (category) {
    case 'encodings':
      steps.push(`Takes the input text and map's it through the ${op.name} alphabet.`,
        `${acts.charAt(0).toUpperCase() + acts.slice(1)} are available as round-trip operations.`,
        'Padding and separator rules are enforced exactly as the standard dictates.');
      break;
    case 'ciphers':
      steps.push(`Both sides agree on a key (${op.options?.map((f) => f.label.toLowerCase()).slice(0, 2).join(', ') || 'options in the workspace'}).`,
        `${acts.charAt(0).toUpperCase() + acts.slice(1)} are available as operations.`,
        'Decoded incorrectly, output looks like plain gibberish — the algorithm never complains.');
      break;
    case 'codes':
      steps.push(`Each symbol of the alphabet gains a new notation in the ${op.name} system.`,
        `${acts.charAt(0).toUpperCase() + acts.slice(1)} convert between the two representations.`,
        'Round-trip is lossless for the characters the table covers.');
      break;
    case 'hashing':
      steps.push('Message bytes are mixed through the digest rounds.',
        'A fixed-size fingerprint comes out, rendered as lowercase hex.',
        'Verification = recompute and compare. Decoding never exists by design.');
      break;
    case 'compression':
      steps.push('Repeated structure is replaced by compact references.',
        'Entropy-coding layers squeeze the resulting symbol stream.',
        'Decompression walks the same tables in reverse.');
      break;
    case 'bytes':
      steps.push('Text is bridged to its UTF-8 byte sequence (or supplied bytes directly).',
        `The ${op.name} transform is applied per the option choices.`,
        'Rendered back to hex or text depending on the result kind.');
      break;
    case 'text':
      steps.push('The input string is scanned and classed into characters, words or lines.',
        `The ${op.name} rule is applied to each unit.`,
        'Deterministic: same input → same output.');
      break;
    case 'analysis':
    case 'cryptanalysis':
      steps.push('The ciphertext/data is profiled: counts, distances, statistics.',
        `${op.name} computes the metric or candidate rankings.`,
        'Results are evidence, not answers: they lead, you verify.');
      break;
  }
  const limits: string[] = [
    ...(op.warnings ?? []),
    ...(op.lossy ? ['May discard information (lossy) — the input is not fully recoverable.'] : []),
    ...(op.oneWay ? ['Strictly one-way — there is no decode action and there never will be.'] : []),
    ...(op.engine === 'python' ? ['Runs on the Python engine (Pyodide/WebAssembly) — first use downloads the runtime.'] : [])
  ];
  return {
    opId: op.id,
    name: op.name,
    category,
    engine: op.engine,
    reversible: op.reversible,
    oneWay: op.oneWay ?? false,
    curated: false,
    what: firstSentences(op.description, 2),
    howSteps: steps,
    history: CATEGORY_HISTORY[category],
    uses: CATEGORY_USES[category],
    limits,
    security: CATEGORY_SECURITY[category],
    tags: [...(op.tags ?? []), ...(op.aliases ?? [])].slice(0, 8)
  };
}

/* -------------------------------- public API ------------------------------ */

export function learnIds(): string[] {
  return allOps().map((o) => o.id);
}

export function learnCard(opId: string): LearnCard | null {
  const op = getOp(opId);
  if (!op) return null;
  const curated = CURATED[opId];
  if (!curated) return { ...autoCard(op), curated: false };
  return {
    opId: op.id,
    name: op.name,
    category: op.category,
    engine: op.engine,
    reversible: op.reversible,
    oneWay: op.oneWay ?? false,
    curated: true,
    what: curated.what,
    howSteps: curated.howSteps,
    history: curated.history,
    uses: curated.uses,
    limits: curated.limits,
    security: curated.security,
    tags: [...(op.tags ?? []), ...(op.aliases ?? [])].slice(0, 8)
  };
}

const DEFAULT_SAMPLES: Partial<Record<CategoryId, string>> = {
  codes: 'HELLO EARTH',
  ciphers: 'ATTACK AT DAWN',
  encodings: 'Hello, World!',
  hashing: 'The quick brown fox jumps over the lazy dog',
  compression: 'the rain in spain stays mainly in the plain the rain in spain stays mainly in the plain',
  bytes: 'Hello, World!',
  text: 'Attack At Dawn',
  analysis: 'WKH TXLFN EURZQ IRA MXPSV RYHU WKH ODCB GRJ WKH TXLFN EURZQ IRA WKH TXLFN EURZQ IRA MXPSV WKH RYHU',
  cryptanalysis: 'WKLVTXDQRBLAQVDUHVWWKH'
};

function defaultsFor(op: OperationDefinition): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  for (const f of op.options ?? []) {
    opts[f.key] = f.type === 'number' ? (f.default ?? 0) : (f as { default?: unknown }).default;
  }
  return opts;
}

/** Run the op on a canonical sample so the card shows REAL outputs, not fiction. */
export async function learnExamples(opId: string): Promise<LearnExample[]> {
  const op = getOp(opId);
  if (!op) return [];
  const out: LearnExample[] = [];
  const forward = op.actions[0];
  if (!forward) return out;
  const sampleFromDef = op.examples?.[0];
  const inputText = sampleFromDef?.input ?? DEFAULT_SAMPLES[op.category] ?? 'Hello, World!';
  const opts = { ...defaultsFor(op), ...(sampleFromDef?.options ?? {}) };
  const ctx = { python: async () => { throw new Error('python'); } };
  try {
    const res = await forward.run({ kind: 'text', text: inputText }, opts, ctx);
    out.push({ label: forward.label, input: inputText, output: res.text.length > 1200 ? res.text.slice(0, 1200) + '\n…' : res.text });
    const back = op.actions.find((a) => a.kind === 'decode' || a.kind === 'decompress');
    if (back) {
      try {
        const rev = await back.run({ kind: res.kind ?? 'text', text: res.text, bytes: res.bytes }, opts, ctx);
        if (rev.text.trim().length > 0) {
          out.push({ label: back.label + ' ← round trip', input: res.text.slice(0, 220) + (res.text.length > 220 ? '…' : ''), output: rev.text.length > 900 ? rev.text.slice(0, 900) + '\n…' : rev.text });
        }
      } catch {
        out.push({ label: back.label, input: res.text.slice(0, 160), output: 'Round-trip needs live options set in the workspace.', err: true });
      }
    }
  } catch (e) {
    out.push({
      label: forward.label,
      input: inputText,
      output: op.engine === 'python'
        ? 'Runs live in the Workspace once the Python runtime warms up (Pyodide/WASM).'
        : ('Demo error: ' + (e instanceof Error ? e.message : String(e))),
      err: true
    });
  }
  return out;
}
