// 🕵️ VOTE OUT IMPOSTER — complete party game for VR KRYPTA.
// One file hosts the full ONE-MOBILE flow (pass-and-play), the multi-room
// screens live in RoomScreens and plug into the same pure engine.
// Every screen is mobile-first, sound/music optional, session-restorable,
// replay-fast — exactly per the party-game spec.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChaosMode, Difficulty, GameSettings, Player, RoleAssignment, VoteTally, Winner,
  MIN_PLAYERS, MAX_PLAYERS, maxImposters, validateSettings, resolveImposterCount, assignRoles,
  tallyVotes, winCheck, emptyStats, recordRoundEnd, recordVoteOutcome, mostVoted, bestImposter, PlayerStats
} from './engine';
import { CATEGORIES, Difficulty as WordDifficulty, pickWord, imposterHintWord, RECENT_WORD_LIMIT, WordPick } from './words';
import {
  getRecentPlayers, pushRecentPlayers, saveLastSettings, getLastSettings,
  saveSession, getSession, clearSession, saveLastGame, getLastGame,
  recordGameStats, pushRecentWord, getRecentWords, getSoundPrefs
} from './store';
import { sfx, music, stopMusic, updatePrefs, loadPrefs, Mood } from './audio';
import { Icon } from '../../ui/icons';
import { RoomHome, RoomHost, RoomJoin } from './RoomScreens';

type Screen =
  | 'home' | 'mode' | 'setup' | 'settings'
  | 'rolePass' | 'roleCard' | 'discuss' | 'votePass' | 'vote'
  | 'results' | 'elimReveal' | 'guess' | 'roundEnd' | 'summary' | 'stats';

interface RoundState {
  round: number; // 1-based
  assignments: RoleAssignment[];
  alive: string[];
  word: WordPick | null;
  hint: string | null;
  imposterCount: number;
  clueIdx: number;
  voterIdx: number;
  votes: Record<string, string>;
  tally: VoteTally | null;
  eliminatedId: string | null;
  eliminatedWasImposter: boolean | null;
  winner: Winner | null;
  winsSoFar: Winner[];
  stats: PlayerStats[];
  roundSolved: boolean;
}

const DISCUSSION_TIMER_CHOICES = [0, 30, 60, 90, 120];

function uid(): string {
  return 'p' + Math.random().toString(36).slice(2, 9);
}

function defaultSettings(players: Player[]): GameSettings {
  return {
    players,
    imposters: 1,
    chaos: 'off',
    chaosCustomCount: 1,
    imposterHint: true,
    categories: ['random'],
    difficulty: 'easy',
    timerSec: 0,
    imposterGuess: true,
    rounds: 3
  };
}

const CHAOS_LABEL: Record<ChaosMode, string> = {
  off: 'OFF — normal game',
  all: '☠️ EVERYONE IS IMPOSTER',
  none: '😂 NO IMPOSTER',
  random: '🎲 RANDOM IMPOSTER COUNT',
  custom: '✍️ CUSTOM IMPOSTER COUNT'
};

const MOOD_FOR: Partial<Record<Screen, Mood>> = {
  home: 'lobby',
  roleCard: 'reveal',
  discuss: 'discussion',
  vote: 'voting',
  results: 'results',
  guess: 'voting',
  summary: 'victory'
};

