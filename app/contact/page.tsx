import { Suspense } from "react";
import ContactClient from "./ContactClient";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ContactClient />
    </Suspense>
  );
}