import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

export function renderOg() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#1a1714",
        color: "#f4efe6",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div style={{ fontSize: 40, color: "#f0c36a", letterSpacing: 6, textTransform: "uppercase" }}>Offhand</div>
      <div style={{ fontSize: 84, lineHeight: 1.05, marginTop: 24, fontWeight: 700 }}>A Shopify resale store that stocks itself.</div>
      <div style={{ fontSize: 34, color: "#b9b0a2", marginTop: 36 }}>Lists, reprices and pulls at zero stock. No approval queue.</div>
      <div style={{ fontSize: 28, color: "#8a8174", marginTop: 56 }}>offhand.nyttolabs.com</div>
    </div>,
    { ...ogSize },
  );
}
