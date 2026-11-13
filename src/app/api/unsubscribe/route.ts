import { NextResponse } from "next/server";

import {
  unsubscribeSecret,
  verifyUnsubscribeToken,
} from "@/lib/dailyReminder";
import { prisma } from "@/lib/prisma";

/**
 * Daily reminder unsubscribe, no login needed: the signed token in the link
 * is the authorisation.
 *
 * GET changes nothing and forwards to the confirm page, because mail
 * security scanners open every link in an email. POST does the change: the
 * page's button and RFC 8058 one-click (`List-Unsubscribe-Post`) from mail
 * clients both land here.
 */
function params(req: Request) {
  const url = new URL(req.url);
  return {
    u: url.searchParams.get("u") ?? "",
    t: url.searchParams.get("t") ?? "",
  };
}

export async function GET(req: Request) {
  const { u, t } = params(req);
  const target = new URL("/unsubscribe", req.url);
  target.searchParams.set("u", u);
  target.searchParams.set("t", t);
  return NextResponse.redirect(target, 303);
}

export async function POST(req: Request) {
  const { u, t } = params(req);
  if (!verifyUnsubscribeToken(u, t, unsubscribeSecret())) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }

  // updateMany: a deleted account is a quiet no-op, not a 500.
  await prisma.user.updateMany({
    where: { id: u },
    data: { dailyReminderEmail: false },
  });

  return NextResponse.redirect(new URL("/unsubscribe?done=1", req.url), 303);
}
