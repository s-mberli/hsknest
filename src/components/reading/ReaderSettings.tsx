"use client";

import { DEFAULT_READER_FONT_SIZE, READER_FONT_SIZES, readerFontSizeIndex, snapReaderFontSize } from "@/lib/reading/fontSize";

/* ── Reader preferences (persisted to localStorage) ──────── */

export type Prefs = {
  pinyinMode: "full" | "off" | "adaptive";
  fontSize: number;
  speed: number;
  showTranslations: boolean;
  hskUnderline: boolean;
};

const KEY = "hn-reader-prefs";
const defaults: Prefs = { pinyinMode: "full", fontSize: DEFAULT_READER_FONT_SIZE, speed: 1.0, showTranslations: true, hskUnderline: true };

export const Prefs = {
  load: (): Prefs => {
    try {
      const parsed = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
      // Snap here, not just in the settings drawer: a value saved under the
      // old 16-28 range (or any other stale/foreign value) must resolve to a
      // real rung as soon as it's read, so ReaderView's initial render is
      // correct too, not just the slider once it's opened.
      return { ...parsed, fontSize: snapReaderFontSize(parsed.fontSize) };
    } catch { return defaults; }
  },
  save: (p: Prefs) => {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  },
};

/* ── Settings drawer component ────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: Prefs;
  onChange: (p: Partial<Prefs>) => void;
}

export function ReaderSettings({ open, onClose, prefs, onChange }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute bottom-0 inset-x-0 mx-auto max-w-2xl rounded-t-2xl border bg-card p-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        <h2 className="text-sm font-semibold mb-4">Reading settings</h2>

        {/* Pinyin mode */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground block mb-1.5">Pinyin</label>
          <div className="flex gap-1.5">
            {(["full", "off", "adaptive"] as const).map(m => (
              <button key={m} onClick={() => onChange({ pinyinMode: m })} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${prefs.pinyinMode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{m === "full" ? "All pinyin" : m === "off" ? "No pinyin" : "Adaptive"}</button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground block mb-1.5">Text size — {prefs.fontSize}px</label>
          <input type="range" min={0} max={READER_FONT_SIZES.length - 1} step={1} value={readerFontSizeIndex(prefs.fontSize)} onChange={e => onChange({ fontSize: READER_FONT_SIZES[Number(e.target.value)] })} className="w-full accent-primary" />
        </div>

        {/* Speed */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground block mb-1.5">Speed</label>
          <div className="flex gap-1.5">
            {[0.5, 0.75, 1.0, 1.25, 1.5].map(s => (
              <button key={s} onClick={() => onChange({ speed: s })} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${prefs.speed === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>×{s}</button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2 mb-4">
          <Toggle label="Always show sentence translations" checked={prefs.showTranslations} onChange={v => onChange({ showTranslations: v })} />
          <Toggle label="Underline new vocabulary (HSK level)" checked={prefs.hskUnderline} onChange={v => onChange({ hskUnderline: v })} />
        </div>

        <button onClick={onClose} className="w-full rounded-lg border py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Done</button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full rounded-lg px-3 py-2 bg-muted/50 text-sm hover:bg-muted transition-colors">
      <span className="text-foreground">{label}</span>
      <span className={`w-9 h-5 rounded-full transition-colors relative ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
