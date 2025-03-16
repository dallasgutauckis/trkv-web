"use client";

import { useState } from 'react';
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Menu, X, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/vips', label: 'VIP List' },
    { href: '/dashboard/channel-points', label: 'Channel Points' },
    { href: '/dashboard/vip-activity', label: 'VIP Activity' },
    { href: '/dashboard/settings', label: 'Settings' },
  ];

  // Add admin debug link for specific user
  if (session?.user?.name?.toLowerCase() === "defnotdallas") {
    navItems.push({
      href: "/dashboard/admin-debug",
      label: "Admin Debug",
    });
  }

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
                className={cn(
                  'text-sm font-medium transition-colors hover:text-purple-400',
                  pathname === item.href
                    ? 'text-purple-400'
                    : 'text-gray-400'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {session?.user?.name && (
            <span className="text-sm text-gray-400">
              {session.user.name}
            </span>
          )}
          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="text-sm"
          >
            Sign Out
          </Button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden">
          <nav className="px-4 pt-4 pb-6 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block py-2 text-base font-medium transition-colors hover:text-purple-400',
                  pathname === item.href
                    ? 'text-purple-400'
                    : 'text-gray-400'
                )}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
} 