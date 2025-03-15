import { db } from '@/lib/firebase';

interface AuditLogEntry {
  channelId: string;
  action: string;
  username: string;
  userId: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Add an entry to the audit log
 */
export async function addAuditLog(entry: AuditLogEntry): Promise<string> {
  try {
    // Add timestamp if not provided
    if (!entry.timestamp) {
      entry.timestamp = new Date();
    }
    
    // Add to audit log collection
    const docRef = await db.collection('auditLogs').add(entry);
    console.log(`Added audit log entry: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error adding audit log entry:', error);
    throw error;
  }
} 