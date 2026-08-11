import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingView } from '../components/ui';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { WholesalePendingScreen } from '../screens/auth/WholesalePendingScreen';
import { ProductDetailScreen } from '../screens/customer/ProductDetailScreen';
import { FiltersScreen } from '../screens/customer/FiltersScreen';
import { CheckoutScreen } from '../screens/customer/CheckoutScreen';
import { RazorpayCheckoutScreen } from '../screens/customer/RazorpayCheckoutScreen';
import { OrderConfirmationScreen } from '../screens/customer/OrderConfirmationScreen';
import { OrderDetailScreen } from '../screens/customer/OrderDetailScreen';
import { AddressesScreen } from '../screens/customer/AddressesScreen';
import { AddressFormScreen } from '../screens/customer/AddressFormScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { AdminProductFormScreen } from '../screens/admin/AdminProductFormScreen';
import { AdminCategoriesScreen } from '../screens/admin/AdminCategoriesScreen';
import { AdminOrderDetailScreen } from '../screens/admin/AdminOrderDetailScreen';
import { AdminNotifyScreen } from '../screens/admin/AdminNotifyScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { useAppSelector } from '../store/hooks';
import { colors, typography } from '../theme';
import { AdminTabs } from './AdminTabs';
import { CustomerTabs } from './CustomerTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

/**
 * PRD 4.7 / 8.10 — route guarding lives here.
 *
 * Which stack mounts is derived from the signed-in account, not from a
 * navigation call, so a customer account has no reachable route into the admin
 * screens and a blocked wholesale account has no reachable route into the
 * catalogue. The server enforces the same rules independently (PRD 8.8).
 */
export function RootNavigator() {
  const status = useAppSelector((state) => state.auth.status);
  const user = useAppSelector((state) => state.auth.user);

  if (status === 'booting') {
    return <LoadingView label="Signing you in…" />;
  }

  const isStaff = user?.accountType === 'admin' || user?.accountType === 'staff';
  const isBlockedWholesale =
    user?.accountType === 'wholesale' && user.wholesaleStatus !== 'approved';

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleStyle: { ...typography.heading, color: colors.text },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {status === 'signedOut' ? (
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
          </Stack.Group>
        ) : isBlockedWholesale ? (
          // PRD 4.1 — login only: browsing and ordering stay unreachable until
          // an admin approves the application.
          <Stack.Screen
            name="WholesalePending"
            component={WholesalePendingScreen}
            options={{ headerShown: false }}
          />
        ) : isStaff ? (
          <Stack.Group>
            <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="AdminProductForm"
              component={AdminProductFormScreen}
              options={{ title: 'Product' }}
            />
            <Stack.Screen
              name="AdminCategories"
              component={AdminCategoriesScreen}
              options={{ title: 'Categories' }}
            />
            <Stack.Screen
              name="AdminOrderDetail"
              component={AdminOrderDetailScreen}
              options={{ title: 'Order' }}
            />
            <Stack.Screen
              name="AdminNotify"
              component={AdminNotifyScreen}
              options={{ title: 'Send notification' }}
            />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Accounts' }} />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{ title: '' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notifications' }}
            />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen
              name="CustomerTabs"
              component={CustomerTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{ title: '' }}
            />
            <Stack.Screen
              name="Filters"
              component={FiltersScreen}
              options={{ title: 'Filter & sort', presentation: 'modal' }}
            />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
            <Stack.Screen
              name="RazorpayCheckout"
              component={RazorpayCheckoutScreen}
              options={{ title: 'Payment', presentation: 'modal' }}
            />
            <Stack.Screen
              name="OrderConfirmation"
              component={OrderConfirmationScreen}
              options={{ title: 'Order confirmed', headerBackVisible: false }}
            />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
            <Stack.Screen
              name="Addresses"
              component={AddressesScreen}
              options={{ title: 'Delivery addresses' }}
            />
            <Stack.Screen
              name="AddressForm"
              component={AddressFormScreen}
              options={{ title: 'Address' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notifications' }}
            />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
