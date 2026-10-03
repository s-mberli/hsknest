export interface NinjaRecords {
  score: number;
  combo: number;
  waves: number;
}

function metric(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function parseNinjaRecords(value: unknown): NinjaRecords | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    score: metric(record.score),
    combo: metric(record.combo),
    waves: metric(record.waves),
  };
}

export function mergeNinjaRecords(previous: NinjaRecords | null, current: NinjaRecords): NinjaRecords {
  return {
    score: Math.max(previous?.score ?? 0, current.score),
    combo: Math.max(previous?.combo ?? 0, current.combo),
    waves: Math.max(previous?.waves ?? 0, current.waves),
  };
}
