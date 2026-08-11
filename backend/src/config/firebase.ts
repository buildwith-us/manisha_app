import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

/**
 * PRD 8.4 — Firebase Admin SDK sends push via FCM, covering Android and iOS
 * (iOS delivery additionally needs the APNs key uploaded in the Firebase
 * console; see PRD 4.6).
 */
let messaging: admin.messaging.Messaging | null = null;

function loadServiceAccount(): admin.ServiceAccount | null {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount;
    } catch {
      logger.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — push disabled.');
      return null;
    }
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolved = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(resolved)) return null;
    try {
      return JSON.parse(fs.readFileSync(resolved, 'utf8')) as admin.ServiceAccount;
    } catch {
      logger.error(`Could not parse service account at ${resolved} — push disabled.`);
      return null;
    }
  }

  return null;
}

export function initFirebase(): void {
  if (messaging) return;

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    logger.warn('Firebase service account not found — push notifications are disabled.');
    return;
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  messaging = admin.messaging();
  logger.info('Firebase Admin initialised — FCM enabled');
}

export function getMessaging(): admin.messaging.Messaging | null {
  return messaging;
}

/**
 * True only once the SDK has actually initialised. The env var being set is not
 * enough — the service-account file may be missing or unparseable.
 */
export function isFirebaseReady(): boolean {
  return messaging !== null;
}
