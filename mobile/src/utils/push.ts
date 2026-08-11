import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { authApi } from '../api/endpoints';

/**
 * PRD 4.6 / 8.4 — the backend pushes through Firebase Admin, so the app must
 * register its NATIVE device token (FCM on Android, APNs on iOS), not an Expo
 * push token. getDevicePushTokenAsync returns exactly that.
 *
 * Note: remote push requires a development build — it does not work in Expo Go
 * on Android from SDK 53 onward.
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

/** Registers this device's native token with the backend. Returns the token. */
export async function registerForPush(): Promise<string | null> {
  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;

  try {
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    const token = String(devicePushToken.data);

    await authApi.registerDevice({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceId: Device.osInternalBuildId ?? undefined,
    });

    return token;
  } catch {
    // A missing google-services.json / APNs key should not crash sign-in.
    return null;
  }
}

export async function unregisterFromPush(token: string): Promise<void> {
  await authApi.unregisterDevice(token).catch(() => undefined);
}
