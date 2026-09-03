import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filigrane local — Viligue",
  description: "Ajoutez un filigrane incrusté à un PDF ou une image, directement dans votre navigateur et sans envoyer le document.",
  robots: { index: true, follow: true },
  icons: {
    icon: "/filigrane/heads/head-00-ok.webp",
    shortcut: "/filigrane/heads/head-00-ok.webp",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