export function ImposterGame() {
  const [mode, setMode] = useState<'one' | 'multi' | null>(null);
  const [roomRole, setRoomRole] = useState<'home' | 'host' | 'join'>('home');
  const [screen, setScreen] = useState<Screen>('home');
  const [welcome, setWelcome] = useState<'resume' | 'replay' | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<GameSettings>(() => defaultSettings([]));
  const [round, setRound] = useState<RoundState | null>(null);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [setupName, setSetupName] = useState('');
  const [sound, setSound] = useState(() => loadPrefs());
  const [revealIdx, setRevealIdx] = useState(0);
  const [cardShown, setCardShown] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessFeedback, setGuessFeedback] = useState<'null' | 'right' | 'wrong'>('null');
  const [voterPassShown, setVoterPassShown] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState<string[]>(() => getRecentPlayers());
  const [sessionRestore, setSessionRestore] = useState<(() => void) | null>(null);
  const [statsAll, setStatsAll] = useState<PlayerStats[]>(() => []);

  const mood = MOOD_FOR[screen] ?? null;
  useEffect(() => {
    if (mode === 'one' && mood) music(mood);
    if (mode === null) music('lobby');
  }, [screen, mode, mood]);

  // ---------------- session restore on mount ----------------
  useEffect(() => {
    const ses = getSession();
    const last = getLastGame();
    if (ses && ses.phase && ses.phase !== 'summary' && ses.phase !== 'home') {
      setWelcome('resume');
      setSessionRestore(() => () => {
        setSettings(ses.settings);
        setPlayers(ses.settings.players);
        const p = ses.payload as Record<string, unknown>;
        if (p.round) setRound(p.round as RoundState);
        if (p.revealIdx !== undefined) setRevealIdx(p.revealIdx as number);
        setScreen(ses.phase as Screen);
        setMode('one');
        setWelcome(null);
      });
    } else if (last) {
      setWelcome('replay');
    }
  }, []);

  // persist evolving session for refresh recovery
  useEffect(() => {
    if (mode !== 'one' || screen === 'home' || screen === 'mode' || screen === 'setup' || screen === 'settings' || screen === 'summary' || screen === 'stats') {
      if (mode === 'one' && screen === 'summary') clearSession();
      return;
    }
    saveSession({ phase: screen, settings, payload: { round, revealIdx }, savedAt: Date.now() });
  }, [screen, mode, round, revealIdx, settings]);

  // ---------------- timer ----------------
  useEffect(() => {
    if (screen !== 'discuss' && screen !== 'vote') return;
    if (settings.timerSec === 0 || timerLeft === null) return;
    if (timerLeft <= 0) {
      if (screen === 'discuss') {
        sfx('finalTick');
        goToVote();
      }
      return;
    }
    if (timerLeft <= 5) sfx('tick');
    const iv = window.setTimeout(() => setTimerLeft((t) => (t === null ? null : t - 1)), 1000);
    return () => window.clearTimeout(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerLeft, screen]);

  /* ------------------------------ setup helpers ---------------------------- */

  const addPlayer = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (players.length >= MAX_PLAYERS) { sfx('error'); return; }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) { sfx('error'); return; }
    setPlayers((p) => [...p, { id: uid(), name: trimmed }]);
    setSetupName('');
    sfx('button');
  };

  const beginSettings = () => {
    const next = { ...settings, players };
    const errs = validateSettings(next);
    if (errs.length) { sfx('error'); return; }
    setSettings(next);
    setScreen('settings');
  };

  /* ------------------------------ game loop -------------------------------- */

  const startGame = (snapSettings: GameSettings) => {
    const errs = validateSettings(snapSettings);
    if (errs.length) { sfx('error'); return; }
    music('reveal');
    sfx('start');
    pushRecentPlayers(snapSettings.players.map((p) => p.name));
    saveLastSettings(snapSettings);
    setRecentPlayers(getRecentPlayers());
    const fresh: RoundState = {
      round: 1,
      assignments: [],
      alive: snapSettings.players.map((p) => p.id),
      word: null,
      hint: null,
      imposterCount: 0,
      clueIdx: 0,
      voterIdx: 0,
      votes: {},
      tally: null,
      eliminatedId: null,
      eliminatedWasImposter: null,
      winner: null,
      winsSoFar: [],
      stats: emptyStats(snapSettings.players),
      roundSolved: false
    };
    startRound(snapSettings, fresh);
  };

  const startRound = (snapSettings: GameSettings, base: RoundState) => {
    const recent = getRecentWords();
    const word = pickWord(snapSettings.categories, snapSettings.difficulty as WordDifficulty, recent);
    pushRecentWord(word.id, RECENT_WORD_LIMIT);
    const count = resolveImposterCount(snapSettings);
    const hint = snapSettings.imposterHint ? imposterHintWord(word) : null;
    const assignments = assignRoles(snapSettings.players, count, snapSettings.chaos, () => hint);
    const next: RoundState = {
      ...base,
      assignments,
      word,
      hint,
      imposterCount: count,
      clueIdx: 0,
      voterIdx: 0,
      votes: {},
      tally: null,
      eliminatedId: null,
      eliminatedWasImposter: null,
      winner: null,
      roundSolved: false
    };
    setRound(next);
    setRevealIdx(0);
    setCardShown(false);
    setGuess('');
    setGuessFeedback('null');
    setScreen('rolePass');
  };

  const assignmentFor = (playerId: string) => round?.assignments.find((a) => a.playerId === playerId);

  const alivePlayers = useMemo(
    () => (round ? settings.players.filter((p) => round.alive.includes(p.id)) : []),
    [round, settings]
  );

  const goToVote = () => {
    setScreen('votePass');
    setVoterPassShown(false);
  };

  /* ------------------------------ vote handling ---------------------------- */

  const submitVote = (targetId: string) => {
    if (!round) return;
    const voter = alivePlayers[round.voterIdx];
    if (!voter || voter.id === targetId) return;
    const votes = { ...round.votes, [voter.id]: targetId };
    sfx('vote');
    if (round.voterIdx + 1 < alivePlayers.length) {
      setRound({ ...round, votes, voterIdx: round.voterIdx + 1 });
      setVoterPassShown(false);
    } else {
      sfx('votesDone');
      const tally = tallyVotes(round.alive, votes);
      setRound({ ...round, votes, tally });
      if (tally.isTie) {
        // handled on results screen as "TIE — REVOTE"
      }
      setScreen('results');
    }
  };

  const confirmTieRevote = () => {
    if (!round) return;
    setRound({ ...round, votes: {}, voterIdx: 0, tally: null });
    setScreen('votePass');
    setVoterPassShown(false);
  };

  const proceedAfterResults = () => {
    if (!round || !round.tally) return;
    const tally = round.tally;
    if (tally.isTie || !tally.eliminatedId) { confirmTieRevote(); return; }
    const elim = tally.eliminatedId;
    const wasImp = assignmentFor(elim)?.isImposter ?? false;
    const alive = round.alive.filter((id) => id !== elim);
    const stats = recordVoteOutcome(round.stats, tally);
    setRound({ ...round, eliminatedId: elim, eliminatedWasImposter: wasImp, alive, stats });
    sfx('revealImposter');
    setScreen('elimReveal');
  };

  const proceedAfterElimReveal = () => {
    if (!round) return;
    const chaos = settings.chaos;
    // chaos endings resolve immediately after the reveal
    if (chaos === 'all') {
      const stats = recordRoundEnd(round.stats, round.assignments, 'chaos-all');
      finishGameWith('chaos-all', stats);
      return;
    }
    if (chaos === 'none') {
      const stats = recordRoundEnd(round.stats, round.assignments, 'chaos-none');
      finishGameWith('chaos-none', stats);
      return;
    }
    const aliveImp = round.alive.filter((id) => assignmentFor(id)?.isImposter).length;
    const aliveInn = round.alive.length - aliveImp;
    // imposer-guess steal check BEFORE innocent-side win evaluation
    if (round.eliminatedWasImposter && settings.imposterGuess) {
      setScreen('guess');
      sfx('guess');
      return;
    }
    const w = winCheck(aliveImp, aliveInn);
    if (w) {
      const stats = recordRoundEnd(round.stats, round.assignments, w);
      finishRoundWith(w, stats, round);
      return;
    }
    // same round continues with survivors
    setRound({ ...round, clueIdx: 0, voterIdx: 0, votes: {}, tally: null, eliminatedId: null, eliminatedWasImposter: null });
    setTimerLeft(settings.timerSec || null);
    setScreen('discuss');
  };

  const submitGuess = () => {
    if (!round || !round.word) return;
    const correct = guess.trim().toLowerCase() === round.word.word.toLowerCase();
    if (correct) {
      setGuessFeedback('right');
      sfx('win');
      const stats: PlayerStats[] = round.stats.map((s) =>
        s.id === round.eliminatedId ? { ...s, successfulGuesses: s.successfulGuesses + 1 } : s
      );
      const ended = recordRoundEnd(stats, round.assignments, 'steal');
      setTimeout(() => finishRoundWith('steal', ended, { ...round, stats }), 1400);
    } else {
      setGuessFeedback('wrong');
      sfx('lose');
      const aliveImp = round.alive.filter((id) => assignmentFor(id)?.isImposter).length;
      const aliveInn = round.alive.length - aliveImp;
      setTimeout(() => {
        const w = winCheck(aliveImp, aliveInn);
        if (w) {
          const stats = recordRoundEnd(round.stats, round.assignments, w);
          finishRoundWith(w, stats, round);
        } else {
          setGuess('');
          setGuessFeedback('null');
          setRound({ ...round, clueIdx: 0, voterIdx: 0, votes: {}, tally: null, eliminatedId: null, eliminatedWasImposter: null });
          setTimerLeft(settings.timerSec || null);
          setScreen('discuss');
        }
      }, 1400);
    }
  };

  const finishRoundWith = (winner: Winner, stats: PlayerStats[], snapshot: RoundState) => {
    const winsSoFar = [...snapshot.winsSoFar, winner];
    if (settings.rounds > winsSoFar.length) {
      setRound({ ...snapshot, stats, winsSoFar, winner });
      setScreen('roundEnd');
      sfx('win');
      return;
    }
    finishGameWithWins(winsSoFar, stats);
  };

  const finishGameWith = (winner: Winner, stats: PlayerStats[]) => {
    finishGameWithWins([winner], stats);
  };

  const finishGameWithWins = (winsSoFar: Winner[], stats: PlayerStats[]) => {
    setRound((r) => (r ? { ...r, stats, winsSoFar, winner: winsSoFar[winsSoFar.length - 1], roundSolved: true } : r));
    setStatsAll(recordGameStats(stats));
    saveLastGame(settings);
    clearSession();
    setScreen('summary');
    music('victory');
    sfx('win');
  };

  const nextRound = () => {
    if (!round) return;
    startRound(settings, { ...round, round: round.round + 1, alive: settings.players.map((p) => p.id) });
  };

  const playAgain = () => {
    const snap = getLastSettings() ?? settings;
    startGame({ ...snap, players });
  };

  const goHome = () => {
    stopMusic();
    setScreen('home');
    setMode(null);
    setRoomRole('home');
    setRound(null);
  };

  /* ------------------------------ screens ---------------------------------- */

  const overall = useMemo(() => {
    if (!round) return null;
    const impWins = round.winsSoFar.filter((w) => w === 'imposters' || w === 'steal' || w === 'chaos-all').length;
    const innWins = round.winsSoFar.filter((w) => w === 'innocents' || w === 'chaos-none').length;
    return { impWins, innWins };
  }, [round]);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '???';

  if (mode === 'multi') {
    return (
      <div className="voi page">
        {roomRole === 'home' && <RoomHome onHost={() => setRoomRole('host')} onJoin={() => setRoomRole('join')} onBack={goHome} />}
        {roomRole === 'host' && <RoomHost onBack={() => setRoomRole('home')} />}
        {roomRole === 'join' && <RoomJoin onBack={() => setRoomRole('home')} />}
      </div>
    );
  }

  return (
    <div className="voi page">
      {screen === 'home' && (
        <HomeScreen
          welcome={welcome}
          onResume={() => sessionRestore?.()}
          onDismissWelcome={() => { clearSession(); setWelcome(null); }}
          lastGame={getLastGame()}
          onReplay={playAgain}
          onMode={() => { setScreen('mode'); sfx('button'); }}
          onStats={() => setScreen('stats')}
          sound={sound}
          onSoundChange={(p) => { updatePrefs(p); setSound(loadPrefs()); }}
        />
      )}

      {screen === 'mode' && (
        <ModeScreen
          onOne={() => { setMode('one'); setScreen('setup'); sfx('button'); }}
          onMulti={() => { setMode('multi'); setRoomRole('home'); sfx('button'); }}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'setup' && mode === 'one' && (
        <SetupScreen
          players={players}
          setPlayers={setPlayers}
          setupName={setupName}
          setSetupName={setSetupName}
          addPlayer={addPlayer}
          recentPlayers={recentPlayers}
          onStart={beginSettings}
          onBack={() => setScreen('mode')}
        />
      )}

      {screen === 'settings' && mode === 'one' && (
        <SettingsScreen
          settings={{ ...settings, players }}
          onChange={setSettings}
          onStart={() => startGame({ ...settings, players })}
          onBack={() => setScreen('setup')}
        />
      )}

      {screen === 'rolePass' && round && (
        <RolePassScreen
          player={settings.players[revealIdx]}
          number={revealIdx + 1}
          total={settings.players.length}
          cardShown={cardShown}
          assignment={assignmentFor(settings.players[revealIdx].id)!}
          word={settings.chaos === 'all' ? null : round.word}
          onShow={() => { setCardShown(true); sfx(assignmentFor(settings.players[revealIdx].id)!.isImposter ? 'imposter' : 'reveal'); }}
          onNext={() => {
            sfx('button');
            if (revealIdx + 1 < settings.players.length) {
              setRevealIdx(revealIdx + 1);
              setCardShown(false);
            } else {
              setTimerLeft(settings.timerSec || null);
              setScreen('discuss');
              setVoterPassShown(false);
            }
          }}
        />
      )}

      {screen === 'discuss' && round && (
        <DiscussScreen
          players={alivePlayers}
          round={round.round}
          timerLeft={timerLeft}
          timerSet={settings.timerSec}
          clueIdx={round.clueIdx}
          onReady={() => {
            sfx('button');
            if (round.clueIdx + 1 < alivePlayers.length) {
              setRound({ ...round, clueIdx: round.clueIdx + 1 });
            } else {
              music('voting');
              goToVote();
            }
          }}
          word={round.word}
        />
      )}

      {screen === 'votePass' && round && (
        <VotePassScreen
          voter={alivePlayers[round.voterIdx]}
          shown={voterPassShown}
          onShow={() => { setVoterPassShown(true); sfx('button'); }}
          onReady={() => setScreen('vote')}
          round={round.round}
        />
      )}

      {screen === 'vote' && round && (
        <VoteScreen
          voter={alivePlayers[round.voterIdx]}
          targets={alivePlayers.filter((p) => p.id !== alivePlayers[round.voterIdx].id)}
          onVote={submitVote}
          word={round.word}
          roleShown={settings.chaos !== 'none' && settings.chaos !== 'all' ? null : settings.chaos === 'all' ? 'all' : 'none'}
        />
      )}

      {screen === 'results' && round?.tally && (
        <ResultsScreen
          tally={round.tally}
          players={players}
          onContinue={proceedAfterResults}
          onRevote={confirmTieRevote}
          eliminatedName={round.tally.eliminatedId ? nameOf(round.tally.eliminatedId) : null}
        />
      )}

      {screen === 'elimReveal' && round?.eliminatedId && (
        <ElimRevealScreen
          name={nameOf(round.eliminatedId)}
          wasImposter={round.eliminatedWasImposter!}
          chaos={settings.chaos}
          impostersLeft={round.alive.filter((id) => assignmentFor(id)?.isImposter).length}
          onContinue={proceedAfterElimReveal}
          hasGuess={settings.imposterGuess && settings.chaos === 'off'}
        />
      )}

      {screen === 'guess' && round && (
        <GuessScreen
          guess={guess}
          setGuess={setGuess}
          feedback={guessFeedback}
          correctWord={round.word?.word ?? ''}
          onSubmit={submitGuess}
        />
      )}

      {screen === 'roundEnd' && round && overall && (
        <RoundEndScreen
          round={round.round}
          rounds={settings.rounds}
          wins={overall}
          winner={round.winner}
          onNext={nextRound}
        />
      )}

      {screen === 'summary' && round && overall && (
        <SummaryScreen
          wins={overall}
          stats={round.stats}
          settings={settings}
          onPlayAgain={playAgain}
          onHome={goHome}
        />
      )}

      {screen === 'stats' && (
        <StatsScreen stats={statsAll} onBack={() => setScreen('home')} />
      )}
    </div>
  );
}

