import { Metadata } from "next";

export const metadata: Metadata = {
  title: "VIP Management",
  description: "Manage your Twitch channel VIPs",
};

export default function VIPsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 