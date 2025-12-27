import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Culture Media | Digital Marketing Agency Alberta | Calgary & Edmonton",
  description: "Culture Media is a full-service digital marketing agency specializing in the Alberta and Canadian markets. We've helped countless brands transform their digital presence through social media marketing, SEO, content creation, and strategic digital campaigns in Calgary, Edmonton, and across Alberta.",
  keywords: [
    "digital marketing agency Alberta",
    "Calgary digital marketing",
    "Edmonton digital marketing",
    "social media marketing Alberta",
    "SEO Calgary",
    "SEO Edmonton",
    "content marketing Alberta",
    "digital marketing Canada",
    "Alberta marketing agency",
    "social media management Calgary",
    "social media management Edmonton"
  ],
  authors: [{ name: "Culture Media" }],
  creator: "Culture Media",
  publisher: "Culture Media",
  metadataBase: new URL('https://culturemedia.ca'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Culture Media | Digital Marketing Agency Alberta",
    description: "Full-service digital marketing agency specializing in Alberta and Canadian markets. Expert social media marketing, SEO, and content creation in Calgary, Edmonton, and across Alberta.",
    url: 'https://culturemedia.ca',
    siteName: 'Culture Media',
    locale: 'en_CA',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Culture Media - Digital Marketing Agency Alberta',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Culture Media | Digital Marketing Agency Alberta",
    description: "Full-service digital marketing agency specializing in Alberta and Canadian markets.",
    images: ['/logo.png'],
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
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'geo.region': 'CA-AB',
    'geo.placename': 'Calgary, Alberta',
    'geo.position': '51.0447;-114.0719',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen flex flex-col`}>
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
