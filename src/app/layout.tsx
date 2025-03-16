import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/components/providers/session-provider';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: "Twitch VIP Manager",
    template: "%s | Twitch VIP Manager",
  },
  description: "Manage your Twitch channel VIPs with automated channel point redemptions",
  keywords: ["twitch", "vip", "channel points", "automation", "stream"],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0E0E10] text-[#EFEFF1]`}>
        <SessionProvider session={session}>
          {children}
          <Toaster position="bottom-right" />
        </SessionProvider>
      </body>
    </html>
  );
}
