import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about websites, flyers, social content, and AI tools from JG Creative Studio.",
};

const sections: {
  title: string;
  emoji: string;
  items: { q: string; a: string }[];
}[] = [
  {
    title: "Getting started",
    emoji: "🚀",
    items: [
      {
        q: "What do you need from me to get started?",
        a: "Just the basics: your business name, what you do, your goal (calls, bookings, sales, leads), and any photos/logos you already have. If you don’t have branding yet, no problem — we can still build something clean and professional.",
      },
      {
        q: "What if I’m not sure what I need?",
        a: "Totally normal. Tell me your business + what you want to improve, and I’ll recommend the simplest setup that gets results (website,