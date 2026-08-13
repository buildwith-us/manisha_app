import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { authApi } from '../api/endpoints';

/**
 * PRD 4.6 / 8.1 — notification permissions and the local notification handler.
 *
 * Remote push is NOT wired: Firebase/FCM was removed from this project, and the
 * backend has no push provider. Order updates and offers still arrive in the
 * in-app notification list, which is served from the API — only out-of-app
 * delivery is absent.
 *
 * To restore push, add a provider server-side (`deliverPush` in
 * backend/src/services/notification.service.ts) and return its token here:
 * Expo Push needs `getExpoPushTokenAsync`, native FCM/APNs needs
 * `getDevicePushTokenAsync` plus the corresponding native config.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function requestPushPermission(): Promise<PushPermission> {
  if (!Device.isDevice) return 'undetermined';

  if (Platform.OS === 'android') {
    // Android 13+ needs a channel to exist before the permission prompt.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Order & offer updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return 'granted';

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (requested.granted) return 'granted';
  return requested.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Requests permission only. There is no push provider to obtain a token from,
 * so nothing is registered with the backend and null is returned — callers
 * already treat null as "push unavailable" and fall back to the in-app list.
 */
export async function registerForPush(): Promise<string | null> {
  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;
  return null;
}

export async function unregisterFromPush(token: string): Promise<void> {
  await authApi.unregisterDevice(token).catch(() => undefined);
}
