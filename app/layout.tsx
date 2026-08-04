import "./globals.css";
import "./scrollbar.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

const siteName = "Arkena Studio";
const siteDescription =
  "Build and manage an AI assistant trained on your business.";

const clerkAppearance = {
  layout: {
    logoImageUrl: "/image/Arkenalogo.png",
    logoLinkUrl: "/brain-builder",
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#d4af37",
    colorPrimaryForeground: "#000000",
    colorBackground: "#000000",
    colorForeground: "#ebf0ff",
    colorMuted: "#050505",
    colorMutedForeground: "#a0aac8",
    colorInput: "#020202",
    colorInputForeground: "#ebf0ff",
    colorBorder: "rgba(212, 175, 55, 0.22)",
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
      borderRadius: "24px",
      margin: "auto",
    },
    card: {
      background: "#000000",
      border: "1px solid rgba(245, 158, 11, 0.22)",
      borderRadius: "24px",
      boxShadow:
        "0 26px 70px rgba(0, 0, 0, 0.48), 0 0 50px rgba(245, 158, 11, 0.07)",
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
      background: "#050505",
      border: "1px solid rgba(245, 158, 11, 0.18)",
      color: "#ffffff",
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      fontWeight: "700",
    },
    socialButtonsBlockButtonText: {
      color: "#ffffff",
    },
    dividerLine: {
      background: "rgba(212, 175, 55, 0.18)",
    },
    dividerText: {
      color: "#a0aac8",
    },
    formFieldLabel: {
      color: "#ebf0ff",
      fontWeight: "700",
    },
    formFieldInput: {
      background: "#020202",
      border: "1px solid rgba(212, 175, 55, 0.22)",
      color: "#ebf0ff",
      boxShadow: "none",
    },
    formButtonPrimary: {
      background: "#050505",
      border: "1px solid rgba(245, 158, 11, 0.28)",
      color: "#ffffff",
      boxShadow:
        "0 14px 34px rgba(245, 158, 11, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      fontWeight: "800",
    },
    footerActionLink: {
      color: "#d4af37",
      fontWeight: "700",
    },
    identityPreview: {
      background: "#050505",
      border: "1px solid rgba(212, 175, 55, 0.18)",
    },
    identityPreviewText: {
      color: "#ebf0ff",
    },
    modalCloseButton: {
      color: "#d4af37",
      border: "1px solid rgba(245, 158, 11, 0.22)",
      background: "#000000",
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
  themeColor: "#000000",
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
          <main className="site-page-shell min-h-dvh xl:h-dvh xl:min-h-0 xl:overflow-hidden">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
