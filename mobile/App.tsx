import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/store';
import { bootstrapSession } from './src/store/slices/authSlice';
import { fetchNotifications, notificationReceived } from './src/store/slices/notificationSlice';

function AppBootstrap() {
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // PRD 8.10 — decide between login and dashboard before the first paint.
    void store.dispatch(bootstrapSession());

    // A push arriving while the app is foregrounded goes straight into the
    // in-app list rather than waiting for the next fetch.
    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      store.dispatch(
        notificationReceived({
          id: notification.request.identifier,
          title: title ?? 'Update',
          body: body ?? '',
          category: 'system',
          read: false,
          createdAt: new Date().toISOString(),
        }),
      );
      void store.dispatch(fetchNotifications());
    });

    return () => {
      receivedListener.current?.remove();
    };
  }, []);

  return <RootNavigator />;
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppBootstrap />
      </SafeAreaProvider>
    </Provider>
  );
}
