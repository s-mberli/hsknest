const DEFAULT_SITE_ORIGIN = "https://hsknest.com";

type SiteEnvironment = {
  NEXT_PUBLIC_APP_URL?: string;
  NEXTAUTH_URL?: string;
};

function parseSiteOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Resolve the public site origin, preferring the explicit app URL. */
export function getSiteOrigin(env?: SiteEnvironment): string {
  const source = env ?? {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };
  return (
    parseSiteOrigin(source.NEXT_PUBLIC_APP_URL) ??
    parseSiteOrigin(source.NEXTAUTH_URL) ??
    DEFAULT_SITE_ORIGIN
  );
}
