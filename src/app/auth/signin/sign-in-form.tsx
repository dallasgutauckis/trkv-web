'use client';

import { useEffect, useState } from "react";
import { signIn, getProviders } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInForm() {
  const [providers, setProviders] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const loadProviders = async () => {
      const providers = await getProviders();
      setProviders(providers);
    };
    loadProviders();
  }, []);

  return (
    <div className="grid gap-6">
      {providers?.twitch && (
        <Button
          variant="default"
          onClick={() => signIn("twitch", { callbackUrl: "/dashboard" })}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-4 w-4"
          >
            <path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" />
          </svg>
          Sign in with Twitch
        </Button>
      )}
    </div>
  );
} 