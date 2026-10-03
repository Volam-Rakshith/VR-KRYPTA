import { describe, it, expect } from 'vitest';
import { capturedFragment, parseCaptured, SHARE_TEXT_LIMIT, capturedInvite } from '../src/services/share';

describe('share-out codec', () => {
  it('round-trips ASCII payloads', () => {
    const frag = capturedFragment('morse-code', '... --- ...');
    expect(frag.startsWith('x/morse-code/')).toBe(true);
    expect(parseCaptured(frag)).toEqual({ opId: 'morse-code', text: '... --- ...' });
  });

  it('round-trips unicode and symbols', () => {
    const text = 'meet at the lighthouse 🔦\nline two — ünïcode ÷d';
    expect(parseCaptured(capturedFragment('caesar-cipher', text))).toEqual({ opId: 'caesar-cipher', text });
  });

  it('fragment is URL-safe (no +, /, or padding after opId)', () => {
    const frag = capturedFragment('base64', '/?weird+salties==');
    const body = frag.split('/').slice(2).join('');
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects corrupt inputs loudly-but-cleanly', () => {
    expect(parseCaptured('VK1.abc.def.ghi')).toBeNull();
    expect(parseCaptured('x/')).toBeNull();
    expect(parseCaptured('x/not an op/xx')).toBeNull();
    expect(parseCaptured('x/morse-code/')).toBeNull();
    expect(parseCaptured('x/morse-code/%%%')).toBeNull();
  });

  it('invite names the operation and carries the link', () => {
    const inv = capturedInvite('Morse Code', 'https://example/VR-KRYPTA/#/share/x/morse-code/AAA');
    expect(inv).toContain('Morse Code');
    expect(inv).toContain('https://example/');
    expect(inv).toContain('VR DEVELOPMENTS');
  });

  it('limit constant stays QR-friendly', () => {
    expect(SHARE_TEXT_LIMIT).toBeLessThanOrEqual(2200);
  });
});
