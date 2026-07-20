import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import JGChatWidget from "./components/JGChatWidget";
import SiteNavLinks from "./components/SiteNavLinks";
import { ClerkProvider } from "@clerk/nextjs";

const siteName = "JG Creative Studio";
const siteDescription =
  "Premium websites, custom AI business systems, and growth technology built for modern businesses.";