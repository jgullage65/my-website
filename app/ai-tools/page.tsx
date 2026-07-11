import type { Metadata } from "next";
import AISystemsPageClient from "./AISystemsPageClient";

export const metadata: Metadata = {
  title: "AI Systems | JG Creative Studio",
  description:
    "Premium AI systems, copilots, automations, portals, dashboards, integrations, and custom business software by JG Creative Studio.",
};

export default function AIToolsPage() {
  return <AISystemsPageClient />;
}
