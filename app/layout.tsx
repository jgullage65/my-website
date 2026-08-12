import "./globals.css";
import "./scrollbar.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

const siteName = "Arkena Studio";
const siteDescription =
  "Build and manage an AI assistant trained on your business.";

const SYSTEM_SURFACE = "#090C11";
const SYSTEM_HOVER = "#070A0F";
const SYSTEM_BORDER = "rgba(255, 255, 255, 0.12)";
const SYSTEM_CARD_SHADOW =
  "0 8px 18px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.72)";

const clerkAppearance = {
  layout: {
    logoImageUrl: "/image/Arkenalogo.png",
    logoLinkUrl: "/brain-builder",
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#d4af37",
    colorPrimaryForeground: "#000000",
    colorBackground: SYSTEM_SURFACE,
    colorForeground: "#ebf0ff",
    colorMuted: SYSTEM_SURFACE,
    colorMutedForeground: "#a0aac8",
    colorInput: SYSTEM_SURFACE,
    colorInputForeground: "#ebf0ff",
    colorBorder: SYSTEM_BORDER,
    colorRing: "#f59e0b",
    colorModalBackdrop: "transparent",
    colorShadow: "#000000",
    borderRadius: "0.75rem",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyButtons:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  elements: {
    modalBackdrop: {
      background: "transparent",
      backdropFilter: "none",
    },
    modalContent: {
      borderRadius: "12px",
      margin: "auto",
    },
    card: {
      background: SYSTEM_SURFACE,
      border: `1px solid ${SYSTEM_BORDER}`,
      borderRadius: "12px",
      boxShadow: SYSTEM_CARD_SHADOW,
    },
    logoImage: {
      height: "auto",
      width: "180px",
      maxWidth: "100%",
    },
    headerTitle: {
      color: "#ffffff",
      fontWeight: "800",
      letterSpacing: "-0.025em",
    },
    headerSubtitle: {
      color: "#a0aac8",
    },
    socialButtonsBlockButton: {
      background: SYSTEM_SURFACE,
      border: `1px solid ${SYSTEM_BORDER}`,
      color: "#ffffff",
      boxShadow: SYSTEM_CARD_SHADOW,
      fontWeight: "700",
    },
    socialButtonsBlockButtonText: {
      color: "#ffffff",
    },
    dividerLine: {
      background: SYSTEM_BORDER,
    },
    dividerText: {
      color: "#a0aac8",
    },
    formFieldLabel: {
      color: "#ebf0ff",
      fontWeight: "700",
    },
    formFieldInput: {
      background: SYSTEM_SURFACE,
      border: `1px solid ${SYSTEM_BORDER}`,
      color: "#ebf0ff",
      boxShadow: SYSTEM_CARD_SHADOW,
    },
    formButtonPrimary: {
      background: SYSTEM_SURFACE,
      border: `1px solid ${SYSTEM_BORDER}`,
      color: "#ffffff",
      boxShadow: SYSTEM_CARD_SHADOW,
      fontWeight: "800",
    },
    footerActionLink: {
      color: "#d4af37",
      fontWeight: "700",
    },
    identityPreview: {
      background: SYSTEM_SURFACE,
      border: `1px solid ${SYSTEM_BORDER}`,
      boxShadow: SYSTEM_CARD_SHADOW,
    },
    identityPreviewText: {
      color: "#ebf0ff",
    },
    modalCloseButton: {
      color: "#d4af37",
      border: `1px solid ${SYSTEM_BORDER}`,
      background: SYSTEM_SURFACE,
    },
    formButtonPrimary__hover: {
      background: SYSTEM_HOVER,
    },
  },
};

const clerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to Arkena Studio",
    },
  },
} as any;

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  themeColor: SYSTEM_SURFACE,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY)
  ) {
    throw new Error(
      "Clerk authentication is not configured: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required.",
    );
  }

  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance} localization={clerkLocalization}>
          <main className="site-page-shell min-h-dvh">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
