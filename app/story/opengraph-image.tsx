import { ImageResponse } from "next/og";

export const alt = "The State of NYC Property — 10 findings from $1.9T in tax lots, FY2027 DOF assessment roll";
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
          NYC Property Assessment Explorer
        </div>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
            color: "#ffffff",
          }}
        >
          <span>The State of</span>
          <span style={{ color: "#67e8f9" }}>NYC Property</span>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 56 }}>
          {[
            { value: "$18.88B", label: "The single most valuable lot" },
            { value: "8.02%", label: "Value held by top 10 owner groups" },
            { value: "192,358", label: "Lots built in the 1920s alone" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(103,232,249,0.25)",
                borderRadius: 16,
                padding: "24px 28px",
                minWidth: 220,
              }}
            >
              <span style={{ fontSize: 38, fontWeight: 800, color: "#ffffff" }}>{s.value}</span>
              <span style={{ fontSize: 16, color: "#93c5fd", marginTop: 6 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
