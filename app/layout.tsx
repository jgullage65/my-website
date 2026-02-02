import "./globals.css";

export const metadata = {
title: "Local Business Help",
description: "Bold, modern support for local small businesses.",
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return (
<html lang="en">
<body>
<header className="bg-[var(--navy)] text-white">
<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
<a href="/" className="font-black text-[var(--gold)] text-lg">
Local Business Help
</a>

<nav className="flex gap-6 text-sm font-semibold">
<a className="hover:text-[var(--gold)]" href="/services">
Services
</a>
<a className="hover:text-[var(--gold)]" href="/contact">
Contact
</a>
</nav>
</div>
</header>

<main>{children}</main>
</body>
</html>
);
}
