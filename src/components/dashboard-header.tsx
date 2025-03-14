"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardHeader() {
  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="container mx-auto py-4 px-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center">
          <div className="h-8 w-2 twitch-gradient rounded-sm mr-3"></div>
          <h1 className="text-xl font-semibold text-[var(--card-foreground)]">Twitch VIP Manager</h1>
        </Link>
        <Button
          onClick={handleSignOut}
          className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
} 