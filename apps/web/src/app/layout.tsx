import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SoyBuy · Dynamic Soybean Procurement Strategy',
  description: 'AI/ML & Predictive Decision Support System for ABT-CPD. Problem Statement PS-035, Theme-04.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f4f3ed" />
        <link rel="icon" href="/soybuy-mark.svg" type="image/svg+xml" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
