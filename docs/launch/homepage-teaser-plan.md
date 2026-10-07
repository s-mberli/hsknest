# Homepage teaser — draft spec and implementation plan

Status: local implementation and Chromium verification complete with uploaded
approved assets. See teaser-verification.md for evidence and remaining browser limits.
Date: 2026-10-07. No GitHub tickets have been published. This is a review draft,
not a replacement for the repository's GitHub issue tracker.

## Problem and outcome

Visitors can try a flashcard in the hero but do not immediately see the range of
Study and Practice Modes. Add the approved 20-second teaser immediately below
the hero, helping visitors understand the product and start studying.

The user approved the video and below-hero direction in the earlier promo chat.
The detailed design and engineering choices below are proposals for approval.

## Current evidence and prerequisite

The current homepage renders a client hero followed by server-rendered marketing
sections. It redirects signed-in users to their dashboard and self-hosted users
to login/signup. Existing guest CTA behaviour should be reused. Existing optional
Umami analytics includes guest_session_start and first_review_complete; the latter
records one successful review, not a completed Study session.

The earlier chat, “Create a 20-second product promo”, identifies approved v3:
Ninja from 0–3.4 seconds, Study/Match/Meaning Quiz/Reading Quiz/Sentences through
17 seconds, then the closing card. One word, 猫, connects the demonstrations.

At planning time this workspace did not contain that video's assets or the newly written
HANDOFF.md. PRODUCT.md and DESIGN.md referenced by AGENTS.md are also absent.
Recover the exact files from their originating workspace or an authorised transfer;
verify them against current code. A matching path in another chat is not proof of
local availability. Do not recreate the promo from memory or substitute another cut.
Asset recovery is a real blocker to shipping, not a reason to fake completion.

## Visitor needs

1. Understand what the tour demonstrates before pressing play.
2. Start, pause, seek, adjust sound, replay, and enter fullscreen intentionally.
3. Understand the narration through accurate synchronised captions.
4. View the complete video on a phone without cropped UI or horizontal overflow.
5. Operate the section using a keyboard with visible focus and meaningful labels.
6. Browse without unsolicited motion, audio, or a full video download.
7. Still start studying if video loading fails or analytics is unavailable.
8. Start through the same guest flow offered by the hero.

## Proposed experience

- Order: existing hero → teaser → existing explanatory sections.
- Heading: “Six ways to make Chinese words stick.” Play label: “Watch the
  20-second tour”. One CTA underneath: “Try without signing up”.
- Product footage supplies the visual interest. Use a clear Ninja frame as the
  poster, with a legible play control; avoid turning the poster into a text collage.
- Match existing fonts, colours, borders and spacing tokens. Maximum section width
  should align with the following marketing content. Use the media's actual aspect
  ratio, expected to be 16:9, without cropping. Reserve its dimensions before load.
- Keep inline playback on mobile; offer native fullscreen rather than forcing it.
- Preserve the existing hero and Words/Lists screenshots. Remove the duplicate
  Study screenshot only if whole-page visual review demonstrates repetition; if
  removed, rebalance that row and record the rationale.

## Design exploration and restraint

The Lenny article by Anshu Chimala describes external random seed strings for
creative exploration, screenshot critique, and removing unnecessary decoration.
Apply those ideas selectively to this existing product, not as a homepage redesign.

At implementation time generate three alphanumeric seeds using a shell RNG and
record them in local review notes. Use them to explore three teaser compositions
within the existing design system: a quiet cinema frame, a compact product exhibit,
and a restrained editorial arrangement. Seeds influence exploration only: never
ship random numbers, random CSS, or runtime visual variation. A seed is not evidence
of quality or a reproducibility guarantee for model output.

Choose the composition that best balances product visibility, continuity with the
hero, mobile readability and CTA clarity. Avoid new gradients, glow effects,
decorative badges, extra feature cards, repeated slogans and unsupported claims.
Do not add new fonts, illustration dependencies, or a carousel for this section.
Render and compare candidates; do not judge only from source code.

## Proposed implementation decisions

- Keep static copy server-rendered; isolate playback state in a small client
  component. Use native video controls, not a new player library.
- Before play, show the poster and semantic button without an attached video
  source. On activation attach/load the source and request playback. Handle a
  rejected play promise by keeping usable controls and a retry path.
- Native controls own pause, seeking, volume and fullscreen. Support ended/replay,
  buffering and error states without competing custom controls. Focus must not
  disappear when the initial play button is replaced.
- No autoplay or looping. No additional entrance animation is necessary. Respect
  reduced motion in any inherited interactions used by this section.
- Prepare a web MP4 with fast-start metadata and broadly supported codecs; verify
  actual decoding. Preserve approved content. Target at most 5 MB for the
  20-second web version and 150 KB for the poster; if readability needs more,
  document the tradeoff instead of silently destroying Chinese text detail.
- Supply a WebVTT narration track, checked against the audio, and an accessible
  short text description of the demonstrated actions. Do not assume burned-in
  headings are narration captions.
