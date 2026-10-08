import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase();
        // NextAuth v4 provides request headers here. Only use a source header
        // when the deployment's trusted proxy overwrites it; without one we
        // retain the account/global limits instead of merging every NAT user
        // into a shared "unknown" source bucket.
        const forwardedFor = req.headers?.["x-forwarded-for"];
        const realIp = req.headers?.["x-real-ip"];
        const source =
          forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "";

        // A per-source ceiling prevents one client from rotating email names
        // to consume the process-wide budget. X-Forwarded-For / X-Real-IP are
        // trustworthy only behind a proxy that overwrites them and blocks
        // direct access to the app port. No header → no shared NAT fallback.
        if (source && !rateLimit(`login:source:${source}`, 60, 60 * 1000)) {
          return null;
        }

        // Keep independent account and process ceilings as defense in depth.
        // These count all authorize submissions (including successful logins).
        // Returning null makes NextAuth surface a generic failure.
        if (
          !rateLimit("login:global", 1000, 60 * 1000) ||
          !rateLimit(`login:${email}`, 30, 60 * 1000)
        )
          return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Password-reset revocation no longer happens here: the DB hit this
      // callback used to make ran on EVERY authenticated request, doubling
      // session validation cost (see session.ts / PERF-1). getCurrentUserId
      // now reads passwordChangedAt in its own single lookup.
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
