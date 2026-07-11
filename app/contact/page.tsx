import { Suspense } from "react";
import ContactPageClient from "./ContactPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact | JG Creative Studio",
  description: "Contact JG Creative Studio for websites, AI systems, automation, design support, and custom business technology.",
};

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030713]" />}>
      <ContactPageClient />
    </Suspense>
  );
}
