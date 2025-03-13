import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Authentication Error - Twitch VIP Manager",
  description: "An error occurred during authentication",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessage = getErrorMessage(searchParams.error);

  return (
    <div className="container flex h-screen w-full flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/auth/signin">Try Again</Link>
        </Button>
      </div>
    </div>
  );
}

function getErrorMessage(error?: string): string {
  switch (error) {
    case "Callback":
      return "There was a problem with the Twitch callback. Please try again.";
    case "AccessDenied":
      return "You denied access to your Twitch account. Please try again and accept the permissions.";
    case "Configuration":
      return "There is a problem with the server configuration. Please try again later.";
    case "OAuthSignin":
      return "Could not sign in with Twitch. Please try again.";
    case "OAuthCallback":
      return "Could not verify the Twitch callback. Please try again.";
    case "OAuthCreateAccount":
      return "Could not create an account. Please try again.";
    case "EmailCreateAccount":
      return "Could not create an account. Please try again.";
    case "Verification":
      return "The verification process failed. Please try again.";
    case "Default":
    default:
      return "An unexpected error occurred. Please try again.";
  }
} 