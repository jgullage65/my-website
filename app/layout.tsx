import "./globals.css";
import "./scrollbar.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import SiteChrome from "./components/SiteChrome";

const siteName = "JG Creative Studio";
const siteDescription =
  "Premium websites, custom AI business systems, and growth technology built for modern businesses.";

const ogImage =
  "/image/ChatGPT%20Image%20Jul%2017,%202026,%2001_50_33%20AM.png";

const clerkAppearance = {
  layout: {
    logoImageUrl: "/image/Arkenalogo.png",
    logoLinkUrl: "/ai-builder",
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
    colorModalBackdrop: "rgba(2, 6, 17, 0.86)",
    colorShadow: "#000000",
    borderRadius: "0.75rem",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyButtons:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  elements: {
    modalBackdrop: {
      backdropFilter: "blur(10px)",
    },
    modalContent: {
      borderRadius: "24px",
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

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  metadataBase: new URL("https://jgcreativestudios.com"),
  themeColor: "#030713",
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: "https://jgcreativestudios.com",
    siteName,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "JG Creative Studio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [ogImage],
  },
  icons: {
    icon: [
      {
        url: "/apple-touch-icon.png?v=20260721",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/apple-touch-icon.png?v=20260721",
    apple: [
      {
        url: "/apple-touch-icon.png?v=20260721",
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

  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance}>
          <div className="site-background" aria-hidden="true">
            <div className="site-background__depth" />
            <div className="site-background__grid" />
            <div className="site-background__contours" />
            <svg
              className="site-background__field"
              viewBox="0 0 1440 900"
              preserveAspectRatio="none"
              focusable="false"
            >
              <g className="site-background__field-band site-background__field-band--gold">
                <path d="M-180 90 C90 10 250 175 470 95 S820 5 1080 105 S1370 175 1620 65" />
                <path d="M-180 150 C80 70 255 235 485 155 S825 70 1095 165 S1370 235 1620 125" />
                <path d="M-180 215 C75 130 260 300 500 220 S830 135 1110 230 S1380 300 1620 190" />
                <path d="M-180 285 C70 195 270 365 520 285 S845 200 1130 295 S1390 365 1620 255" />
                <path d="M-180 360 C65 270 280 440 540 360 S860 275 1150 370 S1400 440 1620 330" />
                <path d="M-180 440 C60 350 290 520 560 440 S875 355 1170 450 S1410 520 1620 410" />
                <path d="M-180 525 C55 435 300 605 580 525 S890 440 1190 535 S1420 605 1620 495" />
                <path d="M-180 615 C50 525 310 695 600 615 S905 530 1210 625 S1430 695 1620 585" />
                <path d="M-180 710 C45 620 320 790 620 710 S920 625 1230 720 S1440 790 1620 680" />
                <path d="M-180 810 C40 720 330 890 640 810 S935 725 1250 820 S1450 890 1620 780" />
              </g>
              <g className="site-background__field-band site-background__field-band--blue">
                <path d="M-220 55 C120 210 300 -25 570 105 S925 230 1180 80 S1450 -10 1660 145" />
                <path d="M-220 190 C110 345 315 110 590 240 S940 365 1200 215 S1460 125 1660 280" />
                <path d="M-220 330 C100 485 330 250 610 380 S955 505 1220 355 S1470 265 1660 420" />
                <path d="M-220 475 C90 630 345 395 630 525 S970 650 1240 500 S1480 410 1660 565" />
                <path d="M-220 625 C80 780 360 545 650 675 S985 800 1260 650 S1490 560 1660 715" />
                <path d="M-220 780 C70 935 375 700 670 830 S1000 955 1280 805 S1500 715 1660 870" />
              </g>
            </svg>
            <div className="site-background__nodes" />
            <div className="site-background__scan" />
            <div className="site-background__particles" />
            <div className="site-background__readability" />
            <div className="site-background__grain" />
          </div>

          <SiteChrome year={year}>{children}</SiteChrome>
        </ClerkProvider>
      </body>
    </html>
  );
}
