import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  try {
    // In Google Cloud Run, we can use the default credentials
    if (process.env.K_SERVICE) {
      console.log('Initializing Firebase Admin in Google Cloud Run environment');
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.PROJECT_ID || 'terkvs-thing',
      });
    }
    // For local development with service account
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Initializing Firebase Admin with service account');
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.PROJECT_ID || 'terkvs-thing',
      });
    }
    // Fallback for other environments
    else {
      console.log('Initializing Firebase Admin with default configuration');
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.PROJECT_ID || 'terkvs-thing',
      });
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    // Initialize with default credentials as fallback
    console.log('Falling back to default Firebase Admin initialization');
    initializeApp();
  }
}

// Get Firestore instance
const db = getFirestore();

export { db }; 