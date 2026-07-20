import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import type { Viewport } from "next"
import { Toaster } from "@/components/ui/toaster"
import { OnlineTracker } from "@/components/online-tracker"
import { CookieConsent } from "@/components/cookie-consent"
import { LegalFooter } from "@/components/legal-footer"

export const metadata: Metadata = {
  title: {
    default: "تأمين سريع وموثوق - مقارنة أسعار التأمين في السعودية | becar",
    template: "%s | becar"
  },
  description: "احصل على أفضل عروض التأمين في السعودية - مقارنة سريعة وآمنة لأكثر من 20 شركة تأمين. تأمين شامل وضد الغير بأفضل الأسعار.",
  keywords: ["تأمين", "تأمين سيارات", "مقارنة تأمين", "السعودية", "تأمين شامل", "تأمين ضد الغير", "becar"],
  authors: [{ name: "becar" }],
  creator: "becar",
  publisher: "becar",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://demacax.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "تأمين سريع وموثوق - مقارنة أسعار التأمين في السعودية",
    description: "احصل على أفضل عروض التأمين في السعودية - مقارنة سريعة وآمنة لأكثر من 20 شركة تأمين",
    url: "https://demacax.com",
    siteName: "becar - تأمين سريع",
    locale: "ar_SA",
    type: "website",
    images: [
      {
        url: "/apple-icon.png",
        width: 180,
        height: 180,
        alt: "becar - تأمين سريع وموثوق",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "تأمين سريع وموثوق - مقارنة أسعار التأمين في السعودية",
    description: "احصل على أفضل عروض التأمين في السعودية - مقارنة سريعة وآمنة",
    images: ["/apple-icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Structured data for Google
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "InsuranceAgency",
    "name": "تأمين سريع وموثوق - becar",
    "description": "احصل على أفضل عروض التأمين في السعودية - مقارنة سريعة وآمنة لأكثر من 20 شركة تأمين",
    "url": "https://markbat-tameen.vercel.app",
    "areaServed": {
      "@type": "Country",
      "name": "Saudi Arabia"
    },
    "priceRange": "$$",
    "availableLanguage": ["ar", "en"],
    "serviceType": "تأمين السيارات"
  }

  return (
    <html lang="ar">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        {children}
        <LegalFooter />
        <CookieConsent />
        <Toaster />
        <OnlineTracker />
      </body>
    </html>
  )
}
