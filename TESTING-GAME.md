# 🎮 VOTE OUT IMPOSTER — Game Test List

Updated for: TURN relay, ticket/answer handshake UI, connecting screen, 100-track rotating music, game-only audio.

Legend: ✅ pass · ❌ fail · ⚠️ weird-but-livable
Quick pass = ⭐ items only · Full pass = everything

---

## A. 🏠 Entry & Setup (one phone, 2 min)

- [ ] ⭐ GAME tab opens → mode select: **ONE MOBILE / MULTIPLE MOBILES**
- [ ] Add 3 players → START allowed. Try 2 → blocked with message
- [ ] ⭐ Add/edit/remove/reorder players; CLEAR ALL works
- [ ] 20 players OK; 21st blocked
- [ ] Empty/space-only name rejected
- [ ] ⭐ RECENT PLAYERS: finish any game → quit → reopen setup → names listed, tap-to-add
- [ ] Same-name players don't break the flow (two "Ammu"s playable)

## B. ⚙️ Settings

- [ ] ⭐ Imposter counts 1/2/3/4/CUSTOM/RANDOM select; custom over max (e.g. 4 players → 2) → blocked
- [ ] ⭐ Categories multi-select; 🎲 Random = everything; FAMOUS + MEMES are separate categories
- [ ] Difficulty Easy/Normal/Hard/Random — Easy gives chai-cricket-level simple words
- [ ] Imposter HINT on/off: ON = imposter gets hint word (≠ real word); OFF = blend-in text only
- [ ] Discussion timer off + each preset (30/60/90/120) + custom seconds work
- [ ] ⭐ Rounds 1/3/5/custom — counter matches, summary after last
- [ ] Chaos chips: ONLY the 4 legal ones (everyone-imposter, no-imposter, random-count, custom-count)
- [ ] Sound settings: music toggle, sfx toggle, volume slider; reload → persists

## C. 📵 ONE MOBILE flow (pass-the-phone, 1 game)

- [ ] ⭐ Role cards hidden until tap; innocents see word + category; imposter sees NO real word
- [ ] Pass-handoff screen between players (previous card hidden)
- [ ] ⭐ Discussion: per-player "I'M READY" in order; timer counts and ends (or skip)
- [ ] Voting: sequential pass; ⭐ cannot vote yourself; 1 vote each; tallies hidden till all done
- [ ] Results bars = actual votes
- [ ] ⭐ Tie → "no elimination" + revote screen (force it: split votes)
- [ ] Eliminated reveal shows role + imposters remaining
- [ ] Imposter caught + guess ON → final-chance guess; correct = steal win; wrong = innocents win
- [ ] Guess OFF → skips guess screen
- [ ] ⭐ Win check: eliminate innocents till imposters ≥ alive innocents → imposters win immediately
- [ ] PLAY AGAIN → instant new word+roles, same players; GAME HOME → full reset
- [ ] EVERYONE-IMPOSTER ends in 💀 reveal; NO-IMPOSTER in 😂 reveal (nobody falsely ejected)

## D. 📱➡️📱 MULTIPLE MOBILES — same browser (two tabs, fastest sanity)

- [ ] ⭐ Host creates room → 5-char code shows (no 0/O, 1/I/l chars)
- [ ] Second tab → JOIN → type code → appears in lobby; roster syncs both ways
- [ ] Wrong code → friendly error, no hang
- [ ] ⭐ Only host sees START; guest tab stays in lobby
- [ ] Host STARTs → each tab gets ONLY its own role (host cannot see guest roles)
- [ ] Vote on guest tab → host tally updates; results broadcast to both
- [ ] Guest tab closes mid-game → host roster drops them
- [ ] Host leaves → guest gets "room closed" → back to menu (not stuck)

## E. 🌐 MULTIPLE MOBILES — different networks (THE money test)

Setup: **Phone A on home Wi-Fi (host). Phone B on mobile data, Wi-Fi OFF (guest).**

- [ ] ⭐ A: GENERATE CONNECT TICKET → 📋 COPY TICKET → WhatsApp to B
- [ ] ⭐ B: paste ticket → CONNECT WITH TICKET → sees **answer code card** on the CONNECTING screen (textarea + 📋 COPY ANSWER CODE button — NOT hidden!)
- [ ] B: copy answer → WhatsApp to A → A pastes → ✅ COMPLETE CONNECTION
- [ ] ⭐ A shows "⏳ answer accepted — their phone is connecting"; B auto-lands in lobby within ~10s
- [ ] Both phones stayed on-screen during handshake (background tabs freeze the link — expected)
- [ ] Stale ticket (waited 10+ min before answer) → cancel → fresh ticket works
- [ ] ⭐ 4G ↔ 4G (both on mobile data, no Wi-Fi) also connects (TURN relay path)
- [ ] Cancel button on connecting screen returns to menu cleanly
- [ ] After join: full game played over WebRTC — roles private, votes relay, results sync
- [ ] Guest disconnect (airplane mode 30s) → host roster drops them; game continues

## F. 🎵 Music & Sound (NEW engine)

- [ ] ⭐ Music plays ONLY inside the game (navigate to any other tab mid-song → silence)
- [ ] ⭐ Leave it running 3+ minutes in lobby → track CHANGES roughly every 60s, with a smooth fade not a hard cut
- [ ] No instant repeats — the same 8-second loop never runs the whole night
- [ ] Mood families: lobby/discussion = calm, voting/results = tense, summary = hype — different vibe per phase
- [ ] Music toggle OFF → stops mid-note; ON → resumes with a fresh track
- [ ] Volume slider affects music + sfx; full mute mutes both
- [ ] SFX fire: reveal, imposter, vote, votesDone, win, lose, tick/finalTick on timers
- [ ] First-visit silence: no sound before first tap (browser autoplay rule — expected)
- [ ] OS reduced-motion + low battery — no glitch/buzz, CPU stays calm

## G. 💾 Resume & Stats

- [ ] ⭐ Refresh mid-game → WELCOME BACK 👋 → RESUME lands on exact phase
- [ ] NEW GAME clears session
- [ ] Finished game + refresh → LAST GAME card + PLAY AGAIN / NEW (no dead resume)
- [ ] ⭐ STATS: play one full game → games +1; imposter win / innocent win / voted out / survived / good guess counted right
- [ ] Stats + settings survive full browser restart (localStorage persistence)

## H. 📱 Feel & A11y

- [ ] 360px phone: no horizontal scroll anywhere in the game
- [ ] All tap targets thumb-sized (vote buttons especially)
- [ ] Role = icon + label (🟢/🔴 + words), not color-only
- [ ] Reduced-motion OS setting → no wild flips
- [ ] Browser BACK from mid-game → sane exit, no frozen half-state
- [ ] ⭐ REGRESSION: encode/decode, Secret Drop, burn links, all old features still fine
- [ ] Old share links made before this build still decode

---

**Bug report format:** phone + network (Wi-Fi/4G) → screen → what I tapped → what happened → expected. Screenshot if possible.

**Priority:** E first (cross-network handshake), then F (music), then C with a tie test, then the ⭐ sweep.
