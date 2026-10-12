import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { MusicProvider } from "@/components/music/MusicProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Ariel y sus amigos (y Joel)",
  description: "La comunidad privada, exclusiva y caótica.",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "128x128", type: "image/png" },
      { url: "/favicon.ico" }
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={cn(
          inter.variable,
          jetbrainsMono.variable,
          "antialiased min-h-screen bg-background text-foreground selection:bg-primary/30"
        )}
      >
        <MusicProvider>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
        </MusicProvider>
      </body>
    </html>
  );
}
