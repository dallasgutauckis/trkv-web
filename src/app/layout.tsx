import { Inter } from "next/font/google";
import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Twitch VIP Manager",
    template: "%s | Twitch VIP Manager",
  },
  description:
    "Manage your Twitch channel VIPs with automated channel point redemptions",
  keywords: ["twitch", "vip", "channel points", "automation", "stream"],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
