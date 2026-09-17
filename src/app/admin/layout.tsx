import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import './admin.css';

// Numbers sit in tabular mono so columns line up; everything else inherits the
// site's Inter from the root layout.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-admin-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Culture Media · Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={`adm ${mono.variable}`}>{children}</div>;
}
