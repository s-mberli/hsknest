"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Copy, Minus, Play, Pause, Plus, Volume2, X } from "lucide-react";
import Link from "next/link";
import { stripTranslationCruft } from "@/lib/hskTransform";
import { DEFAULT_READER_FONT_SIZE, READER_FONT_SIZES, readerFontSizeIndex } from "@/lib/reading/fontSize";
import { findSentenceForMark, findSentenceForToken, sentenceSurface } from "@/lib/reading/sentences";
import type { StoryTimings } from "@/lib/reading/storyAudio";

import { ReaderSettings, Prefs } from "./ReaderSettings";

/* ── Types ─────────────────────────────────────────────────── */

interface StoryToken {
  s: number;
  e: number;
  w: string;
  py: string | null;
  lvl: number | null;
  senses: { pinyin: string; meanings: string[] }[] | null;
  isPunct: boolean;
  sentence: number;
}

interface HydratedText {
  v: 1;
  chars: number;
  tokens: StoryToken[];
  sentences: { t0: number; t1: number; en?: string }[];
  words: { total: number; unique: number };
}

/** Shape of the narration sidecar; resolved server-side (see storyAudio.ts). */
type TimingsFile = StoryTimings;

interface ReaderViewProps {
  textId: string;
  slug: string;
  title: string;
  titleEn: string | null;
  level: number;
  topic: string | null;
  topicEn: string | null;
  hydrated: Record<string, unknown> | null;
  audioUrl: string | null;
  /** Parsed server-side and passed down — no client fetch, no loading race. */
  timings: TimingsFile | null;
  estimatedMin: number | null;
  languageId: string;
  initialScrollPct?: number;
}

/* ── Constants ──────────────────────────────────────────────── */

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];
const PY_LABEL: Record<Prefs["pinyinMode"], string> = { full: "Pinyin", off: "汉字", adaptive: "Auto" };
const LONG_PRESS_MS = 450;
const SWIPE_UP_PX = 30;

