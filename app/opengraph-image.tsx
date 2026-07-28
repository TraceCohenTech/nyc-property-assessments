import { ImageResponse } from "next/og";

export const alt = "NYC Property Assessment Explorer — $1.9T in total market value across 1.17M tax lots, FY2027 DOF assessment roll";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          background: "linear-gradient(135deg, #0a0e1a 0%, #0b1224 55%, #0a1a2e 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#67e8f9",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          NYC Dept. of Finance · FY2027 Assessment Roll
        </div>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            fontSize: 74,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
            color: "#ffffff",
          }}
        >
          <span>NYC Property</span>
          <span style={{ color: "#67e8f9" }}>Assessment Explorer</span>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 56 }}>
          {[
            { value: "$1.9T", label: "Total market value" },
            { value: "1.17M", label: "Tax lots" },
            { value: "FY2027", label: "Assessment roll" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(103,232,249,0.25)",
                borderRadius: 16,
                padding: "24px 32px",
                minWidth: 220,
              }}
            >
              <span style={{ fontSize: 44, fontWeight: 800, color: "#ffffff" }}>{s.value}</span>
              <span style={{ fontSize: 18, color: "#93c5fd", marginTop: 6 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
