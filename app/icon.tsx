import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
return new ImageResponse(
(
<div
style={{
width: "64px",
height: "64px",
display: "flex",
alignItems: "center",
justifyContent: "center",
background: "#0b1220", // navy
borderRadius: 14,
}}
>
<div
style={{
fontSize: 30,
fontWeight: 900,
color: "#f5c84b", // gold
fontFamily: "Arial Black, Arial, sans-serif",
letterSpacing: -1,
lineHeight: 1,
}}
>
JG
</div>
</div>
),
size
);
}