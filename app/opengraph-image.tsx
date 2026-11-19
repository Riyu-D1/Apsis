import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ORBITAL // FOCUS — a deep-work flight deck powered by NASA telemetry";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#050507",
          color: "#f4f4f6",
          position: "relative",
        }}
      >
        {/* orbit arcs */}
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 560,
            height: 560,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            border: "1px dashed rgba(245,165,36,0.4)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 120,
            top: 120,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#f5a524",
          }}
        />
        <div
          style={{
            fontSize: 20,
            letterSpacing: 14,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 24,
          }}
        >
          COGNITION LABS · MISSION DECK
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: 6,
            lineHeight: 1,
          }}
        >
          ORBITAL <span style={{ color: "#f5a524" }}>{"//"}</span> FOCUS
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            letterSpacing: 4,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          DEEP WORK UNDER LIVE NASA TELEMETRY
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 24,
            fontSize: 18,
            letterSpacing: 4,
            color: "#67e8f9",
          }}
        >
          <span>NEOWS</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>/</span>
          <span>APOD</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>/</span>
          <span>DONKI</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>/</span>
          <span>ISS TRACK</span>
        </div>
      </div>
    ),
    size,
  );
}
