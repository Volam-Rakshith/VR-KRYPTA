# KRYPTA — Manual Test List

Everything shipped since: `Invisible Ink op + SECRET DROP ghost mode & detector (zero-width steganography)`

Legend: ✅ pass · ❌ fail · ⚠️ weird-but-livable

---

## 1. 🕳️ Invisible Ink + Ghost Mode (that commit itself)

- [ ] Encode a secret with Invisible Ink → output looks like plain/normal text
- [ ] Paste the output into the detector → hidden message extracts correctly (round-trip)
- [ ] Ghost text survives copy-paste through **WhatsApp** (this is the real world test — some apps strip zero-width chars!)
- [ ] Survives paste into Telegram / Instagram DM / Notes app
- [ ] Detector on clean normal text → reports "nothing hidden", no false positive
- [ ] Mixed text: normal sentence + ghost payload in the middle → detects and extracts only payload
- [ ] Emoji before/after the hidden payload → still decodes
- [ ] Empty secret → friendly error, no crash
- [ ] Very long secret → no freeze, sane behavior (or a clear length limit message)
- [ ] Encode twice (double payload) → detector behavior is predictable (extracts both or last, not garbage)

## 2. 🔥 Secret Drop — Burn After Reading

- [ ] Burn toggle OFF by default; enabling shows fuse chips: 5s / 15s / 30s / 60s / custom
- [ ] Custom fuse accepts 1–3600s; typing 0, negative, or 99999 → clamps to range (no crash)
- [ ] Shared burn URL contains the `/b` marker; opening it triggers the burn flow
- [ ] Countdown only runs when actually displayed (honest theater) — no fake "already burned" on a fresh link
- [ ] When fuse hits 0 → ash/burn animation plays, secret is gone from view
- [ ] Opening the same burn link a second time → behaves predictably (marker still decodes OR clear "already read" state — just confirm no broken screen)
- [ ] Burn + a Share theme together in one URL → both survive decode
- [ ] Secret with emoji / newlines / 500+ chars → burns and displays fine
- [ ] Browser Back during countdown → no stuck half-burned state
- [ ] OS reduced-motion ON → burn animation degrades gracefully
- [ ] After burn, pressing Ctrl+A / copy on the page → secret is NOT still sitting in the DOM

## 3. 🎮 VOTE OUT IMPOSTER — Setup

- [ ] Game opens from the 🎮 GAME tab; mode-select shows ONE MOBILE / MULTIPLE MOBILES
- [ ] Add 3 players → can start; 2 players → blocked with friendly message
- [ ] Add 20 players ✓; 21st → blocked
- [ ] Edit name after adding (tap to edit works — names never lock)
- [ ] Remove a player; reorder players; CLEAR ALL wipes the list
- [ ] Empty/whitespace name → rejected with message
- [ ] Quit to home mid-setup and come back → RECENT PLAYERS shows your names, tap-to-add works
- [ ] Recent players list excludes duplicates, survives full page reload

## 4. 🎮 Imposters & Chaos

- [ ] Count buttons 1/2/3/4/CUSTOM/RANDOM all select correctly
- [ ] With 3 players, imposters >1 → blocked ("must be 1–1" style message)
- [ ] Custom count above the max → validation error, can't start
- [ ] RANDOM-COUNT chaos → over several games gives varied counts (not always same)
- [ ] EVERYONE-IS-IMPOSTER → at reveal everyone is imposter; ending is the 💀 reveal, not a normal vote
- [ ] NO-IMPOSTER → nobody falsely accused; ending is the 😂 reveal
- [ ] ONLY these 4 chaos chips exist — no Double Trouble / Hidden Chaos / others leaked into UI
- [ ] Imposter-hint ON: imposter sees a hint word ≠ the real word
- [ ] Imposter-hint OFF: imposter sees blending instructions only, no hint
- [ ] Guess-toggle ON + EVERYONE chaos → behavior sane (no impossible guess)

## 5. 🎮 Words & Categories

- [ ] Multi-select 2+ categories works; word comes from one of them
- [ ] 🎲 Random category = draw from everything
- [ ] Difficulty Easy/Normal/Hard/Random respected (easy words on Easy)
- [ ] Play ~8 quick games same category → no word repeats early
- [ ] Settings → reload → same category → recent-word memory persists (check no instant repeat)
- [ ] FAMOUS words only appear when famous category picked (separate DB)
- [ ] MEMES category shows the Telugu-film line style words
- [ ] Word shown to innocents ONLY — imposter card never leaks it

