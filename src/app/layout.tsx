import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { SessionProvider } from '@/components/providers/session-provider';
import { initializeAllMonitoring } from '@/services/twitch-eventsub';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Metadata } from 'next';

// Track initialization to prevent multiple calls
let isInitializing = false;

// Initialize monitoring on server start, but only in production
// or if explicitly enabled in development
if (
  process.env.NODE_ENV === 'production' || 
  process.env.ENABLE_EVENTSUB_IN_DEV === 'true'
) {
  if (!isInitializing) {
    isInitializing = true;
    console.log('Initializing redemption monitoring service...');
    initializeAllMonitoring()
      .then(() => console.log('Redemption monitoring service initialized'))
      .catch(error => console.error('Failed to initialize redemption monitoring:', error))
      .finally(() => {
        isInitializing = false;
      });
  }
}

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
