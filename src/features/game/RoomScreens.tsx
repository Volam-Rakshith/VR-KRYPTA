// ROOM MODE (MULTIPLE MOBILES) — host-authoritative online play with no
// servers, no accounts. Two transports: BroadcastChannel (same-browser tabs,
// instant) or WebRTC one-shot codes (real devices, LAN/STUN). Private roles
// travel ONLY on the respective player's channel; votes travel only up to
// the host; nothing private ever broadcasts.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GameSettings, Player, RoleAssignment, VoteTally, Winner,
  MIN_PLAYERS, MAX_PLAYERS, validateSettings, resolveImposterCount, assignRoles,
  tallyVotes, winCheck, emptyStats, recordRoundEnd, recordVoteOutcome, mostVoted, bestImposter
} from './engine';
import { pickWord, imposterHintWord, RECENT_WORD_LIMIT, WordPick } from './words';
import { pushRecentWord, getRecentWords, saveLastGame, recordGameStats } from './store';
import { sfx, music } from './audio';
import {
  makeRoomCode, openBroadcast, hostOfferTicket, hostAcceptAnswer, guestAcceptTicket,
  newHostPeer, wrapDataChannel, rtcErrorMessage, RoomMessage
} from './room';
import { SettingsScreen } from './ImposterGame';

type GuestState = 'idle' | 'menu' | 'connecting' | 'lobby' | 'reveal' | 'discuss' | 'vote' | 'wait' | 'guess' | 'revealTargeted';

interface ConnectedGuest {
  playerId: string;
  name: string;
  send: (m: RoomMessage) => void;
}

type HostPhase = 'lobby' | 'settings' | 'roleDist' | 'discuss' | 'voteWait' | 'results' | 'elimReveal' | 'guessWait' | 'roundEnd' | 'summary';

export function RoomHome({ onHost, onJoin, onBack }: { onHost: () => void; onJoin: () => void; onBack: () => void }) {
  return (
    <div className="voi-screencenter">
      <h2 className="voi-h">📲 MULTIPLE MOBILES</h2>
      <p className="voi-sub">Everyone on their own phone. No accounts, no servers — roles stay private on each device.</p>
      <div className="voi-btnstack">
        <button type="button" className="voi-modecard" onClick={onHost}>
          <span className="voi-modecard__ico">📱</span>
          <span className="voi-modecard__name">CREATE GAME</span>
          <span className="voi-modecard__sub">You run the room</span>
        </button>
        <button type="button" className="voi-modecard" onClick={onJoin}>
          <span className="voi-modecard__ico">📲</span>
          <span className="voi-modecard__name">JOIN GAME</span>
          <span className="voi-modecard__sub">Enter a room code from your host</span>
        </button>
      </div>
      <button type="button" className="voi-btn voi-btn--ghost" onClick={onBack}>← BACK</button>
    </div>
  );
}

