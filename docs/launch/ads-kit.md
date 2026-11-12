# Paid ads test kit

A small paid test, not a launch. AUD 15 buys roughly 10–40 clicks, which is
enough to see whether the funnel works end to end and nowhere near enough to
judge conversion. Read the result as "did anything break", not "does it sell".

## Before spending anything

Operator checks. None of these can be verified from the repository.

1. Open https://hsknest.com in a private window on a phone, tap
   "Try without signing up", finish one session, then "Save my progress"
   with a real address. Confirm the verification email arrives.
2. Confirm Umami shows `guest_session_start` and `first_review_complete`
   for that visit, with the `utm_source` you used.
3. Confirm the two cron jobs from `docs/DEPLOYMENT.md` (trial emails and
   the decline check) are installed on the server. Without them, nobody who
   signs up hears from the product again.
4. Stripe: one real checkout in live mode, then refund it. The test suite
   mocks Stripe, so a real charge has never been exercised by automation.

## Channel

| Channel | Why | Catch |
| --- | --- | --- |
| **Reddit Ads** (recommended) | Target the Mandarin-learning communities directly; clicks are usually cheap and the audience already knows what spaced repetition is. | New ad accounts can sit in review, so "tonight" is not guaranteed. Check the current minimum daily budget in the ads dashboard. |
| Meta (Instagram/Facebook) | Fastest to start, lowest minimums, the 20-second tour works as a Reel. | Interest targeting for "learning Chinese" is broad; expect curious clicks rather than committed learners. |
| ChatGPT Ads | High intent. | Reported click prices of USD 3–5 mean AUD 15 is three or four clicks. Not a test at this budget. |

Do not add an ad-platform tracking pixel. The site currently runs without a
consent banner because Umami is cookieless; a Meta or Reddit pixel would
change that. UTM links plus Umami are enough for this test.

## Links

The site stores `utm_source` and `utm_campaign` and attaches them to every
funnel event, so one link per ad variant is all the setup needed.

```
https://hsknest.com/?utm_source=reddit&utm_campaign=test1-a
https://hsknest.com/?utm_source=reddit&utm_campaign=test1-b
https://hsknest.com/?utm_source=meta&utm_campaign=test1-a
```

## Ad copy

Two variants, same destination. Run both, keep the budget split even.

**A — the deck-building pain**

> Headline: Stop building Anki decks for HSK
>
> All 11,000 HSK 1–9 words are already loaded, with pinyin, audio and
> example sentences. Pick your level and start reviewing. No signup needed
> to try it. Open source; hosted version is €10/month after a 14-day trial.

**B — the ten-second try**

> Headline: Try an HSK flashcard session in 10 seconds
>
> No account, no card, no setup. Pick HSK 1–9 and swipe through your first
> ten words. Spaced repetition brings each one back before you forget it.
> Open source; hosted version is €10/month after a 14-day trial.

Creative: `public/media/hsknest-tour-silent.mp4` (20 seconds, silent) for
video placements, `public/media/hsknest-tour-poster.webp` or
`public/screenshots/study.png` for static ones.

Keep the claims as written. No exam results, no "fluent in", no user counts,
and say "pronunciation audio", not "native audio". State the price in the ad:
it filters out clicks that would never pay, which matters when each click is
a noticeable share of the budget.

## Reading the result

Count these in Umami, filtered by `utm_campaign`:

| Step | Event | What a bad number means |
| --- | --- | --- |
| Click → guest session | `guest_session_start` | Under about one in five: the page does not match the ad, or it is slow on phones. |
| Guest session → first review | `first_review_complete` | Under about half: onboarding or the first card loses people. |
| First review → account | `guest_upgrade_complete` | Zero is expected at this volume. Do not conclude anything from it. |

Those thresholds are rules of thumb for deciding where to look next, not
benchmarks from data.

Next step by outcome:

- Clicks but almost no guest sessions: fix the landing page before spending more.
- Guest sessions but few first reviews: fix the first session.
- Both healthy: spend the next AUD 50 on the better variant and build the
  daily reminder email, since returning users become the bottleneck.
