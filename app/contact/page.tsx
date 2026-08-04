import { Suspense } from "react";
import ContactPageClient from "./ContactPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact | Arkena Studio",
  description: "Contact Arkena Studio with questions, concerns, or collaboration inquiries.",
};

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-black" />}>
      <ContactPageClient />
    </Suspense>
  );
}
