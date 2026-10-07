# Homepage tour implementation and verification

## Delivery status

The section and player are complete locally with the user-uploaded approved
20-second video. The handoff text was recovered from the originating chat's exact
file-change output. Publication is authorised through PR #108; this document
records the implementation evidence before production deployment.

The first release CI run found GHSA-wq5f-xc86-pv6w in the existing Sharp dependency.
Sharp was updated from 0.35.4 to 0.35.5 with matching native/libvips packages;
unrelated package versions and platform metadata were preserved. A fresh install,
security-policy audit, poster transformation and production build passed.

Required public assets:

- `public/media/hsknest-tour.mp4`: web copy of approved v3, H.264/AAC with
  fast-start metadata, preserving the full 20 seconds and landscape frame.
- `public/media/hsknest-tour-poster.webp`: a readable Ninja frame from that video.
- `public/media/hsknest-tour.vtt`: accurate English narration captions checked
  against the audio, with meaningful audio cues where needed.

All three files are installed. The web MP4 is 3,450,637 bytes, 1920×1080,
H.264/AAC, exactly 20 seconds. It was remuxed with fast-start metadata and not
re-encoded: video/audio packet stream SHA-256 hashes match the uploaded source.
The moov atom precedes mdat. The 1280×720 Ninja poster is 20,970 bytes. Both meet
the planning budgets without lowering video quality.

Seven English narration cues use the approved audio-production script's exact
text/start times, recovered from the originating chat, and remain visible over
their scene. Browser WebVTT loading is verified. No independent speech-to-text
or human listening pass was performed in this environment.

## Behaviour and optional measurement

The server-rendered introduction sits immediately below the hero. A small client
player reserves 16:9 space and attaches the video source after an explicit gesture.
Native controls support pause, seek, volume and fullscreen. Loading and failure
messages are accessible; retry restores focus. The existing guest CTA remains
available when playback fails. The page has one main landmark. Existing redirects
and authentication are preserved; no database changes.

Events use the optional Umami adapter and existing campaign properties. They are
deduplicated per mounted page visit, not stored across visits.

| Event | Trigger | Meaning |
| --- | --- | --- |
| `promo_play` | first `playing` event | Browser reports playback began |
| `promo_complete` | first `ended` event | Playback reached the end |
| `promo_try_click` | first section CTA activation | Guest-entry intent |

Pause/resume and replay do not inflate counts. CTA intent is not successful guest
creation. Existing first_review_complete records one review, not a completed Study
session. Aggregate events alone do not prove the video caused activation.

## Design review notes

Externally generated exploration seeds:

- `c5a54b01ca6a4bbfaaa473253a805c489eeddf068f108d8f`
- `71a7ccbc8e466f48fe33cb4a737cf462fdcf9d70335b179e`
- `ca7aeb664e965dff7b38e8b6c601139632a124cf07b91268`

Three bounded compositions were rendered with the real poster: cinema, compact
exhibit and editorial. A fresh critic reviewed desktop/mobile screenshots and
selected cinema for its clear hierarchy and restraint. Root applied its focused
recommendations: smaller mobile play circle (56px), a readable watch label, and
tighter space before the next section. Existing dark-theme button foreground was
preserved for consistency with the product's contrast tokens. Seeds remain notes;
there is no random styling or runtime visual variation.

## Verification

- Full ESLint: passed.
- Initial TypeScript check: passed.
- Production build: passed, including TypeScript. Existing Sentry deprecation and
  dictionary filesystem tracing warnings were observed.
- Final dedicated suite: all 4 Chromium tests passed, now including the actual
  approved asset, native pause/resume/end, deduplicated events, showing caption
  cues, poster MIME/body, and HTTP 206 byte-range handling. Synthetic events remain
  only in the separate handler-semantics test. The temporary fixture was removed.
- Full uninterrupted native playback smoke at mobile 390px with reduced motion:
  zero MP4 requests before activation, one after, duration/currentTime 20 seconds,
  ended true, seven showing caption cues, one play and completion event, no error
  and no horizontal overflow. A prior native smoke caught and fixed a source
  reassignment cancelling the first play request; real-asset tests cover this path.
- Desktop/mobile real-poster screenshots reviewed at 1440 and 390 CSS pixels,
  including dark theme. Width tests cover 320, 390, 768 and 1440 pixels.
- WebKit downloaded, but host libraries are absent; Safari playback is unverified.

Run isolated checks with:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/hsknest-browsers npx playwright test --config playwright.teaser.config.ts
```

The config starts its own hosted-mode server on 3101 and does not reuse 3000.
Tests abort guest requests and create no users. Real-asset tests verify decoding;
synthetic media events in the separate test verify handler semantics only. Guest
success is the unchanged existing flow; failure and CTA intent were checked here.
Production CDN/cache behaviour remains a deployment-time check; local static
delivery and range requests are verified. Safari/real-device playback is unverified.

## Rollback

Remove the teaser render/import and its three components, plus promo event types
and dedicated tests/config if reverting the feature. Restore the hero's main
landmark only together with removing the page-level wrapper. No data rollback.
