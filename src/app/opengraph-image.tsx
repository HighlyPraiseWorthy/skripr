import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Skripr — YouTube scripts built on what's already winning";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #080c12 0%, #0a1424 100%)",
          color: "#e8edf5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 10,
            color: "#d2e2f2",
            marginBottom: 36,
          }}
        >
          SKRIPR
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 920,
          }}
        >
          YouTube scripts built on what&apos;s already winning.
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 30,
            color: "#bcd2e8",
            maxWidth: 900,
          }}
        >
          In your voice, ready to record. skripr.app
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 10,
            background: "linear-gradient(90deg, #0e6499, #4db8ff, #7ed8ff)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
