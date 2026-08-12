import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Database } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const APP_STATE_DOC = doc(db, 'appState', 'current');

let isQuotaExhausted = false;

function handleQuotaError(error: any) {
  const isQuota = 
    error?.code === 'resource-exhausted' || 
    (typeof error?.message === 'string' && (error.message.includes('Quota limit exceeded') || error.message.includes('resource-exhausted')));
  if (isQuota) {
    if (!isQuotaExhausted) {
      isQuotaExhausted = true;
      console.warn('Firestore daily write/read quota limit reached. Falling back gracefully to local storage.');
    }
    return true;
  }
  return false;
}

export async function saveToFirestore(dbData: Database): Promise<boolean> {
  if (isQuotaExhausted) return false;
  try {
    // Sanitize undefined fields for Firestore compatibility
    const sanitized = JSON.parse(JSON.stringify(dbData));
    await setDoc(APP_STATE_DOC, sanitized);
    return true;
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to save to Firestore:', error);
    }
    return false;
  }
}

export async function fetchFromFirestore(): Promise<Database | null> {
  if (isQuotaExhausted) return null;
  try {
    const snap = await getDoc(APP_STATE_DOC);
    if (snap.exists()) {
      return snap.data() as Database;
    }
    return null;
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to fetch from Firestore:', error);
    }
    return null;
  }
}

export function subscribeToFirestore(onUpdate: (data: Database) => void): () => void {
  if (isQuotaExhausted) return () => {};
  try {
    return onSnapshot(
      APP_STATE_DOC,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Database;
          if (data && data.teams) {
            onUpdate(data);
          }
        }
      },
      (error: any) => {
        if (!handleQuotaError(error)) {
          console.warn('Firestore snapshot error:', error);
        }
      }
    );
  } catch (error: any) {
    if (!handleQuotaError(error)) {
      console.warn('Failed to set up Firestore listener:', error);
    }
    return () => {};
  }
}


