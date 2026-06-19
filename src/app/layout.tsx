import type { Metadata } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://granpaz.com.br'),
  title: "Granpaz | Plano de Proteção Familiar",
  description:
    "O plano de proteção familiar que cuida de quem você mais ama. Cobertura em todo o Brasil, apoio financeiro e proteção em vida. Saúde & Proteção Administração de Benefícios.",
  keywords: [
    "Granpaz",
    "proteção familiar",
    "plano de proteção",
    "assistência funeral",
    "cobertura familiar",
    "Saúde e Proteção",
    "indenização",
  ],
  authors: [{ name: "Saúde & Proteção Administração de Benefícios" }],
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Granpaz | Plano de Proteção Familiar",
    description:
      "A dor de uma perda não avisa quando vai chegar. Mas a proteção da sua família pode começar hoje.",
    siteName: "Granpaz",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Granpaz | Plano de Proteção Familiar",
    description:
      "A dor de uma perda não avisa quando vai chegar. Mas a proteção da sua família pode começar hoje.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Schema.org — Organização */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Granpaz - Saúde & Proteção",
              description:
                "Plano de proteção familiar com cobertura em todo o Brasil",
              url: "https://granpaz.com.br",
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                availableLanguage: "Portuguese",
              },
            }),
          }}
        />
        {/* Schema.org — Produto (SPEC-07 §6.3) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "Plano Granpaz",
              description: "Clube de benefícios com assistência funeral nacional e amparo financeiro.",
              brand: {
                "@type": "Brand",
                name: "Saúde & Proteção",
              },
              offers: {
                "@type": "Offer",
                priceCurrency: "BRL",
                price: "29.90",
                availability: "https://schema.org/InStock",
              },
            }),
          }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${manrope.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
