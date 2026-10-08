"use client";

import { useRef, useState } from "react";

import { trackEvent } from "@/lib/analytics";

const VIDEO_SRC = "/media/hsknest-tour-silent.mp4";

export function LandingTeaserPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracked = useRef({ play: false, complete: false });
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function play() {
    const video = videoRef.current;
    if (!video) return;

    setError(false);
    setLoading(true);
    if (!started) {
      // Assign before calling play so the request starts synchronously from
      // this user gesture, while the React update exposes native controls.
      video.src = VIDEO_SRC;
      video.load();
      setStarted(true);
    }

    // Keep keyboard focus in the player as the initial play button gives way
    // to native controls. The fixed-ratio video box does not move.
    video.focus();
    try {
      await video.play();
    } catch {
      setLoading(false);
      setError(true);
    }
  }

  async function retry() {
    const video = videoRef.current;
    if (!video) return;
    setError(false);
    setLoading(true);
    try {
      video.load();
      video.focus();
      await video.play();
    } catch {
      setLoading(false);
      setError(true);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-black shadow-card">
      <video
        ref={videoRef}
        aria-label="HSK Nest tour: Word Ninja, Study, Word Match, Meaning Quiz, Reading Quiz, and Sentences"
        aria-describedby="landing-teaser-video-description"
        className="block aspect-video w-full outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary"
        controls={started}
        playsInline
        muted
        preload="none"
        poster="/media/hsknest-tour-poster.webp"
        tabIndex={started ? 0 : -1}
        onPlaying={() => {
          setLoading(false);
          setError(false);
          if (!tracked.current.play) {
            tracked.current.play = true;
            trackEvent("promo_play");
          }
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => {
          if (videoRef.current?.paused) setLoading(false);
        }}
        onPause={() => setLoading(false)}
        onEnded={() => {
          setLoading(false);
          if (!tracked.current.complete) {
            tracked.current.complete = true;
            trackEvent("promo_complete");
          }
        }}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      >
        {started && (
          <track
            kind="captions"
            src="/media/hsknest-tour.vtt"
            srcLang="en"
            label="English captions"
            default
          />
        )}
        Your browser does not support embedded video. You can still try HSK Nest
        using the button below.
      </video>

      <p id="landing-teaser-video-description" className="sr-only">
        The tour follows 猫 (māo, cat) through a quick Word Ninja round, then shows the
        word in Study, Word Match, Meaning Quiz, Reading Quiz, and Sentences.
        These screens show different ways to practise recognising and using
        the same word.
      </p>

      {!started && (
        <button
          type="button"
          onClick={play}
          className="absolute inset-0 flex items-center justify-center text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label="Watch the 20-second tour"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-white/80 bg-black/65 shadow-sm backdrop-blur-sm sm:size-20">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="ml-1 size-7 fill-current sm:size-8"
            >
              <path d="M7 4.8c0-.78.85-1.26 1.52-.85l11.1 6.95a1.3 1.3 0 0 1 0 2.2l-11.1 6.95A1 1 0 0 1 7 19.2V4.8Z" />
            </svg>
          </span>
          <span className="absolute bottom-3 rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white sm:hidden">
            Watch the 20-second tour
          </span>
        </button>
      )}

      {started && error && (
        <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-2 bg-black/80 px-4 py-3 text-center text-sm text-white">
          <p role="status" aria-live="polite">
            The tour could not be played. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={retry}
            className="rounded-md underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Try again
          </button>
        </div>
      )}

      {started && loading && !error && (
        <p
          className="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-black/75 px-3 py-1 text-sm text-white"
          role="status"
          aria-live="polite"
        >
          Loading tour…
        </p>
      )}
    </div>
  );
}
