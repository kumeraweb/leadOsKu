import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'leadOsKu',
  description: 'LeadOS MVP operativo'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
