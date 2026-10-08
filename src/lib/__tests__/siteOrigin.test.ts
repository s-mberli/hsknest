import { describe, expect, it } from "vitest";

import { getSiteOrigin } from "../siteOrigin";

describe("getSiteOrigin", () => {
  it("prefers the app URL and returns only its origin", () => {
    expect(
      getSiteOrigin({
        NEXT_PUBLIC_APP_URL: "https://learn.example.test/app/",
        NEXTAUTH_URL: "https://auth.example.test",
      }),
    ).toBe("https://learn.example.test");
  });

  it("uses a valid NextAuth URL when the app URL is invalid", () => {
    expect(
      getSiteOrigin({
        NEXT_PUBLIC_APP_URL: "not a URL",
        NEXTAUTH_URL: "http://localhost:3000/auth",
      }),
    ).toBe("http://localhost:3000");
  });

  it("falls back to the hosted origin for invalid or missing URLs", () => {
    expect(getSiteOrigin({ NEXT_PUBLIC_APP_URL: "javascript:alert(1)" })).toBe(
      "https://hsknest.com",
    );
    expect(getSiteOrigin({})).toBe("https://hsknest.com");
  });

  it("rejects URLs containing credentials", () => {
    expect(
      getSiteOrigin({ NEXT_PUBLIC_APP_URL: "https://user:pass@example.test" }),
    ).toBe("https://hsknest.com");
  });
});