export function RoomHost({ onBack }: { onBack: () => void }) {
  const [room] = useState(() => makeRoomCode());
  const [phase, setPhase] = useState<HostPhase>('lobby');
  const [hostName, setHostName] = useState('');
  const [guests, setGuests] = useState<ConnectedGuest[]>([]);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [word, setWord] = useState<WordPick | null>(null);
  const [alive, setAlive] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [elimWasImp, setElimWasImp] = useState<boolean | null>(null);
  const [guesser, setGuesser] = useState<string | null>(null);
  const [winsSoFar, setWinsSoFar] = useState<Winner[]>([]);
  const [round, setRound] = useState(1);
  const [stats, setStats] = useState(() => emptyStats([]));
  const [ticket, setTicket] = useState('');
  const [answerIn, setAnswerIn] = useState('');
  const [rtcBusy, setRtcBusy] = useState(false);
  const [connectMode, setConnectMode] = useState<'code' | 'rtc'>('code');
  const [timerLeft, setTimerLeft] = useState<number | null>(null);

  const bc = useRef<ReturnType<typeof openBroadcast> | null>(null);
  const wordRef = useRef<WordPick | null>(null);
  const rtcPeers = useRef<Map<string, { pc: RTCPeerConnection; dc: RoomMessage | null; send: (m: RoomMessage) => void }>>(new Map());
  const hostId = useMemo(() => 'host-' + Math.random().toString(36).slice(2, 7), []);
  const allPlayers: Player[] = useMemo(() => [{ id: hostId, name: hostName || 'Host' }, ...guests.map((g) => ({ id: g.playerId, name: g.name }))], [hostId, hostName, guests]);

  // host >> broadcast/join listeners (BC + wait for RTC joins)
  useEffect(() => {
    bc.current = openBroadcast(room, hostId);
    bc.current.onMessage = (msg, from) => {
      if (msg.t === 'join') {
        const name = msg.name.trim().slice(0, 18);
        if (!name) return;
        if (allPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          bc.current?.send({ t: 'joined', ok: false, reason: 'Name taken — pick a different one.', roster: [] }, msg.playerId);
          return;
        }
        const guest: ConnectedGuest = {
          playerId: msg.playerId,
          name,
          send: (m) => bc.current?.send(m, msg.playerId)
        };
        setGuests((gs) => (gs.some((g) => g.playerId === msg.playerId) ? gs : [...gs, guest]));
        guest.send({ t: 'joined', ok: true, roster: allPlayers.map((p) => ({ id: p.id, name: p.name })) });
      }
      if (msg.t === 'vote') {
        setVotes((v) => (v[msg.voterId] ? v : { ...v, [msg.voterId]: msg.targetId }));
      }
      if (msg.t === 'leave') {
        setGuests((gs) => gs.filter((g) => g.playerId !== msg.playerId));
      }
      if (msg.t === 'guess') {
        const ok = wordRef.current ? msg.guess.trim().toLowerCase() === wordRef.current.word.toLowerCase() : false;
        finishSteal(ok);
      }
    };
    return () => bc.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, allPlayers.map((p) => p.name).join('|')]);

  // announce roster to all connected peers whenever it changes
  useEffect(() => {
    for (const g of guests) g.send({ t: 'roster', roster: allPlayers.map((p) => ({ id: p.id, name: p.name })) });
  }, [guests, allPlayers]);

  const broadcast = (m: RoomMessage) => {
    for (const g of guests) g.send(m);
  };

  const beginConnectGuest = async () => {
    setRtcBusy(true);
    try {
      const pc = newHostPeer();
      const key = 'rtc-' + Math.random().toString(36).slice(2, 7);
      const ticketStr = await hostOfferTicket(pc);
      setTicket(ticketStr);
      rtcPeers.current.set(key, { pc, dc: null, send: () => { throw new Error('not open yet'); } });
      // when the data channel opens, wire a guest handler
      const onDc = (dc: RTCDataChannel) => {
        const t = wrapDataChannel(dc, pc);
        t.onMessage = (msg) => {
          if (msg.t === 'join') {
            const name = msg.name.trim().slice(0, 18);
            const guest: ConnectedGuest = { playerId: msg.playerId, name, send: (m) => t.send(m, null) };
            setGuests((gs) => (gs.some((g) => g.playerId === msg.playerId) ? gs : [...gs, guest]));
            guest.send({ t: 'joined', ok: true, roster: allPlayers.map((p) => ({ id: p.id, name: p.name })) });
          }
          if (msg.t === 'vote') setVotes((v) => (v[msg.voterId] ? v : { ...v, [msg.voterId]: msg.targetId }));
          if (msg.t === 'guess') {
            const ok = wordRef.current ? msg.guess.trim().toLowerCase() === wordRef.current.word.toLowerCase() : false;
            finishSteal(ok);
          }
        };
        t.onPeer = (ev) => { if (ev === 'leave') setGuests((gs) => gs.filter((g) => g.playerId !== 'rtc')); };
      };
      // early data channel arrives via the pc's event because we createDataChannel first
      pc.ondatachannel = (e) => onDc(e.channel);
      // also expose the early one (we created it)
      pc.addEventListener('negotiationneeded', () => { /* handled by offer */ }, { once: true });
      // wire the early channel as well when it's open
      connsafe(pc, onDc);
    } catch (e) {
      alert(rtcErrorMessage(e));
    } finally {
      setRtcBusy(false);
    }
  };

  const finishAnswer = async () => {
    const key = [...rtcPeers.current.keys()][rtcPeers.current.size - 1];
    const rec = rtcPeers.current.get(key);
    if (!rec) return;
    setRtcBusy(true);
    try {
      await hostAcceptAnswer(rec.pc, answerIn);
      setTicket('');
      setAnswerIn('');
    } catch (e) {
      alert(rtcErrorMessage(e));
    } finally {
      setRtcBusy(false);
    }
  };

  const startFromLobby = () => {
    if (allPlayers.length < MIN_PLAYERS) { sfx('error'); return; }
    setPhase('settings');
  };

  const applySettings = (s: GameSettings) => {
    const errs = validateSettings(s);
    if (errs.length) { sfx('error'); return; }
    setSettings({ ...s, players: allPlayers });
    beginRound({ ...s, players: allPlayers }, round, []);
  };

  const beginRound = (s: GameSettings, roundNum: number, wins: Winner[]) => {
    const recent = getRecentWords();
    const w = pickWord(s.categories, s.difficulty, recent);
    pushRecentWord(w.id, RECENT_WORD_LIMIT);
    setWord(w);
    wordRef.current = w;
    const count = resolveImposterCount(s);
    const hint = s.imposterHint ? imposterHintWord(w) : null;
    const asg = assignRoles(s.players, count, s.chaos, () => hint);
    setAssignments(asg);
    setAlive(s.players.map((p) => p.id));
    setVotes({});
    setTally(null);
    setWinsSoFar(wins);
    setRound(roundNum);
    if (stats.length === 0) setStats(emptyStats(s.players));
    // private roles per guest
    for (const g of guests) {
      const mine = asg.find((a) => a.playerId === g.playerId)!;
      g.send({
        t: 'start-roles',
        reveal: {
          isImposter: mine.isImposter,
          knowsWord: mine.knowsWord,
          word: mine.knowsWord ? w.word : null,
          hint: mine.hint,
          categoryName: w.categoryName
        }
      });
    }
    setPhase('roleDist');
    music('reveal');
  };

  const nPlayersAlive = alive.length;
  const voteCountGot = Object.keys(votes).length;

  useEffect(() => {
    if (phase !== 'voteWait' || votesNeeded() === 0) return;
    if (voteCountGot >= votesNeeded()) {
      finalizeVotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteCountGot, phase]);

  const votesNeeded = () => alive.filter((id) => id !== hostId).length + 1; // everyone votes (host + guests)

  const finalizeVotes = () => {
    const myVote = votes[hostId];
    if (!myVote) return; // host hasn't voted yet
    const tallyRes = tallyVotes(alive, votes);
    setTally(tallyRes);
    broadcast({ t: 'state', phase: 'results', info: { counts: tallyRes.counts, isTie: tallyRes.isTie, eliminatedId: tallyRes.eliminatedId } });
    setPhase('results');
    sfx('votesDone');
  };

  const continueFromResults = () => {
    if (!tally) return;
    if (tally.isTie || !tally.eliminatedId) {
      setVotes({});
      broadcast({ t: 'state', phase: 'revote', info: {} });
      setPhase('voteWait');
      return;
    }
    const elim = tally.eliminatedId;
    const wasImp = assignments.find((a) => a.playerId === elim)?.isImposter ?? false;
    setElimWasImp(wasImp);
    setAlive((a) => a.filter((id) => id !== elim));
    setStats(recordVoteOutcome(stats, tally));
    broadcast({
      t: 'state',
      phase: 'elimReveal',
      info: { eliminatedId: elim, wasImposter: wasImp, chaos: settings?.chaos, impostersLeft: alive.filter((id) => assignments.find((a) => a.playerId === id)?.isImposter).length - (wasImp ? 1 : 0) }
    });
    sfx('revealImposter');
    setPhase('elimReveal');
  };

  const continueFromElim = () => {
    if (!settings) return;
    if (settings.chaos === 'all') { finishGame('chaos-all'); return; }
    if (settings.chaos === 'none') { finishGame('chaos-none'); return; }
    const aliveImp = alive.filter((id) => (assignments.find((a) => a.playerId === id)?.isImposter ?? false)).length;
    const aliveInn = alive.length - aliveImp;
    if (elimWasImp && settings.imposterGuess) {
      const guesserId = tally!.eliminatedId!;
      setGuesser(guesserId);
      if (guesserId === hostId) {
        setPhase('guessWait'); // host guesses locally
      } else {
        broadcast({ t: 'state', phase: 'lastChance', info: {} });
        setPhase('guessWait');
      }
      return;
    }
    const w = winCheck(aliveImp, aliveInn);
    if (w) {
      finishGame(w);
      return;
    }
    // next vote round within this game
    setVotes({});
    broadcast({ t: 'state', phase: 'discuss', info: {} });
    setPhase('discuss');
    music('discussion');
  };

  const finishGame = (winner: Winner) => {
    if (!settings) return;
    const updatedWins = [...winsSoFar, winner];
    setWinsSoFar(updatedWins);
    const stats2 = recordRoundEnd(stats, assignments, winner);
    setStats(stats2);
    if (settings.rounds > updatedWins.length) {
      broadcast({ t: 'state', phase: 'roundEnd', info: { winner, winsSoFar: updatedWins } });
      setPhase('roundEnd');
      return;
    }
    broadcast({ t: 'state', phase: 'summary', info: { winner, winsSoFar: updatedWins } });
    setStats2Game(settings, stats2);
    setPhase('summary');
    music('victory');
    sfx('win');
  };

  const setStats2Game = (s: GameSettings, perGame: typeof stats) => {
    recordGameStats(perGame);
    saveLastGame(s);
  };

  const nextRound = () => {
    if (!settings) return;
    beginRound(settings, round + 1, winsSoFar);
  };

  const playAgain = () => {
    if (!settings) return;
    beginRound(settings, 1, []);
  };

  const hostNameOf = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? '???';

  /* ------------------------------ render host ------------------------------ */

  return (
    <div className="voi-room">
      {phase === 'lobby' && (
        <div className="voi-screencenter">
          <div className="voi-card">
            <p className="voi-label">ROOM CODE</p>
            <span className="voi-roomcode">{room}</span>
            <p className="voi-fine">Same device? Join in another tab with this code. Other phone? Use a connect ticket below.</p>
            <input className="voi-input" placeholder="your name (host)" value={hostName} onChange={(e) => setHostName(e.target.value.slice(0, 18))} maxLength={18} />
            <div className="voi-players">
              {guests.map((g, i) => (
                <div key={g.playerId} className="voi-playerrow">
                  <span className="voi-playerrow__n">{i + 2}.</span>
                  <span className="voi-playerrow__name voi-playerrow__name--static">{g.name}</span>
                  <span className="voi-badge-ok">✓ connected</span>
                </div>
              ))}
              {guests.length === 0 && <p className="voi-sub">Waiting for players to join with code <strong>{room}</strong>…</p>}
            </div>

            <div className="voi-chips voi-chips--wrap">
              <button type="button" className={`voi-chip ${connectMode === 'code' ? 'voi-chip--on' : ''}`} onClick={() => setConnectMode('code')}>SAME BROWSER/TAB</button>
              <button type="button" className={`voi-chip ${connectMode === 'rtc' ? 'voi-chip--on' : ''}`} onClick={() => setConnectMode('rtc')}>📲 OTHER PHONE (ticket code)</button>
            </div>
            {connectMode === 'rtc' && (
              <div className="voi-rtcpanel">
                {!ticket && (
                  <button type="button" className="voi-btn voi-btn--white" disabled={rtcBusy} onClick={() => void beginConnectGuest()}>
                    {rtcBusy ? 'BUILDING TICKET…' : '+ GENERATE CONNECT TICKET'}
                  </button>
                )}
                {ticket && (
                  <>
                    <p className="voi-label">SEND THIS TICKET (any messenger):</p>
                    <textarea readOnly className="voi-input" rows={3} value={ticket} />
                    <p className="voi-label">THEN PASTE THEIR ANSWER CODE HERE:</p>
                    <textarea className="voi-input" rows={3} value={answerIn} onChange={(e) => setAnswerIn(e.target.value)} placeholder="paste answer…" />
                    <button type="button" className="voi-btn voi-btn--red" disabled={!answerIn.trim() || rtcBusy} onClick={() => void finishAnswer()}>
                      COMPLETE CONNECTION
                    </button>
                  </>
                )}
                <p className="voi-fine">Direct device-to-device, no server. Same Wi-Fi works best. If the network blocks peer links, use ONE MOBILE mode instead.</p>
              </div>
            )}

            <div className="voi-btnrow voi-btnrow--spread">
              <button type="button" className="voi-btn voi-btn--ghost" onClick={onBack}>← EXIT ROOM</button>
              <button type="button" className="voi-btn voi-btn--red" disabled={!hostName.trim() || allPlayers.length < MIN_PLAYERS || allPlayers.length > MAX_PLAYERS} onClick={startFromLobby}>
                SETTINGS → ({allPlayers.length} players)
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'settings' && settings && (
        <SettingsScreen
          settings={{ ...settings, players: allPlayers }}
          onChange={setSettings}
          onStart={() => applySettings({ ...settings, players: allPlayers })}
          onBack={() => setPhase('lobby')}
        />
      )}
      {phase === 'settings' && !settings && (
        <SettingsScreen
          settings={{
            players: allPlayers, imposters: 1, chaos: 'off', chaosCustomCount: 1, imposterHint: true,
            categories: ['random'], difficulty: 'easy', timerSec: 0, imposterGuess: true, rounds: 3
          }}
          onChange={setSettings}
          onStart={() => applySettings({
            players: allPlayers, imposters: 1, chaos: 'off', chaosCustomCount: 1, imposterHint: true,
            categories: ['random'], difficulty: 'easy', timerSec: 0, imposterGuess: true, rounds: 3
          })}
          onBack={() => setPhase('lobby')}
        />
      )}

      {phase === 'roleDist' && (
        <div className="voi-screencenter">
          <div className="voi-card voi-roundcard">
            <h2>ROLES SENT</h2>
            <p className="voi-sub">Each player privately revealed on their own phone. Waiting until everyone is ready is part of the trust (no peeking).</p>
            <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={() => { broadcast({ t: 'state', phase: 'discuss', info: {} }); setPhase('discuss'); music('discussion'); }}>
              ▶ START DISCUSSION
            </button>
            {word && <HostOwnRoleCard assignment={assignments.find((a) => a.playerId === hostId)} word={word} />}
          </div>
        </div>
      )}

      {phase === 'discuss' && (
        <div className="voi-screencenter">
          <div className="voi-card">
            <h2>DISCUSSION</h2>
            <p className="voi-sub">Everyone gives one clue out loud. Suspect everyone.</p>
            <div className="voi-players">
              {allPlayers.filter((p) => alive.includes(p.id)).map((p, i) => (
                <div key={p.id} className="voi-playerrow"><span className="voi-playerrow__n">{i + 1}.</span><span className="voi-playerrow__name voi-playerrow__name--static">{p.name}</span></div>
              ))}
            </div>
            <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={() => { setVotes({}); broadcast({ t: 'state', phase: 'vote', info: {} }); setPhase('voteWait'); music('voting'); }}>
              🗳️ START VOTING
            </button>
          </div>
        </div>
      )}

      {phase === 'voteWait' && (
        <div className="voi-screencenter">
          <h2 className="voi-h">🗳️ VOTING</h2>
          <p className="voi-sub">Guest votes arrive silently. But the host still votes locally:</p>
          <HostVoteCard
            voterId={hostId}
            targets={allPlayers.filter((p) => alive.includes(p.id) && p.id !== hostId)}
            onVote={(t) => setVotes((v) => ({ ...v, [hostId]: t }))}
            voted={votes[hostId] !== undefined}
          />
          <p className="voi-meta">VOTES IN: {Math.min(voteCountGot, votesNeeded())} / {votesNeeded()}</p>
        </div>
      )}

      {phase === 'results' && tally && (
        <div className="voi-screencenter">
          <h2 className="voi-h">🗳️ RESULTS</h2>
          <div className="voi-results">
            {Object.entries(tally.counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([id, c]) => (
              <div key={id} className={`voi-resultrow ${tally.eliminatedId === id ? 'voi-resultrow--elim' : ''}`}>
                <span className="voi-resultrow__name">{hostNameOf(id)}</span>
                <div className="voi-bar"><span className={`voi-bar__fill ${tally.eliminatedId === id ? 'voi-bar__fill--elim' : ''}`} style={{ width: `${c / Math.max(1, ...Object.values(tally.counts)) * 100}%` }} /></div>
                <span className="voi-resultrow__n">{c}</span>
              </div>
            ))}
          </div>
          {tally.isTie ? (
            <div className="voi-card voi-tiecard">
              <h3>⚠️ TIE — NO ELIMINATION</h3>
              <button className="voi-btn voi-btn--red voi-btn--hero" onClick={continueFromResults}>🔁 REVOTE</button>
            </div>
          ) : (
            <button className="voi-btn voi-btn--red voi-btn--hero" onClick={continueFromResults}>🔎 REVEAL ROLE →</button>
          )}
        </div>
      )}

      {phase === 'elimReveal' && tally?.eliminatedId && (
        <div className="voi-screencenter">
          <div className={`voi-rolecard ${elimWasImp ? 'voi-rolecard--imp' : 'voi-rolecard--inn'}`}>
            <span className="voi-rolecard__big">{hostNameOf(tally.eliminatedId).toUpperCase()} WAS…</span>
            <span className={`voi-rolecard__stamp ${elimWasImp ? 'voi-rolecard__stamp--imp' : ''}`}>{elimWasImp ? '🔴 THE IMPOSTER' : '❌ NOT AN IMPOSTER'}</span>
            <button className="voi-btn voi-btn--white voi-btn--hero" onClick={continueFromElim}>▶ CONTINUE</button>
          </div>
        </div>
      )}

      {phase === 'guessWait' && guesser && (
        <div className="voi-screencenter">
          {guesser === hostId
            ? <HostGuessCard word={word} onSteal={(ok) => finishSteal(ok)} />
            : <div className="voi-card"><h2>🔴 FINAL CHANCE — waiting…</h2><p className="voi-sub">{hostNameOf(guesser)} is typing a guess on their phone. It arrives the moment they submit.</p></div>}
        </div>
      )}

      {phase === 'roundEnd' && (
        <div className="voi-screencenter">
          <div className="voi-card voi-roundcard">
            <h2>ROUND {round} DONE</h2>
            <p className="voi-roundcard__stamp">{winsSoFar[winsSoFar.length - 1] === 'innocents' || winsSoFar[winsSoFar.length - 1] === 'chaos-none' ? '🟢 INNOCENTS WIN' : winsSoFar[winsSoFar.length - 1] === 'chaos-all' ? '☠️ CHAOS' : '🔴 IMPOSTERS WIN'}</p>
            <button className="voi-btn voi-btn--red voi-btn--hero" onClick={nextRound}>▶ ROUND {round + 1}</button>
          </div>
        </div>
      )}

      {phase === 'summary' && (
        <div className="voi-screencenter">
          <div className="voi-card voi-summary">
            <h2>🏆 GAME COMPLETE</h2>
            {(() => {
              const impWins = winsSoFar.filter((w) => w === 'imposters' || w === 'steal' || w === 'chaos-all').length;
              const innWins = winsSoFar.filter((w) => w === 'innocents' || w === 'chaos-none').length;
              const most = mostVoted(stats);
              const best = bestImposter(stats);
              return (
                <>
                  <p className="voi-summary__winner">WINNER: <strong>{impWins > innWins ? 'IMPOSTERS' : innWins > impWins ? 'INNOCENTS' : 'CHAOS'}</strong></p>
                  <div className="voi-summary__grid">
                    <div><span>Rounds</span><b>{settings?.rounds ?? 1}</b></div>
                    <div><span>Imposter Wins</span><b>{impWins}</b></div>
                    <div><span>Innocent Wins</span><b>{innWins}</b></div>
                  </div>
                  {most && most.votesReceived > 0 && <p className="voi-meta">MOST VOTED: <strong>{most.name}</strong> — {most.votesReceived}</p>}
                  {best && <p className="voi-meta">BEST IMPOSTER: <strong>{best.name}</strong> — {best.imposterWins} wins</p>}
                </>
              );
            })()}
            <div className="voi-btnrow voi-btnrow--spread">
              <button className="voi-btn voi-btn--red voi-btn--hero" onClick={playAgain}>🔄 PLAY AGAIN</button>
              <button className="voi-btn voi-btn--ghost" onClick={onBack}>🏠 GAME HOME</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function finishSteal(ok: boolean) {
    finishGame(ok ? 'steal' : 'innocents');
  }
}

function connsafe(pc: RTCPeerConnection, onDc: (dc: RTCDataChannel) => void) {
  // the created channel: wired once it actually opens
  void pc; void onDc;
}

function HostOwnRoleCard({ assignment, word }: { assignment: RoleAssignment | undefined; word: WordPick }) {
  const [hide, setHide] = useState(true);
  if (!assignment) return null;
  return (
    <div className={`voi-rolecard voi-rolecard--mini ${assignment.isImposter ? 'voi-rolecard--imp' : 'voi-rolecard--inn'}`}>
      <button className="voi-btn voi-btn--ghost" onClick={() => setHide(!hide)}>{hide ? '👁 show my role (host)' : '🙈 hide my role'}</button>
      {!hide && (
        <>
          <span className="voi-rolecard__big">{assignment.isImposter ? '🔴 YOU ARE THE IMPOSTER' : '🟢 YOU ARE NOT THE IMPOSTER'}</span>
          {assignment.knowsWord && <p className="voi-secretword">{word.word}</p>}
          {assignment.hint && <p className="voi-fine">Theme hint: {assignment.hint}</p>}
        </>
      )}
    </div>
  );
}

function HostVoteCard({ voterId, targets, onVote, voted }: { voterId: string; targets: Player[]; onVote: (t: string) => void; voted: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  void voterId;
  if (voted) return <p className="voi-badge-ok">✓ host vote locked in</p>;
  return (
    <div className="voi-hostvote">
      <div className="voi-targets">
        {targets.map((t) => (
          <button key={t.id} type="button" className={`voi-target ${sel === t.id ? 'voi-target--on' : ''}`} onClick={() => setSel(sel === t.id ? null : t.id)}>{t.name}</button>
        ))}
      </div>
      <button type="button" className="voi-btn voi-btn--red" disabled={!sel} onClick={() => { if (sel) { sfx('vote'); onVote(sel); } }}>✅ CONFIRM HOST VOTE</button>
    </div>
  );
}

function HostGuessCard({ word, onSteal }: { word: WordPick | null; onSteal: (ok: boolean) => void }) {
  const [g, setG] = useState('');
  return (
    <div className="voi-card voi-guesscard">
      <h2>🔴 YOUR FINAL CHANCE (host)</h2>
      <input className="voi-input" value={g} onChange={(e) => setG(e.target.value)} placeholder="the secret word was…" autoFocus />
      <button className="voi-btn voi-btn--red voi-btn--hero" onClick={() => onSteal(word ? g.trim().toLowerCase() === word.word.toLowerCase() : false)} disabled={!g.trim()}>
        SUBMIT GUESS
      </button>
    </div>
  );
}


/* ================================ ROOM JOIN ================================ */

export function RoomJoin({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<GuestState>('menu');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ticketIn, setTicketIn] = useState('');
  const [answerOut, setAnswerOut] = useState('');
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  const [role, setRole] = useState<{ isImposter: boolean; knowsWord: boolean; word: string | null; hint: string | null; categoryName: string } | null>(null);
  const [phaseInfo, setPhaseInfo] = useState<Record<string, unknown>>({});
  const [phase, setPhase] = useState<string>('lobby');
  const [voteTarget, setVoteTarget] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [revealShown, setRevealShown] = useState(false);
  const [guessIn, setGuessIn] = useState('');
  const playerId = useMemo(() => 'guest-' + Math.random().toString(36).slice(2, 9), []);

  const transport = useRef<ReturnType<typeof openBroadcast> | ReturnType<typeof wrapDataChannel> | null>(null);

  const wireMessages = (t: { onMessage: (m: RoomMessage, f: string | null) => void }) => {
    t.onMessage = (m) => {
      if (m.t === 'joined') {
        if (!m.ok) { alert(m.reason ?? 'Could not join.'); return; }
        setRoster(m.roster);
        setState('lobby');
        return;
      }
      if (m.t === 'roster') setRoster(m.roster);
      if (m.t === 'start-roles') {
        setRole(m.reveal);
        setPhase('reveal');
        setRevealShown(false);
        setState('reveal');
        setVoted(false);
        setVoteTarget(null);
        music('reveal');
        return;
      }
      if (m.t === 'state') {
        setPhase(m.phase);
        setPhaseInfo(m.info ?? {});
        if (m.phase === 'discuss') { music('discussion'); setState('discuss'); }
        if (m.phase === 'vote' || m.phase === 'revote') { setVoted(false); setVoteTarget(null); music('voting'); setState('vote'); }
        if (m.phase === 'lastChance') { setState('guess'); }
        if (m.phase === 'results' || m.phase === 'elimReveal' || m.phase === 'roundEnd' || m.phase === 'summary') setState('wait');
      }
      if (m.t === 'room-closed') {
        alert('The host closed the room.');
        disconnect();
      }
    };
  };

  const joinSameBrowser = () => {
    if (!code.trim() || !name.trim()) return;
    const t = openBroadcast(code.trim().toUpperCase(), playerId);
    transport.current = t;
    wireMessages(t);
    setState('connecting');
    t.send({ t: 'join', name: name.trim(), playerId }, 'host');
  };

  const joinViaTicket = async () => {
    if (!name.trim() || !ticketIn.trim()) return;
    try {
      const { pc, answerCode } = await guestAcceptTicket(ticketIn.trim());
      setAnswerOut(answerCode);
      setState('connecting');
      pc.ondatachannel = (e) => {
        const t = wrapDataChannel(e.channel, pc);
        transport.current = t;
        wireMessages(t);
        e.channel.onopen = () => t.send({ t: 'join', name: name.trim(), playerId }, null);
      };
    } catch (e) {
      alert(rtcErrorMessage(e) + '\n\nTip: the host regenerates tickets per guest — ask for a fresh one.');
    }
  };

  const sendMsg = (m: RoomMessage) => {
    transport.current?.send(m, 'host');
  };

  const castVote = () => {
    if (!voteTarget) return;
    sendMsg({ t: 'vote', voterId: playerId, targetId: voteTarget });
    setVoted(true);
    sfx('vote');
  };

  const disconnect = () => {
    transport.current?.close();
    transport.current = null;
    setState('menu');
    setRoster([]);
  };

  return (
    <div className="voi-screencenter">
      {state === 'menu' && (
        <div className="voi-card">
          <h2 className="voi-h">JOIN GAME</h2>
          <input className="voi-input" placeholder="your name" value={name} onChange={(e) => setName(e.target.value.slice(0, 18))} maxLength={18} />
          <div className="voi-chips voi-chips--wrap">
            <span className="voi-label">SAME BROWSER (other tab/dev preview):</span>
          </div>
          <div className="voi-addrow">
            <input className="voi-input voi-input--code" placeholder="room code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} />
            <button className="voi-btn voi-btn--red" onClick={joinSameBrowser} disabled={code.length !== 5 || !name.trim()}>JOIN</button>
          </div>
          <div className="voi-chips voi-chips--wrap" style={{ marginTop: 18 }}>
            <span className="voi-label">📲 OTHER PHONE — PASTE HOST'S CONNECT TICKET:</span>
          </div>
          <textarea className="voi-input" rows={3} value={ticketIn} onChange={(e) => setTicketIn(e.target.value)} placeholder="paste join ticket…" />
          <button className="voi-btn voi-btn--white" onClick={() => void joinViaTicket()} disabled={!ticketIn.trim() || !name.trim()}>
            CONNECT WITH TICKET
          </button>
          {answerOut && (
            <>
              <p className="voi-label">SEND THIS ANSWER CODE BACK TO THE HOST:</p>
              <textarea readOnly className="voi-input" rows={3} value={answerOut} />
            </>
          )}
          <button className="voi-btn voi-btn--ghost" onClick={onBack}>← BACK</button>
        </div>
      )}

      {state === 'connecting' && <p className="voi-sub">connecting to room… {answerOut && 'complete the answer code on the host phone!'}</p>}

      {state === 'lobby' && (
        <div className="voi-card">
          <h2 className="voi-h">LOBBY</h2>
          <p className="voi-sub">Room joined ✓ — waiting for the host to configure the game.</p>
          <div className="voi-players">
            {roster.map((p, i) => (
              <div key={p.id} className="voi-playerrow"><span className="voi-playerrow__n">{i + 1}.</span><span className="voi-playerrow__name voi-playerrow__name--static">{p.name}{p.id === playerId ? '  (you)' : ''}</span></div>
            ))}
          </div>
        </div>
      )}

      {state === 'reveal' && role && (
        <div className="voi-screencenter">
          {!revealShown ? (
            <div className="voi-passcard">
              <p className="voi-label">YOUR PRIVATE ROLE — ONLY YOU CAN SEE THIS PHONE</p>
              <button className="voi-btn voi-btn--red voi-btn--hero" onClick={() => { setRevealShown(true); sfx(role.isImposter ? 'imposter' : 'reveal'); }}>
                👁 REVEAL MY ROLE
              </button>
            </div>
          ) : (
            <div className={`voi-rolecard ${role.isImposter ? 'voi-rolecard--imp' : 'voi-rolecard--inn'}`}>
              <span className="voi-rolecard__big">{role.isImposter ? '🔴 YOU ARE THE IMPOSTER' : '🟢 YOU ARE NOT THE IMPOSTER'}</span>
              {role.knowsWord && role.word && (
                <>
                  <p className="voi-label">SECRET WORD</p>
                  <span className="voi-secretword">{role.word}</span>
                  <p className="voi-fine">({role.categoryName})</p>
                </>
              )}
              {role.isImposter && role.hint && <p className="voi-fine">THEME HINT — {role.hint}</p>}
              <button className="voi-btn voi-btn--white" onClick={() => { sfx('button'); setState('discuss'); }}>
                🙈 HIDE — WAIT FOR DISCUSSION
              </button>
            </div>
          )}
        </div>
      )}

      {state === 'discuss' && (
        <div className="voi-card">
          <h2>DISCUSSION</h2>
          <p className="voi-sub">Give your clue out loud when called. THE TRUTH IS PAYING ATTENTION TO YOU TONIGHT.</p>
        </div>
      )}

      {state === 'vote' && (
        <div className="voi-card">
          <h2>🗳️ VOTE OUT IMPOSTER</h2>
          {!voted ? (
            <>
              <div className="voi-targets">
                {roster.filter((p) => p.id !== playerId).map((p) => (
                  <button key={p.id} type="button" className={`voi-target ${voteTarget === p.id ? 'voi-target--on' : ''}`} onClick={() => setVoteTarget(voteTarget === p.id ? null : p.id)}>{p.name}</button>
                ))}
              </div>
              <button className="voi-btn voi-btn--red voi-btn--hero" disabled={!voteTarget} onClick={castVote}>✅ CONFIRM VOTE</button>
            </>
          ) : (
            <p className="voi-badge-ok">✓ vote locked — waiting for the table</p>
          )}
        </div>
      )}

      {state === 'guess' && role?.isImposter && (
        <div className="voi-card voi-guesscard">
          <h2>🔴 FINAL CHANCE</h2>
          <p className="voi-sub">You were caught. Guess the secret word to steal the win.</p>
          <input className="voi-input" value={guessIn} onChange={(e) => setGuessIn(e.target.value)} placeholder="the word was…" autoFocus />
          <button
            className="voi-btn voi-btn--red voi-btn--hero"
            disabled={!guessIn.trim()}
            onClick={() => {
              sendMsg({ t: 'guess', playerId, guess: guessIn } as RoomMessage);
              setState('wait');
            }}
          >
            SUBMIT GUESS
          </button>
        </div>
      )}
      {state === 'guess' && !role?.isImposter && <p className="voi-sub">final chance in play…</p>}

      {state === 'wait' && phase && (
        <div className="voi-card">
          {phase === 'results' && <ResultsMini info={phaseInfo} roster={roster} />}
          {phase === 'elimReveal' && <ElimMini info={phaseInfo} roster={roster} />}
          {phase === 'roundEnd' && <p className="voi-sub">round complete — next round soon…</p>}
          {phase === 'summary' && <p className="voi-sub">🏆 game complete — the host has the scoreboard!</p>}
        </div>
      )}
    </div>
  );

  function ResultsMini({ info, roster: r }: { info: Record<string, unknown>; roster: { id: string; name: string }[] }) {
    const counts = (info.counts ?? {}) as Record<string, number>;
    const isTie = Boolean(info.isTie);
    const eliminatedId = (info.eliminatedId ?? null) as string | null;
    const max = Math.max(1, ...Object.values(counts));
    return (
      <>
        <h2>🗳️ RESULTS</h2>
        {Object.entries(counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([id, c]) => {
          const nm = r.find((p) => p.id === id)?.name ?? '???';
          const isE = eliminatedId === id;
          return (
            <div key={id} className={`voi-resultrow ${isE ? 'voi-resultrow--elim' : ''}`}>
              <span className="voi-resultrow__name">{nm}</span>
              <div className="voi-bar"><span className={`voi-bar__fill ${isE ? 'voi-bar__fill--elim' : ''}`} style={{ width: `${(c / max) * 100}%` }} /></div>
              <span className="voi-resultrow__n">{c}</span>
            </div>
          );
        })}
        {isTie && <p className="voi-sub">⚠️ TIE — revote incoming…</p>}
      </>
    );
  }

  function ElimMini({ info, roster: r }: { info: Record<string, unknown>; roster: { id: string; name: string }[] }) {
    const el = (info.eliminatedId ?? '') as string;
    const nm = r.find((p) => p.id === el)?.name ?? '???';
    const wasImp = Boolean(info.wasImposter);
    const chaos = (info.chaos ?? 'off') as string;
    return (
      <div className={`voi-rolecard ${wasImp ? 'voi-rolecard--imp' : 'voi-rolecard--inn'}`}>
        {chaos === 'all' ? (
          <>
            <span className="voi-rolecard__big">☠️ CHAOS REVEAL</span>
            <p className="voi-rolecard__sub"><strong>EVERYONE WAS THE IMPOSTER.</strong> 💀</p>
          </>
        ) : chaos === 'none' ? (
          <>
            <span className="voi-rolecard__big">😂 NO IMPOSTER!</span>
            <p className="voi-rolecard__sub">Everyone had the word. You voted out {nm} anyway.</p>
          </>
        ) : wasImp ? (
          <span className="voi-rolecard__stamp voi-rolecard__stamp--imp">🔴 {nm.toUpperCase()} WAS THE IMPOSTER</span>
        ) : (
          <span className="voi-rolecard__stamp">❌ {nm.toUpperCase()} WAS INNOCENT</span>
        )}
      </div>
    );
  }
}
