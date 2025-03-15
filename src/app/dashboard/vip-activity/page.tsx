import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AuditLog from '@/components/audit-log';

export default async function VIPActivityPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">VIP Activity</h1>
      <p className="text-muted-foreground mb-8">
        View a log of all VIP-related actions in your channel.
      </p>
      
      <AuditLog 
        channelId={session.user.id} 
        limit={100}
      />
    </div>
  );
} 