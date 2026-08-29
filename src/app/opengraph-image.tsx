import { ImageResponse } from "next/og";

export const alt = "HSK Nest — Spaced Repetition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static brand card. Colors are plain hex (satori/resvg do not support the
// oklch() tokens in globals.css) but are picked to match the app's
// vermilion/cinnabar primary on a dark ground — see globals.css:90,145,153.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#241f1c",
          backgroundImage:
            "radial-gradient(circle at 50% 35%, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0) 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ fontSize: 88 }}>🪹</div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#faf5f0",
              letterSpacing: -2,
            }}
          >
            HSK Nest
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: "#e8dcd3",
            maxWidth: 880,
            textAlign: "center",
          }}
        >
          Self-hostable, FSRS-powered spaced repetition
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: "#dc2626",
            fontWeight: 600,
          }}
        >
          Open-source · Mandarin-first · Own your data
        </div>
      </div>
    ),
    { ...size }
  );
}
