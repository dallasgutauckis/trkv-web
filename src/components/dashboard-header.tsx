"use client";

import { useState } from 'react';
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/vips', label: 'VIP List' },
  { href: '/dashboard/channel-points', label: 'Channel Points' },
  { href: '/dashboard/vip-activity', label: 'VIP Activity' },
  { href: '/dashboard/test-redemption', label: 'Test Redemption' },
  { href: '/dashboard/settings', label: 'Settings' },
];

// Add debug page in development mode
if (process.env.NODE_ENV === 'development') {
  navItems.push({ href: '/dashboard/debug', label: 'Debug' });
}

export default function DashboardHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <header className="bg-[#18181B] border-b border-[#2D2D30] py-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <Link href="/dashboard" className="text-xl font-bold text-purple-400">
            Twitch VIP Manager
          </Link>
          <nav className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm font-medium hidden md:inline">
            {session?.user?.name}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
} 