function fmt(sec: number) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, "0")}`; }
/** Strip parenthetical notes, bound forms, compound examples for hover popup. Max 40 chars. */
function cleanForDisplay(m: string): string {
  return m
    .replace(/\(.*?\)/g, "")    // strip (…) parentheticals
    .replace(/\[.*?\]/g, "")    // strip [tā rì4] transliterations
    .replace(/;?\s*etc\.?$/i, "")
    .replace(/;\s*$/, "")
    .trim()
    .slice(0, 40);
}

/* ── Component ──────────────────────────────────────────────── */

export function ReaderView({ textId, slug, title, titleEn, level, topic, topicEn, hydrated, audioUrl, timings, estimatedMin, languageId, initialScrollPct }: ReaderViewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeMark, setActiveMark] = useState(-1);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [audioReady, setAudioReady] = useState(false);
  const rafRef = useRef(0);

  const [selectedToken, setSelectedToken] = useState<StoryToken | null>(null);
  const [encounterCounts, setEncounterCounts] = useState<Record<string, number>>({});
  const [encounteredTokens, setEncounteredTokens] = useState<Map<string, StoryToken>>(new Map());
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [nudgeWord, setNudgeWord] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showBatchPrompt, setShowBatchPrompt] = useState(false);
  const [batchPromptDismissed, setBatchPromptDismissed] = useState(false);
  const [batchAdding, setBatchAdding] = useState(false);

  // Deterministic initial state — matches ReaderSettings' `defaults` exactly
  // — so server and the first client render agree. `localStorage` can't be
  // read on the server, so seeding state from it here (as this used to do
  // via `typeof window !== "undefined"`) produces a real value on the client
  // and the placeholder on the server; React's hydration diff catches the
  // mismatch but, per its own warning, "won't be patched up" — the DOM keeps
  // the server value permanently. A reader with any saved preference (most
  // readers, on their second story) would be silently stuck on the default
  // until they touched a control. Instead, mount plain, then load the real
  // prefs in an effect below (client-only, after hydration, so no mismatch).
  const [pinyinMode, setPinyinMode] = useState<Prefs["pinyinMode"]>("full");
  const [fontSize, setFontSize] = useState<number>(DEFAULT_READER_FONT_SIZE);
  const [speed, setSpeed] = useState<number>(1.0);
  const [showTranslations, setShowTranslations] = useState<boolean>(false);
  const [hskUnderline, setHskUnderline] = useState<boolean>(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [knownWords, setKnownWords] = useState<Map<string, string>>(new Map());
  const [actionMenu, setActionMenu] = useState<{ x: number; y: number; token: StoryToken } | null>(null);

  const completedRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);
  const [hoverToken, setHoverToken] = useState<StoryToken | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doc = hydrated as HydratedText | null;

  /* restore scroll position on mount */
  useEffect(() => {
    if (!doc || !textRef.current || !initialScrollPct || initialScrollPct < 5) return;
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = (initialScrollPct / 100) * max;
    });
  }, [doc, initialScrollPct]);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); }, []);

  /* ── data loading ─────────────────────────────────────────── */
  useEffect(() => { fetch("/api/reading/known-words").then(r => r.ok ? r.json() : null).then(d => { if (d?.known) setKnownWords(new Map(d.known.map((k: { lemma: string; strength: string }) => [k.lemma, k.strength]))); }).catch(() => {}); }, []);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    const ok = () => setAudioReady(true);
    const fail = () => setAudioReady(false);
    const end = () => setPlaying(false);
    ["canplay", "canplaythrough", "loadeddata", "loadedmetadata"].forEach(e => audio.addEventListener(e, ok, { once: true }));
    audio.addEventListener("error", fail, { once: true });
    audio.addEventListener("ended", end);
    audio.src = `${(process.env.NEXT_PUBLIC_AUDIO_BASE_URL ?? "")}/${audioUrl}`;
    audio.load();
    const fb = setTimeout(() => { if (audio.readyState > 0) setAudioReady(true); }, 4000);
    return () => { clearTimeout(fb); audio.pause(); audioRef.current = null; };
  }, [audioUrl]);

  /* karaoke rAF */
  useEffect(() => {
    if (!playing) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const audio = audioRef.current;
      if (audio && timings) {
        const t = audio.currentTime * 1000;
        setCurrentTime(t);
        let fm = -1;
        for (let i = 0; i < timings.marks.length; i++) { const m = timings.marks[i]; if (t >= m.t0 && t <= m.t1) { fm = i; break; } }
        setActiveMark(fm);
        if (doc && fm >= 0) { const mk = timings.marks[fm]; setActiveSentence(findSentenceForMark(doc, mk)); }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [playing, timings, doc]);

  useEffect(() => { if (activeSentence < 0 || !playing || !textRef.current) return; const el = textRef.current.querySelector(`[data-sentence="${activeSentence}"]`); el?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [activeSentence, playing]);

  useEffect(() => {
    if (!doc) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(() => { const el = textRef.current; if (!el) return; const max = el.scrollHeight - el.clientHeight; const completed = max > 0 && el.scrollTop / max >= 0.95; if (completed && !completedRef.current) { completedRef.current = true; setShowBatchPrompt(true); } fetch("/api/reading/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ textId, position: max > 0 ? Math.round((el.scrollTop / max) * 100) : 0, completed }) }).catch(() => {}); }, 2000); };
    const el = textRef.current; el?.addEventListener("scroll", onScroll, { passive: true });
    return () => { el?.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, [doc, textId]);

  /* session tracking: one POST per visit (mount -> leave), reporting elapsed
   * wall-clock time and whether the 95% scroll-completion threshold was hit.
   * Fires on tab-hide/navigate-away (pagehide/visibilitychange) as well as
   * unmount, since a SPA route change doesn't always unmount in time for a
   * plain cleanup-effect fetch to land — keepalive lets it survive either. */
  useEffect(() => {
    // Reset after each send so a hide/show/hide cycle (e.g. briefly
    // switching tabs to check a dictionary) reports sequential increments
    // that sum to true total time, rather than either truncating the
    // session at the first hide or double-counting on the final unmount.
    let segmentStart = Date.now();
    const sendSession = () => {
      const now = Date.now();
      const durationMs = now - segmentStart;
      segmentStart = now;
      if (durationMs < 1000) return; // instant bounce, not a real visit/segment
      try {
        fetch("/api/reading/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ textId, durationMs, completed: completedRef.current }),
        }).catch(() => {});
      } catch { /* keepalive fetch can throw synchronously if the payload is too large; nothing to do */ }
    };
    const onHide = () => { if (document.visibilityState === "hidden") sendSession(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", sendSession);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", sendSession);
      sendSession();
    };
  }, [textId]);

  /* ── actions ──────────────────────────────────────────────── */
  const togglePlay = useCallback(() => { const a = audioRef.current; if (!a || !audioReady) return; if (playing) a.pause(); else a.play().catch(() => setAudioReady(false)); setPlaying(!playing); }, [playing, audioReady]);
  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => { const a = audioRef.current; if (!a || !timings) return; const r = e.currentTarget.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); a.currentTime = p * (timings.durationMs / 1000); setCurrentTime(p * timings.durationMs); }, [timings]);
  const tokenTimeMs = useCallback((tk: StoryToken): number | null => { if (!timings) return null; const mk = timings.marks.find(m => m.s >= tk.s && m.s < tk.e); return mk ? mk.t0 : null; }, [timings]);

  const logEncounter = useCallback((tok: StoryToken) => {
    fetch("/api/reading/encounter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lemma: tok.w, languageId }) })
      .then(r => r.ok ? r.json() : null).then(d => { if (!d) return; setEncounterCounts(c => ({ ...c, [tok.w]: d.lookups })); if (d.nudge) setNudgeWord(tok.w); }).catch(() => {});
  }, [languageId]);

  const addToDeck = useCallback(async (tok: StoryToken) => {
    // Find the sentence this token belongs to
    const sentIdx = doc ? findSentenceForToken(doc, tok) : -1;
    const sentence = sentIdx >= 0 && doc ? sentenceSurface(doc, sentIdx) : undefined;

    try {
      const res = await fetch("/api/reading/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lemma: tok.w, languageId, pinyin: tok.py ?? undefined,
          level: tok.lvl ?? undefined, sentence, storySlug: slug,
        }),
      });
      if (!res.ok) { showToast("Could not add"); return; }
      setAddedWords(s => new Set(s).add(tok.w));
      showToast(`${tok.w} added to deck`);
    } catch { showToast("Could not add"); }
  }, [languageId, showToast, doc, slug]);

  /** Words looked up this session that aren't already in the deck (or known) — the batch-add candidate pool. */
  const unaddedLookups = [...encounteredTokens.values()].filter(
    tk => !addedWords.has(tk.w) && !knownWords.has(tk.w)
  );

  const addAllToDeck = useCallback(async () => {
    if (unaddedLookups.length === 0) { setShowBatchPrompt(false); return; }
    setBatchAdding(true);
    try {
      const items = unaddedLookups.map(tk => {
        const sentIdx = doc ? findSentenceForToken(doc, tk) : -1;
        const sentence = sentIdx >= 0 && doc ? sentenceSurface(doc, sentIdx) : undefined;
        return { lemma: tk.w, pinyin: tk.py ?? undefined, level: tk.lvl ?? undefined, sentence };
      });
      const res = await fetch("/api/reading/deck/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, storySlug: slug, items }),
      });
      if (!res.ok) { showToast("Could not add words"); return; }
      const data = await res.json() as { added: number; alreadyTracked: number };
      setAddedWords(s => { const next = new Set(s); for (const tk of unaddedLookups) next.add(tk.w); return next; });
      showToast(data.added > 0 ? `${data.added} word${data.added === 1 ? "" : "s"} added to deck` : "Already in deck");
    } catch { showToast("Could not add words"); }
    finally { setBatchAdding(false); setShowBatchPrompt(false); }
  }, [unaddedLookups, doc, languageId, slug, showToast]);

  const handleWordTap = useCallback((tk: StoryToken) => {
    if (tk.isPunct) return;
    if (playing) { const t = tokenTimeMs(tk); if (t !== null && audioRef.current) { audioRef.current.currentTime = t / 1000; return; } }
    setSelectedToken(tk);
    setEncounteredTokens(m => (m.has(tk.w) ? m : new Map(m).set(tk.w, tk)));
    logEncounter(tk);
  }, [playing, tokenTimeMs, logEncounter]);

  /* ── gesture handlers ─────────────────────────────────────── */
  const clearLP = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const onTouchStart = (e: React.TouchEvent, tk: StoryToken) => { if (tk.isPunct) return; const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; longPressFired.current = false; clearLP(); longPressTimer.current = setTimeout(() => { longPressFired.current = true; if (navigator.vibrate) navigator.vibrate(10); }, LONG_PRESS_MS); };
  const onTouchMove = (e: React.TouchEvent, tk: StoryToken) => { if (!touchStart.current || !longPressFired.current) return; const t = e.touches[0]; if (touchStart.current.y - t.clientY > SWIPE_UP_PX) { clearLP(); setSelectedToken(null); setActionMenu({ x: t.clientX, y: t.clientY - 60, token: tk }); } };
  // preventDefault on the short-press path stops the browser from also
  // firing a compatibility `click` afterward — without it, the touch state
  // machine's tap/long-press decision was racing an unconditional onClick
  // on the same span, and outcomes varied by device/browser depending on
  // which one "won". Touch devices now resolve entirely through this path;
  // onClick remains for mouse/pointer input, which never fires touch events.
  const onTouchEnd = (e: React.TouchEvent, tk: StoryToken) => { const was = longPressFired.current; clearLP(); touchStart.current = null; if (!was) { e.preventDefault(); handleWordTap(tk); } };
  const onContextMenu = (e: React.MouseEvent, tk: StoryToken) => { if (tk.isPunct) return; e.preventDefault(); setActionMenu({ x: e.clientX, y: e.clientY - 60, token: tk }); };

  /* ── prefs ────────────────────────────────────────────────── */
  const prefs = { pinyinMode, fontSize, speed, showTranslations, hskUnderline };
  // `updatePrefs` saves through this ref rather than through a separate
  // "auto-save on any prefs change" effect. That was tried first and had a
  // real race: on mount, the "sync from storage" effect below calls
  // setFontSize etc, which doesn't apply until the next render — but a
  // save-effect declared after it still fires in the SAME initial effect
  // flush, using the pre-update closure (the plain defaults), and writes
  // them over the just-loaded real value. React 18 dev double-invokes
  // effects on mount, which made this reliably reproduce: logged sequence
  // was sync-effect loads {fontSize:25} → stale save-effect immediately
  // writes {fontSize:31} back over it. Mutating the ref inside `updatePrefs`
  // itself (below) makes every write use the value at the moment of the
  // call, not a stale render's closure — this effect just keeps the ref
  // current for reads that don't go through `updatePrefs`.
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  const updatePrefs = useCallback((p: Partial<Prefs>) => {
    if (p.fontSize !== undefined) setFontSize(p.fontSize);
    if (p.pinyinMode !== undefined) setPinyinMode(p.pinyinMode);
    if (p.speed !== undefined) { setSpeed(p.speed); if (audioRef.current) audioRef.current.playbackRate = p.speed; }
    if (p.showTranslations !== undefined) setShowTranslations(p.showTranslations);
    if (p.hskUnderline !== undefined) setHskUnderline(p.hskUnderline);
    const merged = { ...prefsRef.current, ...p };
    prefsRef.current = merged;
    Prefs.save(merged);
  }, []);
  // Client-only, post-hydration: loads the real saved prefs over the plain
  // defaults state mounted with (localStorage can't be read on the server —
  // see the comment on the useState block above). Runs once on mount.
  useEffect(() => {
    const saved = Prefs.load();
    // updatePrefs doesn't re-validate speed (the useState initializer used
    // to); a foreign/stale stored value must still fall back here.
    // Reacting to an external system (localStorage, which the server can't
    // read at all) becoming available post-hydration, not deriving state
    // from props/state — the case this lint rule is meant to exempt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePrefs({ ...saved, speed: SPEEDS.includes(saved.speed) ? saved.speed : 1.0 });
  }, [updatePrefs]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed, audioReady]);

  if (!doc) return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-muted-foreground">Loading…</p></main>;

  const markToToken = (mi: number): number => { if (!timings || mi < 0) return -1; const mk = timings.marks[mi]; for (let i = 0; i < doc.tokens.length; i++) { const tk = doc.tokens[i]; if (tk.s === mk.s || (tk.s <= mk.s && tk.e > mk.s)) return i; } return -1; };
  const activeTokenIdx = markToToken(activeMark);
  const sentGroups: StoryToken[][] = doc.sentences.map(s => doc.tokens.slice(s.t0, Math.min(s.t1, doc.tokens.length)));
  const showRubyFor = (tk: StoryToken) => pinyinMode === "full" || (pinyinMode === "adaptive" && !knownWords.has(tk.w) && !addedWords.has(tk.w));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 py-2">
          <Link href={`/reading/${slug}`} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="size-5" /></Link>
          <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-semibold">{titleEn ?? title}</h1><p className="text-[11px] text-muted-foreground">HSK {level}{topicEn ? ` · ${topicEn}` : topic ? ` · ${topic}` : ""}{estimatedMin ? ` · ~${estimatedMin} min` : ""}</p></div>
          <button aria-label="Decrease text size" onClick={() => setFontSize(s => READER_FONT_SIZES[Math.max(0, readerFontSizeIndex(s) - 1)])} className="rounded p-1 text-muted-foreground hover:text-foreground"><Minus className="size-4" /></button>
          <button aria-label="Increase text size" onClick={() => setFontSize(s => READER_FONT_SIZES[Math.min(READER_FONT_SIZES.length - 1, readerFontSizeIndex(s) + 1)])} className="rounded p-1 text-muted-foreground hover:text-foreground"><Plus className="size-4" /></button>
          <button onClick={() => setPinyinMode(m => m === "full" ? "off" : m === "off" ? "adaptive" : "full")} className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">{PY_LABEL[pinyinMode]}</button>
          <button aria-label="Reading settings" onClick={() => setSettingsOpen(true)} className="rounded p-1.5 text-muted-foreground hover:text-foreground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        </div>
      </header>

      <main ref={textRef} className="mx-auto w-full max-w-[640px] flex-1 overflow-y-auto px-5 pt-5 pb-40">
        <div className={showTranslations ? "space-y-5" : "leading-[2.1]"} style={{ fontSize: `${fontSize}px`, fontFamily: "var(--font-reader)" }}>
          {sentGroups.map((stks, si) => {
            const en = doc.sentences[si]?.en;
            const isActive = activeSentence === si;
            return (
              <div key={si} data-sentence={si} className={showTranslations ? "border-l-2 border-transparent hover:border-primary/20 pl-3 transition-colors" : "mb-3 last:mb-0"}>
                {showTranslations && en && <p className={`mb-0.5 text-[0.7em] leading-snug font-medium ${isActive ? "text-foreground/80" : "text-muted-foreground/70"}`}>{en}</p>}
                <span className={showTranslations ? "block leading-[2.1]" : ""}>
                  {stks.map(tk => {
                    const gi = doc.tokens.indexOf(tk);
                    const isAW = gi === activeTokenIdx;
                    const isAS = activeSentence >= 0 && doc.sentences[activeSentence] && gi >= doc.sentences[activeSentence].t0 && gi < doc.sentences[activeSentence].t1;
                    const isKnown = knownWords.has(tk.w) || addedWords.has(tk.w);
                    const strength = knownWords.get(tk.w);
                    const isGrowing = strength === "growing";
                    const isShaky = strength === "shaky";
                    const isMastered = strength === "mastered";
                    const isSel = selectedToken?.s === tk.s && selectedToken?.e === tk.e;
                    const isNew = hskUnderline && tk.lvl !== null && tk.lvl >= level && !isKnown;
                    return (
                      <span key={`${tk.s}-${tk.e}`} className={`cursor-pointer rounded-sm transition-colors duration-75 select-none touch-manipulation [-webkit-touch-callout:none] ${isAW ? "bg-primary/25" : isAS ? "bg-primary/8" : isSel ? "border-b-2 border-dotted border-primary" : ""} ${isMastered ? "text-foreground/40" : isKnown ? "text-foreground/60" : ""} ${isGrowing ? "bg-amber/10" : ""} ${isShaky ? "underline decoration-amber decoration-1 underline-offset-[6px]" : ""} ${isNew ? "underline decoration-primary/40 decoration-1 underline-offset-[6px]" : ""}`}
                        onClick={() => handleWordTap(tk)}
                        onMouseEnter={() => { if (tk.isPunct) return; clearTimeout(hoverTimer.current!); hoverTimer.current = setTimeout(() => { if (!selectedToken && !actionMenu) setHoverToken(tk); }, 200); }}
                        onMouseLeave={() => { clearTimeout(hoverTimer.current!); hoverTimer.current = setTimeout(() => setHoverToken(null), 100); }}
                        onTouchStart={e => onTouchStart(e, tk)} onTouchMove={e => onTouchMove(e, tk)} onTouchEnd={e => onTouchEnd(e, tk)} onContextMenu={e => onContextMenu(e, tk)}>
                        {showRubyFor(tk) && tk.py && !tk.isPunct ? <ruby>{tk.w}<rt>{tk.py}</rt></ruby> : tk.w}
                      </span>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </main>

      {selectedToken && !selectedToken.isPunct && (() => {
        const saved = addedWords.has(selectedToken.w);
        const cnt = encounterCounts[selectedToken.w];
        return (
          <>
            <div className="fixed inset-0 z-39" onClick={() => setSelectedToken(null)} />
            <div className="fixed bottom-16 inset-x-0 z-40 mx-auto max-w-2xl px-3">
            <div className="rounded-2xl border bg-card px-4 pt-3 pb-4 shadow-xl">
              <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-muted" />
              <div className="flex items-baseline gap-2.5 mb-2">
                <span className="text-2xl font-bold">{selectedToken.w}</span>
                {selectedToken.py && <span className="text-sm text-muted-foreground">{selectedToken.py}</span>}
                {selectedToken.lvl && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">HSK {selectedToken.lvl}</span>}
                {saved && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">In deck ✓</span>}
              </div>
              {selectedToken.senses && selectedToken.senses.length > 0 ? (
                <div className="mb-3 space-y-0.5">{selectedToken.senses.flatMap((s, si2) => s.meanings.slice(0, 3).map((m, j) => { const c = stripTranslationCruft(m); return c ? <p key={`${si2}-${j}`} className="text-sm text-muted-foreground">{c}</p> : null; })).filter(Boolean)}</div>
              ) : <p className="mb-3 text-sm text-muted-foreground italic">No dictionary entry</p>}
              <div>
                {!saved ? <button onClick={() => addToDeck(selectedToken)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add to vocabulary</button> : <span className="rounded-lg bg-success/15 px-4 py-2 text-sm font-medium text-success">Added ✓</span>}
              </div>
              {nudgeWord === selectedToken.w && cnt !== undefined && cnt >= 3 && !saved && <p className="mt-2 text-xs text-primary">Looked up {cnt}× — add it to your deck?</p>}
            </div>
            </div>
          </>
        );
      })()}

      {actionMenu && (<>
        <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
        <div className="fixed z-50 flex flex-col gap-1 rounded-xl border bg-card p-1.5 shadow-xl" style={{ left: Math.min(actionMenu.x - 60, (typeof window !== "undefined" ? window.innerWidth : 400) - 150), top: Math.max(actionMenu.y, 80) }}>
          <button onClick={() => { addToDeck(actionMenu.token); setActionMenu(null); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent text-left"><Bookmark className="size-4 text-primary" /> Save to deck</button>
          <button onClick={() => { navigator.clipboard?.writeText(actionMenu.token.w); showToast("Copied"); setActionMenu(null); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent text-left"><Copy className="size-4 text-muted-foreground" /> Copy</button>
          <button onClick={() => setActionMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent text-left"><X className="size-4" /> Cancel</button>
        </div>
      </>)}

      {/* Post-read batch add: fires once, the first time scroll crosses 95%. */}
      {showBatchPrompt && !batchPromptDismissed && unaddedLookups.length > 0 && !selectedToken && (
        <>
          <div className="fixed inset-0 z-39" onClick={() => { setShowBatchPrompt(false); setBatchPromptDismissed(true); }} />
          <div className="fixed bottom-16 inset-x-0 z-40 mx-auto max-w-2xl px-3">
            <div className="rounded-2xl border bg-card px-4 pt-3 pb-4 shadow-xl">
              <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-muted" />
              <p className="mb-3 text-sm font-medium">
                Nice job! You looked up {unaddedLookups.length} word{unaddedLookups.length === 1 ? "" : "s"} — add {unaddedLookups.length === 1 ? "it" : "them all"} to your deck?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={addAllToDeck}
                  disabled={batchAdding}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {batchAdding ? "Adding…" : `Add all ${unaddedLookups.length}`}
                </button>
                <button
                  onClick={() => { setShowBatchPrompt(false); setBatchPromptDismissed(true); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {hoverToken && !hoverToken.isPunct && !selectedToken && !actionMenu && (() => {
        const firstMeaning = hoverToken.senses?.[0]?.meanings?.[0] ?? "";
        const display = cleanForDisplay(firstMeaning);
        return (
          <div className="fixed bottom-16 inset-x-0 z-38 mx-auto max-w-2xl px-3 pointer-events-none">
            <div className="rounded-xl border bg-card px-3 py-2 shadow-lg inline-block max-w-xs">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-lg font-bold">{hoverToken.w}</span>
                {hoverToken.py && <span className="text-xs text-muted-foreground">{hoverToken.py}</span>}
                {hoverToken.lvl && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">HSK {hoverToken.lvl}</span>}
              </div>
              {display && <p className="text-xs text-muted-foreground">{display}</p>}
            </div>
          </div>
        );
      })()}

      {audioUrl && audioReady && (
        <div className="fixed bottom-16 inset-x-0 z-20 mx-auto max-w-2xl px-3 pb-1">
          <div className="flex items-center gap-3 rounded-2xl border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <button onClick={togglePlay} className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0" aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}</button>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={seek}><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: timings ? `${(currentTime / timings.durationMs) * 100}%` : "0%" }} /></div></div>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{fmt(currentTime / 1000)}{timings ? ` / ${fmt(timings.durationMs / 1000)}` : ""}</span>
            <button onClick={() => { const next = SPEEDS[(SPEEDS.indexOf(speed) - 1 + SPEEDS.length) % SPEEDS.length]; updatePrefs({ speed: next }); }} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors shrink-0"><Volume2 className="size-3.5" />×{speed}</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-28 inset-x-0 z-50 flex justify-center pointer-events-none"><div className="rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow-lg">{toast}</div></div>}
      <ReaderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} prefs={prefs} onChange={updatePrefs} />
    </div>
  );
}