- Serve media through the existing site's static delivery if suitable. Verify MIME,
  cache and byte-range behaviour on the eventual preview/host. Add external media
  infrastructure only if a measured delivery limit requires a separate decision.
- Keep the guest flow and authentication architecture intact. Preserve signed-in
  and self-hosted redirects. Ensure all homepage content is inside an appropriate
  main landmark without nested main elements.
- No database/schema or scheduling changes.

## Measurement boundary

Use the existing optional analytics adapter. Proposed events: promo_play (first
actual playing event), promo_complete (ended), promo_try_click (CTA intent).
Deduplicate each per page visit; pause/resume must not inflate plays. CTA clicks
must not be mistaken for successful guest creation. Keep existing campaign
attribution and analytics-disabled behaviour. Analytics failure must never affect UI.

Monitor existing guest study start and first successful review alongside the new
events. These aggregates do not establish that watching caused conversion. Entire
Study-session completion and experimental attribution are separate follow-up work;
do not rename or reinterpret the existing first-review event to imply either.

## Testing decisions — proposed approval seam

Use the public homepage browser boundary as the main test seam, following existing
public-entry browser tests. Check externally observable behaviour, not React state
or Tailwind class snapshots. Stub network failures and the optional analytics
provider where appropriate; verify real media decoding separately.

Acceptance evidence:

- No video request before play; dimensions remain stable when playback starts.
- Keyboard play, visible focus, pause/replay, captions, sound and fullscreen work.
- Broken/slow media yields usable feedback; the guest CTA remains available.
- Guest CTA success and failure behaviour remains intact in an isolated environment.
- Analytics events fire with the intended semantics and remain harmless when absent.
- No overflow at 320, 390, 768 and 1440 CSS pixels; inspect both themes and reduced
  motion. Capture the hero-to-video transition and the entire homepage, not just
  an isolated component.
- Test Chromium and available WebKit/mobile playback; report actual device/browser
  coverage. Emulation must not be described as a real iPhone test.
- Run affected browser checks, lint, type checking and production build as supported
  by the configured environment. Inspect port 3000 and test-data isolation before
  running Playwright; the existing configuration reuses servers and can create users.
- Record before/after page-load measurements using the same conditions. Confirm the
  poster is lightweight and the video does not compete with the hero's initial load.

## Draft ticket breakdown

### 1. Recover assets and deliver a playable tour

Blocked by: approved source assets being available; user go.

Deliver the exact approved tour below the hero with a responsive poster, native
playback, captions, guest CTA and failure fallback. Resolve the media delivery
details from actual file inspection. Demonstrate click → playback → guest entry
locally and verify deferred loading. This is a complete usable baseline.

### 2. Refine the composition and verify inclusive playback

Blocked by: ticket 1.

Explore the three bounded directions, select one, and refine full-page spacing,
poster, mobile layout, themes, focus and motion behaviour. Run the browser checks
and capture review evidence. A fresh critic sees screenshots and the brief first,
without the builder's rationale, and identifies concrete gaps. Limit review to two
rounds initially; fix usability defects regardless of subjective aesthetic scores.

### 3. Add measurement and finish the handoff

Blocked by: ticket 1. May follow ticket 2 sequentially to avoid overlapping edits.

Deliver the three optional promo events, verified deduplication and CTA semantics.
Run final checks on the combined change; document media sizes, browser coverage,
remaining limitations and rollback. Update the recovered handoff without erasing
its unrelated entries. Final acceptance requires ticket 2's visual evidence too.

## Model handoff after approval

Suggested builder: gpt-6-luna with medium reasoning, one bounded ticket at a time.
Use the current stronger model for design selection and final review. No delegation
has started. The user may choose another model before authorising execution.

Each worker receives this document, repository instructions, the previous ticket's
evidence and exact asset locations. Workers must read relevant installed Next.js
guides before editing. Ask for targeted assistance if assets are unavailable,
requirements conflict, or a technical failure persists after two focused attempts.
Do not keep retrying blindly or broaden into an unrelated redesign.

## Out of scope

Regenerating the approved promo, changing product positioning/pricing, social cuts,
new animation/player dependencies, new analytics vendors, session-funnel redesign,
commits, publishing, deployments or production-data changes. Shipping permission
is distinct from approval to implement locally.

## Sources and interpretation

- [Matt: ask-matt](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md):
  routes multi-session work through spec and tickets.
- [Matt: to-spec](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md)
  and [to-tickets](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md):
  conversation synthesis, behavioural seams, complete slices and explicit blockers.
  This document is the pre-publication review draft; proposed choices are not
  misrepresented as prior user decisions.
- [Anshu Chimala in Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-to-turn-your-ai-into-a-world):
  seed exploration and independent visual critique inform the review process.
  Detailed styling, scope and performance budgets above are our recommendations.
  Technique 7's full text was paywalled in the retrieved page and was not read.
- Earlier promo chat: below-hero placement is a recommendation for this page,
  not a placement rule attributed to Lenny's experts.
