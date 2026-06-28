import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { TRPCProvider } from "@/components/TRPCProvider";
import { ToastProvider } from "@/components/ui/toast";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../messages/fr.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestion Paie",
  description: "Plateforme de gestion des salaires",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-surface">
        <NextIntlClientProvider locale="fr" messages={messages}>
          <SessionProvider>
            <TRPCProvider>
              <ToastProvider>{children}</ToastProvider>
            </TRPCProvider>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