/* ================================ SCREENS ================================= */

function HomeScreen({
  welcome, onResume, onDismissWelcome, lastGame, onReplay, onMode, onStats, sound, onSoundChange
}: {
  welcome: 'resume' | 'replay' | null;
  onResume: () => void;
  onDismissWelcome: () => void;
  lastGame: { settings: GameSettings; finishedAt: number } | null;
  onReplay: () => void;
  onMode: () => void;
  onStats: () => void;
  sound: ReturnType<typeof getSoundPrefs>;
  onSoundChange: (p: Partial<ReturnType<typeof getSoundPrefs>>) => void;
}) {
  const [showSound, setShowSound] = useState(false);
  return (
    <div className="voi-home">
      <div className="voi-logo" aria-hidden>
        <span className="voi-logo__eye">🕵️</span>
        <h1 className="voi-title">VOTE OUT IMPOSTER</h1>
        <p className="voi-tag">A VR DEVELOPMENTS party game — one liar, everyone suspicious.</p>
      </div>

      {welcome === 'resume' && (
        <div className="voi-card voi-restore">
          <h2>WELCOME BACK 👋</h2>
          <p>You have an unfinished game.</p>
          <div className="voi-btnrow">
            <button type="button" className="voi-btn voi-btn--white" onClick={onResume}>▶ RESUME GAME</button>
            <button type="button" className="voi-btn voi-btn--ghost" onClick={onDismissWelcome}>+ NEW GAME</button>
          </div>
        </div>
      )}
      {welcome === 'replay' && lastGame && (
        <div className="voi-card voi-restore">
          <h2>LAST GAME</h2>
          <p className="voi-meta">
            {lastGame.settings.players.length} Players · {typeof lastGame.settings.imposters === 'number' ? lastGame.settings.imposters : lastGame.settings.imposters} Imposter{Number(lastGame.settings.imposters) > 1 || lastGame.settings.imposters === 'random' ? 's' : ''} ·{' '}
            {lastGame.settings.categories.includes('random') ? 'All Categories' : lastGame.settings.categories.join(' + ')} · {lastGame.settings.difficulty}
          </p>
          <div className="voi-btnrow">
            <button type="button" className="voi-btn voi-btn--red" onClick={onReplay}>🔄 PLAY AGAIN</button>
            <button type="button" className="voi-btn voi-btn--ghost" onClick={onDismissWelcome}>+ NEW GAME</button>
          </div>
        </div>
      )}

      <div className="voi-btnstack">
        <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onMode}>
          🎮 PLAY
        </button>
        <button type="button" className="voi-btn voi-btn--ghost" onClick={onStats}>🏆 HALL OF FAME</button>
        <button type="button" className="voi-btn voi-btn--ghost" onClick={() => setShowSound(!showSound)}>🔊 SOUND</button>
      </div>

      {showSound && (
        <div className="voi-card voi-soundpanel">
          <p className="voi-label">music</p>
          <label className={`voi-toggle ${sound.music ? 'voi-toggle--on' : ''}`}>
            <input type="checkbox" checked={sound.music} onChange={(e) => onSoundChange({ music: e.target.checked })} />
            <span>{sound.music ? 'ON' : 'OFF'}</span>
          </label>
          <p className="voi-label">sound effects</p>
          <label className={`voi-toggle ${sound.sfx ? 'voi-toggle--on' : ''}`}>
            <input type="checkbox" checked={sound.sfx} onChange={(e) => onSoundChange({ sfx: e.target.checked })} />
            <span>{sound.sfx ? 'ON' : 'OFF'}</span>
          </label>
          <p className="voi-label">volume — {sound.volume}%</p>
          <input
            type="range"
            min={0}
            max={100}
            value={sound.volume}
            onChange={(e) => onSoundChange({ volume: Number(e.target.value) })}
            className="voi-volume"
            aria-label="Volume"
          />
        </div>
      )}

      <p className="voi-footnote">No accounts · no ads · everything stays on this phone</p>
    </div>
  );
}

