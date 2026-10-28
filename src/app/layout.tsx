import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Meu Treino", template: "%s | Meu Treino" },
  description: "Seu programa local-first de musculação e cardio em 12 semanas.",
  applicationName: "Meu Treino",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Meu Treino" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#16A34A", colorScheme: "light dark", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;
}
