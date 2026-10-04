// MULTIPLE MOBILES transport layer for VOTE OUT IMPOSTER.
//
// Serverless rooms: the host shares a 5-letter code; friends on ANY device,
// ANY network (4G / 5G / Wi-Fi), ANYWHERE in the world tap JOIN and enter it.
// No tickets, no answer codes, no accounts, no Firebase, no paid APIs.
//
// How: Trystero hands peers' WebRTC offers over public Nostr relays (free,
// anonymous, ephemeral). The room password derives from the code itself, so
// relay traffic is encrypted end-to-end-ish — nobody on the wire reads roles.
// Connections are direct device-to-device after discovery; the host is
// authoritative and roles go ONLY to each player's own channel.

import { joinRoom, selfId } from 'trystero/nostr';

export type RoomMessage =
  | { t: 'join'; name: string; playerId: string }
  | { t: 'joined'; ok: boolean; reason?: string; roster: { id: string; name: string }[] }
  | { t: 'host-hi' }
  | { t: 'roster'; roster: { id: string; name: string }[] }
  | { t: 'start-roles'; reveal: { isImposter: boolean; knowsWord: boolean; word: string | null; hint: string | null; categoryName: string } }
  | { t: 'state'; phase: string; info: Record<string, unknown> }
  | { t: 'vote'; voterId: string; targetId: string }
  | { t: 'guess'; playerId: string; guess: string }
  | { t: 'leave'; playerId: string }
  | { t: 'room-closed' };

/** Minimal transport the screens code against. */
export interface NetTransport {
  /** Our identity == trystero peer id; stable within this tab. */
  id: string;
  /** Send to one peer, or null = everyone in the room. */
  send(message: RoomMessage, to: string | null): void;
  onMessage: (message: RoomMessage, from: string) => void;
  onPeer?: (event: 'join' | 'leave', peerId: string) => void;
  close(): void;
}

const APP_ID = 'voi-imposter-krypta';

// Probed live (this week): every relay here ACCEPTS trystero's ephemeral events.
// Defaults shipped with trystero are mostly dead/blocking — don't trust them.
const SIGNAL_RELAYS = [
  'wss://relay.damus.io',
  'wss://bucket.coracle.social',
  'wss://nostr-relay.corb.net',
  'wss://nostr.islandarea.net',
  'wss://nostr.mom',
  'wss://nos.lol',
  'wss://basspistol.org',
  'wss://nostr-01.yakihonne.com',
  'wss://nostr.sathoarder.com',
  'wss://nostr.data.haus',
  'wss://nostr-01.uid.ovh'
];

// Symmetric-NAT-proof: free public TURN so 4G↔4G and 5G city-to-city work.
const NET_RTC: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

export function makeRoomCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no confusable 0/O, 1/I/L
  const buf = new Uint8Array(5);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => letters[b % letters.length]).join('');
}

/** Join (or create) a serverless room. Roles stay per-peer via send(…, to). */
export function joinNetRoom(code: string): NetTransport {
  const roomCode = code.toUpperCase();
  const room = joinRoom(
    {
      appId: APP_ID,
      password: 'voi-room:' + roomCode, // encrypts all traffic with the code
      rtcConfig: NET_RTC,
      relayConfig: { urls: SIGNAL_RELAYS, redundancy: 6 }
    },
    roomCode
  );
  const act = room.makeAction<string>('msg');
  const t: NetTransport = {
    id: selfId,
    send(message, to) {
      void act.send(JSON.stringify(message), to ? { target: to } : undefined);
    },
    onMessage: () => { /* replaced by screens */ },
    close() {
      void room.leave();
    }
  };
  act.onMessage = (data, ctx) => {
    try { t.onMessage(JSON.parse(data) as RoomMessage, ctx.peerId); } catch { /* malformed */ }
  };
  room.onPeerJoin = (peerId) => t.onPeer?.('join', peerId);
  room.onPeerLeave = (peerId) => t.onPeer?.('leave', peerId);
  return t;
}

/** Human-friendly join failure copy. */
export function joinFailMessage(code: string): string {
  return (
    `No host found for room ${code.toUpperCase()}.\n\n` +
    `• double-check the 5-letter code (it is case-insensitive)\n` +
    `• make sure the host is still ON their room screen\n` +
    `• first connect can take ~10s — give it a moment, then retry`
  );
}
