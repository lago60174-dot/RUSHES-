import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RUSHES",
  description: "Centre de contrôle contenu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#14141A" }}>{children}</body>
    </html>
  );
}
