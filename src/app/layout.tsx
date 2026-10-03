import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ViewportSync } from "@/components/ViewportSync";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mycalorie",
  description: "Snap a meal, see your protein for the day.",
  appleWebApp: { capable: true, title: "Mycalorie", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  viewportFit: "cover",
  // Android Chrome shrinks the page for the keyboard; iOS ignores this and ViewportSync covers it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <ViewportSync />
        {children}
      </body>
    </html>
  );
}