## 6. 🎮 One Mobile Flow (pass the phone)

- [ ] Role reveal: card hidden until tap; word for innocents, "blend in" instructions for imposter
- [ ] Pass-to-next-player handoff hides previous card (no peeking from the bus seat)
- [ ] Discussion: each player taps "I'M READY" in order
- [ ] Timer OFF → no clock; each timer option (30/60/90/120/custom) counts down and ends correctly
- [ ] Voting: sequential pass-phone; you CANNOT vote yourself (self not on your ballot)
- [ ] Exactly 1 vote per player; tally hidden until all votes in
- [ ] Results: animated vote bars match actual votes
- [ ] Tie → NO elimination announced + revote screen
- [ ] Tie again on revote → handled (revote or declared tie — just no crash/limbo)
- [ ] Eliminated reveal shows their role + "imposters remaining: N"
- [ ] Imposter caught + guess ON → final-chance guess screen; right guess = imposters steal win
- [ ] Wrong guess → innocents win
- [ ] Guess toggle OFF → no guess screen, straight to win
- [ ] Eliminate innocents until imposters ≥ innocents → imposTER win correctly declared
- [ ] Multiple rounds (set rounds=3): round counter advances, NEW word each round, same players
- [ ] Summary screen: rounds played, wins per side, most-voted-out, best imposter 🏁
- [ ] 🔄 PLAY AGAIN → instant restart, same players/settings, new word+roles, no setup redo
- [ ] GAME HOME → clean reset to game home

## 7. 📱 Multiple Mobiles (needs 2 devices or 2 browsers/tabs)

- [ ] HOST creates room → 5-char code shows (no confusing chars like 0/O, 1/I)
- [ ] JOIN with correct code → lands in lobby, sees player list (try 2 tabs same browser first — easiest)
- [ ] Wrong code → friendly "room not found" error, no hang
- [ ] 2 real devices (different networks) via the ticket/answer flow → connects
- [ ] Only HOST can start; guests see waiting state
- [ ] After start: each guest sees ONLY their own role; host screen shows no guest roles
- [ ] Guests vote on their own phone; host tallies live; results broadcast to all
- [ ] Eliminated imposter gets guess screen on THEIR device
- [ ] Guest leaves mid-game → host sees them drop; counts adjust
- [ ] Host closes room → guests get "room closed", booted to menu gracefully
- [ ] One guest loses connection during voting → timeout path, game doesn't soft-lock

## 8. 💾 Refresh / Resume / Stats

- [ ] Refresh mid-game → "WELCOME BACK 👋" with RESUME / NEW GAME
- [ ] RESUME → returns to the exact screen/phase you left
- [ ] NEW GAME → clears session properly
- [ ] Finish a game (reach summary) → refresh → no Resume offer; shows LAST GAME + PLAY AGAIN / NEW
- [ ] STATS screen: games played, imposter wins, innocent wins, times voted out, survived, correct guesses — all increment correctly after a real game
- [ ] Stats persist across full browser restart
- [ ] Sound settings (music/sfx/volume/mute) persist across reload
- [ ] First tap triggers audio only after gesture; mute actually mutes both music+sfx

## 9. 📱 UX / A11y / Regression

- [ ] All game screens fit a small phone (360px wide) — no horizontal scroll
- [ ] Buttons thumb-sized, no mis-taps between vote targets
- [ ] Role is icon + label, never color-only (check with grayscale / colorblind filter)
- [ ] OS reduced-motion → flips/bars/burns simplify
- [ ] Neon dark look consistent; no white flashes between screens
- [ ] Browser Back button from mid-game → sane behavior (warn or clean exit, no broken state)
- [ ] **REGRESSION:** every old tab still works — encode/decode, all ops, Secret Drop normal share, themes, vault/whatever else was there
- [ ] Direct load of `/game` URL (refresh while on game tab) → loads fine
- [ ] Old share links created BEFORE this build still decode (no protocol break)

## 10. 🚀 Deploy Check (after you push)

- [ ] Site loads on the deployed URL on a phone
- [ ] Service worker / cache: hard-refresh shows the NEW build (game tab present), not stale old one
- [ ] Room mode across 2 phones on the deployed URL works

---

**Found a bug?** Note: screen you were on → what you tapped → what happened → what you expected. Screenshot helps. Send them over and I'll fix in batches.