function ModeScreen({ onOne, onMulti, onBack }: { onOne: () => void; onMulti: () => void; onBack: () => void }) {
  return (
    <div className="voi-screencenter">
      <h2 className="voi-h">How do you want to play?</h2>
      <div className="voi-btnstack">
        <button type="button" className="voi-modecard" onClick={onOne}>
          <span className="voi-modecard__ico">📱</span>
          <span className="voi-modecard__name">ONE MOBILE</span>
          <span className="voi-modecard__sub">Pass one phone around — roles appear one tap at a time</span>
        </button>
        <button type="button" className="voi-modecard" onClick={onMulti}>
          <span className="voi-modecard__ico">📲</span>
          <span className="voi-modecard__name">MULTIPLE MOBILES</span>
          <span className="voi-modecard__sub">Everyone plays on their own phone — room codes, private roles, no accounts</span>
        </button>
      </div>
      <button type="button" className="voi-btn voi-btn--ghost" onClick={onBack}>← BACK</button>
    </div>
  );
}

function SetupScreen({
  players, setPlayers, setupName, setSetupName, addPlayer, recentPlayers, onStart, onBack
}: {
  players: Player[];
  setPlayers: (p: Player[]) => void;
  setupName: string;
  setSetupName: (s: string) => void;
  addPlayer: (n: string) => void;
  recentPlayers: string[];
  onStart: () => void;
  onBack: () => void;
}) {
  const swap = (i: number, j: number) => {
    const next = [...players];
    [next[i], next[j]] = [next[j], next[i]];
    setPlayers(next);
  };
  const valid = players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS;
  return (
    <div className="voi-setup">
      <h2 className="voi-h">PLAYERS <span className="voi-count">{players.length}/{MAX_PLAYERS}</span></h2>
      <p className="voi-sub">Minimum {MIN_PLAYERS}. Names stay on this phone as recent players.</p>

      <div className="voi-players">
        {players.map((p, i) => (
          <div key={p.id} className="voi-playerrow">
            <span className="voi-playerrow__n">{i + 1}.</span>
            <input
              className="voi-playerrow__name"
              value={p.name}
              aria-label={`Player ${i + 1} name`}
              onChange={(e) => setPlayers(players.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
            />
            <span className="voi-playerrow__ctrls">
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)} className="voi-mini">↑</button>
              <button type="button" aria-label="Move down" disabled={i === players.length - 1} onClick={() => swap(i, i + 1)} className="voi-mini">↓</button>
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPlayers(players.filter((x) => x.id !== p.id))} className="voi-mini voi-mini--danger">✕</button>
            </span>
          </div>
        ))}
      </div>

      <div className="voi-addrow">
        <input
          value={setupName}
          onChange={(e) => setSetupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(setupName); }}
          placeholder="player name…"
          className="voi-input"
          maxLength={18}
          aria-label="New player name"
        />
        <button type="button" className="voi-btn voi-btn--white" onClick={() => addPlayer(setupName)} disabled={players.length >= MAX_PLAYERS}>
          + ADD PLAYER
        </button>
      </div>

      {recentPlayers.filter((n) => !players.some((p) => p.name.toLowerCase() === n.toLowerCase())).length > 0 && (
        <div className="voi-recent">
          <p className="voi-label">RECENT PLAYERS</p>
          <div className="voi-recentchips">
            {recentPlayers
              .filter((n) => !players.some((p) => p.name.toLowerCase() === n.toLowerCase()))
              .slice(0, 10)
              .map((n) => (
                <button key={n} type="button" className="voi-chip" onClick={() => addPlayer(n)}>{n}</button>
              ))}
          </div>
        </div>
      )}

      <div className="voi-btnrow voi-btnrow--spread">
        <button type="button" className="voi-btn voi-btn--ghost" onClick={() => setPlayers([])} disabled={players.length === 0}>CLEAR</button>
        <button type="button" className="voi-btn voi-btn--ghost" onClick={onBack}>← BACK</button>
        <button type="button" className="voi-btn voi-btn--red" onClick={onStart} disabled={!valid}>
          START GAME →
        </button>
      </div>
      {!valid && players.length > 0 && players.length < MIN_PLAYERS && <p className="voi-warn">Add at least {MIN_PLAYERS - players.length} more player{MIN_PLAYERS - players.length > 1 ? 's' : ''}.</p>}
    </div>
  );
}

