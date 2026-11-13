/**
 * The client address a trusted reverse proxy supplies, for per-source rate
 * limits. Reads the first `X-Forwarded-For` hop, then `X-Real-IP`.
 *
 * Returns "" when neither header is present. Callers must then skip their
 * per-source bucket and rely on their per-account/global limits: a shared
 * "unknown" key would merge every visitor into one bucket and cap the whole
 * site at the per-source number.
 *
 * These headers are only trustworthy behind a proxy that overwrites them and
 * blocks direct access to the app port, which is why every per-source limit
 * is paired with a global ceiling.
 */
export function clientAddressFrom(
  forwardedFor: string | null | undefined,
  realIp: string | null | undefined
): string {
  return forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "";
}

export function clientAddress(req: Request): string {
  return clientAddressFrom(
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip")
  );
}
