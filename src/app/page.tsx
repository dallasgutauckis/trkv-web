import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="mt-6 text-4xl font-bold tracking-tight">
            Twitch VIP Manager
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Automate your channel VIP management with channel points
          </p>
        </div>
        <div className="mt-8 space-y-4">
          <Button
            asChild
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Link href="/auth/signin">Get Started</Link>
          </Button>
          <div className="text-center text-sm text-gray-500">
            Streamline your VIP management and reward your community
          </div>
        </div>
      </div>
    </div>
  );
}