/* ------------------------------- settings -------------------------------- */

export function SettingsScreen({
  settings, onChange, onStart, onBack
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const n = settings.players.length;
  const maxImp = maxImposters(Math.max(n, MIN_PLAYERS));
  const errors = validateSettings(settings);

  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  const catOn = (id: string) => settings.categories.includes(id);
  const toggleCat = (id: string) => {
    if (id === 'random') {
      set({ categories: catOn('random') ? CATEGORIES.map((c) => c.id) : ['random'] });
      return;
    }
    const has = settings.categories.includes(id);
    let cats = has ? settings.categories.filter((c) => c !== id) : [...settings.categories, id];
    if (cats.length === 0) cats = ['random'];
    set({ categories: cats });
  };

  const diff = settings.difficulty;
  const timer = settings.timerSec;

  return (
    <div className="voi-settings">
      <h2 className="voi-h">GAME SETTINGS</h2>

      <section className="voi-setblock">
        <p className="voi-label">🕵️ IMPOSTERS</p>
        <div className="voi-chips">
          {[1, 2, 3, 4].filter((x) => x <= maxImp).map((x) => (
            <button
              key={x}
              type="button"
              className={`voi-chip ${settings.imposters === x && settings.chaos !== 'random' && settings.chaos !== 'custom' ? 'voi-chip--on' : ''}`}
              onClick={() => set({ imposters: x, chaos: settings.chaos === 'random' || settings.chaos === 'custom' ? 'off' : settings.chaos })}
            >
              {x}
            </button>
          ))}
          <button
            type="button"
            className={`voi-chip ${settings.chaos === 'custom' ? 'voi-chip--on' : ''}`}
            onClick={() => set({ chaos: 'custom' })}
          >
            CUSTOM
          </button>
          <button
            type="button"
            className={`voi-chip ${settings.chaos === 'random' || settings.imposters === 'random' ? 'voi-chip--on' : ''}`}
            onClick={() => set({ chaos: 'random' })}
          >
            🎲 RANDOM
          </button>
        </div>
        {settings.chaos === 'custom' && (
          <div className="voi-customrow">
            <span>Impossible imposers: </span>
            <input
              type="number"
              min={1}
              max={maxImp}
              value={settings.chaosCustomCount}
              onChange={(e) => set({ chaosCustomCount: Math.max(1, Math.min(maxImp, Number(e.target.value) || 1)) })}
              className="voi-input voi-input--num"
            />
            <span className="voi-fine">1–{maxImp} for {n} players</span>
          </div>
        )}
      </section>

      <section className="voi-setblock">
        <p className="voi-label">☠️ CHAOS MODE</p>
        <div className="voi-chips voi-chips--wrap">
          {(['off', 'all', 'none', 'random', 'custom'] as ChaosMode[]).map((c) => (
            <button key={c} type="button" className={`voi-chip ${settings.chaos === c ? 'voi-chip--on' : ''}`} onClick={() => set({ chaos: c })}>
              {CHAOS_LABEL[c]}
            </button>
          ))}
        </div>
      </section>

      <section className="voi-setblock">
        <p className="voi-label">🎯 CATEGORY <span className="voi-fine">(pick any mix)</span></p>
        <div className="voi-chips voi-chips--wrap">
          <button
            type="button"
            className={`voi-chip ${catOn('random') || settings.categories.length === 0 || settings.categories.length === CATEGORIES.length ? 'voi-chip--on' : ''}`}
            onClick={() => toggleCat('random')}
          >
            🎲 RANDOM
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`voi-chip ${!catOn('random') && catOn(c.id) ? 'voi-chip--on' : ''}`}
              onClick={() => toggleCat(c.id)}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="voi-setblock">
        <p className="voi-label">WORD DIFFICULTY</p>
        <div className="voi-chips">
          {(['easy', 'normal', 'hard', 'random'] as Difficulty[]).map((d) => (
            <button key={d} type="button" className={`voi-chip ${diff === d ? 'voi-chip--on' : ''}`} onClick={() => set({ difficulty: d })}>
              {d === 'easy' ? '🟢 EASY' : d === 'normal' ? '🟡 NORMAL' : d === 'hard' ? '🔴 HARD' : '🎲 RANDOM'}
            </button>
          ))}
        </div>
      </section>

      <section className="voi-setblock">
        <p className="voi-label">⏱️ DISCUSSION TIMER</p>
        <div className="voi-chips">
          {DISCUSSION_TIMER_CHOICES.map((t) => (
            <button key={t} type="button" className={`voi-chip ${timer === t ? 'voi-chip--on' : ''}`} onClick={() => set({ timerSec: t })}>
              {t === 0 ? 'OFF' : `${t}s`}
            </button>
          ))}
        </div>
      </section>

      <section className="voi-setblock">
        <p className="voi-label">🔴 IMPOSTER GUESS</p>
        <div className="voi-chips">
          <button type="button" className={`voi-chip ${settings.imposterGuess ? 'voi-chip--on' : ''}`} onClick={() => set({ imposterGuess: true })}>ON — last chance to steal it</button>
          <button type="button" className={`voi-chip ${!settings.imposterGuess ? 'voi-chip--on' : ''}`} onClick={() => set({ imposterGuess: false })}>OFF</button>
        </div>
      </section>

      <section className="voi-setblock">
        <p className="voi-label">💡 IMPOSTER HINT</p>
        <div className="voi-chips">
          <button type="button" className={`voi-chip ${settings.imposterHint ? 'voi-chip--on' : ''}`} onClick={() => set({ imposterHint: true })}>ON — imposters get a themed hint</button>
          <button type="button" className={`voi-chip ${!settings.imposterHint ? 'voi-chip--on' : ''}`} onClick={() => set({ imposterHint: false })}>OFF</button>
        </div>
        <p className="voi-fine">A related word from the same category (never the actual one) — helps imposters sound believable. Turn off for hardcore mode.</p>
      </section>

      <section className="voi-setblock">
        <p className="voi-label">🔄 ROUNDS</p>
        <div className="voi-chips">
          {[1, 3, 5].map((r) => (
            <button key={r} type="button" className={`voi-chip ${settings.rounds === r ? 'voi-chip--on' : ''}`} onClick={() => set({ rounds: r })}>{r}</button>
          ))}
        </div>
      </section>

      {errors.length > 0 && (
        <div className="voi-errors" role="alert">
          {errors.map((e) => <p key={e}>⚠️ {e}</p>)}
        </div>
      )}

      <div className="voi-btnrow voi-btnrow--spread">
        <button type="button" className="voi-btn voi-btn--ghost" onClick={onBack}>← BACK</button>
        <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onStart} disabled={errors.length > 0}>
          START GAME 🚀
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ pass/reveal ------------------------------ */

function RolePassScreen({
  player, number, total, cardShown, assignment, word, onShow, onNext
}: {
  player: Player;
  number: number;
  total: number;
  cardShown: boolean;
  assignment: RoleAssignment;
  word: WordPick | null;
  onShow: () => void;
  onNext: () => void;
}) {
  return (
    <div className="voi-screencenter">
      {!cardShown && (
        <div className={`voi-passcard ${number % 2 === 0 ? 'voi-passcard--alt' : ''}`}>
          <p className="voi-label">PLAYER {number} of {total}</p>
          <h2 className="voi-bigname">{player.name.toUpperCase()}</h2>
          <p className="voi-sub">Pass the phone to {player.name}. Make sure nobody else is looking.</p>
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onShow}>
            👁 REVEAL MY ROLE
          </button>
        </div>
      )}
      {cardShown && (
        <div className={`voi-rolecard ${assignment.isImposter ? 'voi-rolecard--imp' : 'voi-rolecard--inn'}`}>
          {assignment.isImposter ? (
            <>
              <span className="voi-rolecard__big">🔴 YOU ARE THE IMPOSTER</span>
              {assignment.knowsWord
                ? <p className="voi-rolecard__sub">…and you know the word. Resist every instinct to act normal.</p>
                : <p className="voi-rolecard__sub">You do NOT know the secret word.<br />Blend in. Listen carefully. Give believable clues. Give a small, unique, hard-to-guess hint of the word!</p>}
              {assignment.hint && !assignment.knowsWord && (
                <div className="voi-hint">
                  <span className="voi-label">YOUR THEME HINT</span>
                  <strong>{assignment.hint}</strong>
                  <p className="voi-fine">Not the word — just its neighborhood. Use it to sound believable.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="voi-rolecard__big">🟢 YOU ARE NOT THE IMPOSTER</span>
              {word ? (
                <>
                  <p className="voi-label">SECRET WORD</p>
                  <span className="voi-secretword">{word.word}</span>
                  <p className="voi-rolecard__sub">Remember it. ({word.categoryName})</p>
                </>
              ) : (
                <p className="voi-rolecard__sub">…but nobody is telling you why you can't see a word.</p>
              )}
            </>
          )}
          <button type="button" className="voi-btn voi-btn--white voi-btn--hero" onClick={onNext}>
            🙈 HIDE &amp; PASS PHONE
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ discussion ------------------------------- */

function DiscussScreen({
  players, round, timerLeft, timerSet, clueIdx, onReady, word
}: {
  players: Player[];
  round: number;
  timerLeft: number | null;
  timerSet: number;
  clueIdx: number;
  onReady: () => void;
  word: WordPick | null;
}) {
  const current = players[clueIdx];
  const done = clueIdx >= players.length;
  return (
    <div className="voi-screencenter">
      <div className="voi-hud">
        <span className="voi-hud__round">ROUND {round}</span>
        {timerSet > 0 && timerLeft !== null && (
          <span className={`voi-timer ${timerLeft <= 10 ? 'voi-timer--hot' : ''}`} role="timer">
            ⏱️ {timerLeft}s
          </span>
        )}
      </div>
      <p className="voi-label">DISCUSSION — {clueIdx + 1} of {players.length}</p>
      {!done && (
        <div className="voi-discusscard">
          <p className="voi-label">CURRENT PLAYER</p>
          <h2 className="voi-bigname" aria-live="polite">{current.name.toUpperCase()}</h2>
          <p className="voi-sub">Give your clue — one line, no spoilers if you're innocent, pure acting if you're not.</p>
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onReady}>✋ I'M READY</button>
        </div>
      )}
      {word && <p className="voi-fine">(Category on the table: {word.categoryName})</p>}
    </div>
  );
}

/* --------------------------------- voting -------------------------------- */

function VotePassScreen({
  voter, shown, onShow, onReady, round
}: {
  voter: Player;
  shown: boolean;
  onShow: () => void;
  onReady: () => void;
  round: number;
}) {
  void round;
  return (
    <div className="voi-screencenter">
      {!shown && (
        <div className="voi-passcard">
          <p className="voi-label">PASS THE PHONE — VOTER SECRECY</p>
          <h2 className="voi-bigname">{voter.name.toUpperCase()}</h2>
          <p className="voi-sub">Nobody may peek at this vote. Seriously.</p>
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onShow}>🗳️ I'M VOTING NOW</button>
        </div>
      )}
      {shown && (
        <div className="voi-passcard">
          <p className="voi-label">READY?</p>
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onReady}>SHOW MY BALLOT</button>
        </div>
      )}
    </div>
  );
}

function VoteScreen({
  voter, targets, onVote, word, roleShown
}: {
  voter: Player;
  targets: Player[];
  onVote: (t: string) => void;
  word: WordPick | null;
  roleShown: 'all' | 'none' | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  return (
    <div className="voi-vote">
      <div className="voi-discusscard">
        <p className="voi-label">🗳️ VOTE OUT IMPOSTER</p>
        <h2 className="voi-bigname">{voter.name.toUpperCase()}</h2>
        <p className="voi-sub">Who is the Imposter? One vote. No take-backs.</p>
      </div>
      <div className="voi-targets">
        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`voi-target ${selected === t.id ? 'voi-target--on' : ''} ${locked ? 'voi-target--locked' : ''}`}
            disabled={locked}
            onClick={() => setSelected(selected === t.id ? null : t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="voi-btn voi-btn--red voi-btn--hero"
        disabled={!selected || locked}
        onClick={() => { setLocked(true); if (selected) onVote(selected); }}
      >
        ✅ CONFIRM VOTE
      </button>
      {roleShown === 'all' && <p className="voi-fine">(In this chaos, everyone is suspicious — even you.)</p>}
      {roleShown === 'none' && <p className="voi-fine">(Somewhere an imposter is NOT reading this. 👀)</p>}
      {word && <p className="voi-fine">Reminder — category: {word.categoryName}</p>}
    </div>
  );
}

/* --------------------------------- results ------------------------------- */

function ResultsScreen({
  tally, players, onContinue, onRevote, eliminatedName
}: {
  tally: VoteTally;
  players: Player[];
  onContinue: () => void;
  onRevote: () => void;
  eliminatedName: string | null;
}) {
  const max = Math.max(1, ...Object.values(tally.counts));
  const total = Object.values(tally.counts).reduce((a, b) => a + b, 0);
  useEffect(() => { sfx('results' as never); }, []);
  return (
    <div className="voi-screencenter">
      <h2 className="voi-h">🗳️ RESULTS</h2>
      <div className="voi-results">
        {[...Object.entries(tally.counts)]
          .sort((a, b) => b[1] - a[1])
          .filter(([, n]) => n > 0 || total === 0)
          .map(([id, n]) => {
            const name = players.find((p) => p.id === id)?.name ?? id;
            const elim = tally.eliminatedId === id;
            return (
              <div key={id} className={`voi-resultrow ${elim ? 'voi-resultrow--elim' : ''}`}>
                <span className="voi-resultrow__name">{name}</span>
                <div className="voi-bar">
                  <span
                    className={`voi-bar__fill ${elim ? 'voi-bar__fill--elim' : ''}`}
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </div>
                <span className="voi-resultrow__n">{n}</span>
              </div>
            );
          })}
      </div>
      {tally.isTie ? (
        <div className="voi-card voi-tiecard">
          <h3>⚠️ TIE</h3>
          <p className="voi-sub">No one was eliminated. Nobody escapes democracy.</p>
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onRevote}>🔁 REVOTE</button>
        </div>
      ) : eliminatedName ? (
        <div className="voi-card voi-elimcard">
          <p className="voi-label">ELIMINATED</p>
          <h3 className="voi-bigname">{eliminatedName.toUpperCase()}</h3>
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onContinue}>🔎 REVEAL ROLE →</button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- elim reveal ----------------------------- */

function ElimRevealScreen({
  name, wasImposter, chaos, impostersLeft, onContinue, hasGuess
}: {
  name: string;
  wasImposter: boolean;
  chaos: ChaosMode;
  impostersLeft: number;
  onContinue: () => void;
  hasGuess: boolean;
}) {
  return (
    <div className="voi-screencenter">
      <div className={`voi-rolecard ${wasImposter ? 'voi-rolecard--imp' : 'voi-rolecard--inn'}`}>
        {chaos === 'all' ? (
          <>
            <span className="voi-rolecard__big">☠️ CHAOS REVEAL</span>
            <p className="voi-rolecard__sub"><strong>EVERYONE WAS THE IMPOSTER.</strong> 💀</p>
            <p className="voi-rolecard__sub">Nobody ever had the word. {name} fell for your lie.</p>
          </>
        ) : chaos === 'none' ? (
          <>
            <span className="voi-rolecard__big">😂 NO IMPOSTER!</span>
            <p className="voi-rolecard__sub">EVERYONE HAD THE WORD.</p>
            <p className="voi-rolecard__sub">You just voted {name} out anyway. Democracy is merciless.</p>
          </>
        ) : wasImposter ? (
          <>
            <span className="voi-rolecard__big">🎯 {name.toUpperCase()} WAS...</span>
            <span className="voi-rolecard__stamp voi-rolecard__stamp--imp">🔴 THE IMPOSTER</span>
            {impostersLeft === 0 ? (
              <p className="voi-rolecard__sub">That was the last one. Justice lands.</p>
            ) : (
              <p className="voi-rolecard__sub">IMPOSTERS REMAINING: {impostersLeft}</p>
            )}
            {hasGuess && <p className="voi-rolecard__sub">But wait — an eliminated imposter gets one shot at stealing the win…</p>}
          </>
        ) : (
          <>
            <span className="voi-rolecard__big">❌ WRONG!</span>
            <span className="voi-rolecard__stamp">{name.toUpperCase()} WAS NOT AN IMPOSTER.</span>
            <p className="voi-rolecard__sub">You doomed an innocent. {name} will remember this.</p>
            <p className="voi-rolecard__sub">IMPOSTERS REMAINING: {impostersLeft}</p>
          </>
        )}
        <button type="button" className="voi-btn voi-btn--white voi-btn--hero" onClick={onContinue}>
          {chaos !== 'off' ? '☠️ FINISH' : wasImposter && hasGuess ? '🔴 FINAL CHANCE →' : '▶ CONTINUE'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ imposter guess ---------------------------- */

function GuessScreen({
  guess, setGuess, feedback, correctWord, onSubmit
}: {
  guess: string;
  setGuess: (g: string) => void;
  feedback: 'null' | 'right' | 'wrong';
  correctWord: string;
  onSubmit: () => void;
}) {
  return (
    <div className="voi-screencenter">
      {feedback === 'null' && (
        <div className="voi-card voi-guesscard">
          <h2>🔴 FINAL CHANCE</h2>
          <p className="voi-sub">You were caught. Guess the secret word to steal the win.</p>
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
            className="voi-input"
            placeholder="the secret word was…"
            autoFocus
          />
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onSubmit} disabled={!guess.trim()}>
            SUBMIT GUESS
          </button>
        </div>
      )}
      {feedback === 'right' && (
        <div className="voi-rolecard voi-rolecard--imp">
          <span className="voi-rolecard__big">🔥 IMPOSTER WINS</span>
          <p className="voi-rolecard__sub">YOU GUESSED THE WORD: <strong>{correctWord}</strong></p>
        </div>
      )}
      {feedback === 'wrong' && (
        <div className="voi-rolecard voi-rolecard--inn">
          <span className="voi-rolecard__big">❌ WRONG</span>
          <p className="voi-rolecard__sub">THE SECRET WORD WAS: <strong>{correctWord}</strong></p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- round end ------------------------------- */

function RoundEndScreen({
  round, rounds, wins, winner, onNext
}: {
  round: number;
  rounds: number;
  wins: { impWins: number; innWins: number };
  winner: Winner | null;
  onNext: () => void;
}) {
  const label = winner === 'innocents' || winner === 'chaos-none'
    ? '🟢 INNOCENTS WIN'
    : winner === 'imposters' || winner === 'steal'
      ? '🔴 IMPOSTERS WIN'
      : '☠️ CHAOS';
  return (
    <div className="voi-screencenter">
      <div className="voi-card voi-roundcard">
        <h2>ROUND {round} DONE</h2>
        <p className="voi-roundcard__stamp">{label}</p>
        <p className="voi-sub">
          {wins.innWins}× innocents · {wins.impWins}× imposters — {rounds - wins.impWins - wins.innWins} round(s) to go
        </p>
        <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onNext}>
          ▶ NEXT ROUND
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- summary -------------------------------- */

function SummaryScreen({
  wins, stats, settings, onPlayAgain, onHome
}: {
  wins: { impWins: number; innWins: number };
  stats: PlayerStats[];
  settings: GameSettings;
  onPlayAgain: () => void;
  onHome: () => void;
}) {
  const winnerLabel = wins.impWins > wins.innWins
    ? 'IMPOSTERS'
    : wins.innWins > wins.impWins
      ? 'INNOCENTS'
      : 'CHAOS &amp; LAUGHTER';
  const most = mostVoted(stats);
  const best = bestImposter(stats);
  return (
    <div className="voi-screencenter">
      <div className="voi-card voi-summary">
        <h2>🏆 GAME COMPLETE</h2>
        <p className="voi-summary__winner">WINNER: <strong>{winnerLabel}</strong></p>
        <div className="voi-summary__grid">
          <div><span>Rounds</span><b>{settings.rounds}</b></div>
          <div><span>Imposter Wins</span><b>{wins.impWins}</b></div>
          <div><span>Innocent Wins</span><b>{wins.innWins}</b></div>
        </div>
        {most && most.votesReceived > 0 && <p className="voi-meta">MOST VOTED: <strong>{most.name}</strong> — {most.votesReceived} vote{most.votesReceived > 1 ? 's' : ''}</p>}
        {best && <p className="voi-meta">BEST IMPOSTER: <strong>{best.name}</strong> — {best.imposterWins} sneaky win{best.imposterWins > 1 ? 's' : ''}</p>}
        <div className="voi-btnrow voi-btnrow--spread">
          <button type="button" className="voi-btn voi-btn--red voi-btn--hero" onClick={onPlayAgain}>
            🔄 PLAY AGAIN
          </button>
          <button type="button" className="voi-btn voi-btn--ghost" onClick={onHome}>🏠 GAME HOME</button>
        </div>
        <p className="voi-fine">Same players, same settings — only the word and the traitor refresh.</p>
      </div>
    </div>
  );
}

/* --------------------------------- stats ---------------------------------- */

function StatsScreen({ stats, onBack }: { stats: PlayerStats[]; onBack: () => void }) {
  const sorted = [...stats].sort((a, b) => b.games - a.games);
  return (
    <div className="voi-screencenter">
      <div className="voi-card voi-statstable">
        <h2>🏆 HALL OF FAME</h2>
        <p className="voi-fine">Cumulative across all games on this device.</p>
        {sorted.length === 0 && <p className="voi-sub">No games yet. The hall echoes.</p>}
        {sorted.length > 0 && (
          <table>
            <thead>
              <tr><th>Player</th><th>Games</th><th>Imp W</th><th>Inn W</th><th>Votes</th><th>Outed</th><th>🎭</th></tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.games}</td>
                  <td>{s.imposterWins}</td>
                  <td>{s.innocentWins}</td>
                  <td>{s.votesReceived}</td>
                  <td>{s.timesVotedOut}</td>
                  <td>{s.timesImposter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" className="voi-btn voi-btn--ghost" onClick={onBack}>← BACK</button>
      </div>
    </div>
  );
}
