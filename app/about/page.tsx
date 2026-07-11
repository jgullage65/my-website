import type { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About | JG Creative Studio",
  description:
    "Meet James Gullage and learn how JG Creative Studio builds premium websites, AI systems, and business technology with clear strategy and practical execution.",
};

export default function AboutPage() {
  return <AboutPageClient />;
}
