import type { Metadata } from "next";
import ServicesPageClient from "./ServicesPageClient";

export const metadata: Metadata = {
  title: "Services | JG Creative Studio",
  description:
    "Premium websites, AI systems, custom software, automation, maintenance, and creative support services from JG Creative Studio.",
};

export default function ServicesPage() {
  return <ServicesPageClient />;
}
