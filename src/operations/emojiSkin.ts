// Emoji Cipherskin — any text rendered as a stampede of emoji.
// Bytes become hex nibbles; each nibble maps to one emoji of the chosen
// theme. 100% reversible novelty encoding (hieroglyphics for group chats).
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8 } from '../utils/bytes';

export const EMOJI_THEMES: Record<string, { name: string; map: string[] }> = {
  animals: { name: 'Animals 🐾', map: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔'] },
  food: { name: 'Food 🍕', map: ['🍎','🍇','🍉','🍓','🍑','🥭','🍍','🥝','🍅','🥑','🌶️','🍔','🍟','🍕','🌮','🍩'] },
  space: { name: 'Space 🚀', map: ['🌍','🌙','⭐','🌞','☁️','🌈','⚡','☄️','🪐','🚀','🛸','👽','🔭','🌌','💫','🛰️'] },
  vibes: { name: 'Vibes 💜', map: ['💜','💙','💚','💛','🧡','❤️','🖤','🤍','⚡','🔥','❄️','💎','🎈','🎉','🕯️','🌟'] }
};

export function emojiEncode(text: string, theme: string): string {
  const t = EMOJI_THEMES[theme]; if (!t) throw new Error('Unknown emoji theme.');
  if (!text) throw new Error('Nothing to skinify — type some text first.');
  const out: string[] = [];
  for (const b of utf8.encode(text)) {
    out.push(t.map[b >> 4], t.map[b & 15]);
  }
  return out.join('');
}

export function emojiDecode(skin: string, theme: string): string {
  const t = EMOJI_THEMES[theme]; if (!t) throw new Error('Unknown emoji theme.');
  const rev = new Map(t.map.map((e, i) => [e, i]));
  // compound emoji are multi-codepoint — match tokens greedily, longest first
  const tokens = [...rev.keys()].sort((a, b) => b.length - a.length);
  const nibbles: number[] = [];
  let i = 0;
  while (i < skin.length) {
    if (/\s/.test(skin[i])) { i++; continue; }
    let matched = false;
    for (const tok of tokens) {
      if (skin.startsWith(tok, i)) { nibbles.push(rev.get(tok)!); i += tok.length; matched = true; break; }
    }
    if (!matched) throw new Error(`Stray glyph "${skin[i]}" — that's not part of the ${t.name} skin (wrong theme selected?).`);
  }
  if (!nibbles.length) throw new Error('No skin emoji found — paste the emoji ciphertext.');
  if (nibbles.length % 2) throw new Error('Emoji stream is broken — it came out as half a byte. Copied in full?');
  const bytes = new Uint8Array(nibbles.length / 2);
  for (let k = 0; k < nibbles.length; k += 2) bytes[k / 2] = (nibbles[k] << 4) | nibbles[k + 1];
  return utf8.decodeStrict(bytes);
}

defineOp({
  id: 'emoji-skin',
  name: 'Emoji Cipherskin',
  category: 'codes',
  description: 'Renders any text as a stampede of emoji — every byte becomes two emoji from your chosen theme. Cute ciphertexts for chats; fully reversible.',
  aliases: ['emoji cipher', 'emoji encode', 'cute encryption', 'emoji secret', 'emoji text'],
  tags: ['emoji', 'cipher', 'fun', 'chat', 'reversible', 'novelty'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'browser',
  options: [
    { type: 'select', key: 'theme', label: 'Skin theme', default: 'animals', options: [
      { value: 'animals', label: 'Animals 🐾' },
      { value: 'food', label: 'Food 🍕' },
      { value: 'space', label: 'Space 🚀' },
      { value: 'vibes', label: 'Vibes 💜' }
    ] }
  ],
  actions: [
    { id: 'encipher', label: '😀 SKINIFY', kind: 'transform', run: (v, o) => textValue(emojiEncode(v.text, String(o.theme ?? 'animals')), 'encoded') },
    { id: 'decipher', label: '🔮 UNSKINIFY', kind: 'decode', run: (v, o) => textValue(emojiDecode(v.text, String(o.theme ?? 'animals'))) }
  ],
  examples: [{ label: 'Cute', input: 'meet at midnight' }],
  docs: 'Maps every byte to TWO emoji (high nibble, low nibble) from your selected 16-emoji theme — base-16 with fur. Reversible text encoding: no encryption at all, just hieroglyphics. Combine with the SECRET DROP locker: lock the message, skinify the VK1 blob, send the animal parade, and let your friend unskinify and unlock. [VK1 blob chars are limited — Animals/Food/Vibes skins are all reversible on them.]',
  warnings: ['Novelty encoding — zero secrecy, everyone with this tool unskinifies it']
});
