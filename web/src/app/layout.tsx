import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { StackProvider, StackTheme } from '@stackframe/stack';
import { stackServerApp } from '@/stack';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'E24 Property Tracker',
  description: 'Encuentra24 property listings tracker',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StackProvider app={stackServerApp}>
          <StackTheme>
            <Providers>
              {children}
            </Providers>
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}
