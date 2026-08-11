import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CatalogScreen } from '../screens/customer/CatalogScreen';
import { WishlistScreen } from '../screens/customer/WishlistScreen';
import { CartScreen } from '../screens/customer/CartScreen';
import { OrdersScreen } from '../screens/customer/OrdersScreen';
import { AccountScreen } from '../screens/shared/AccountScreen';
import { useAppSelector } from '../store/hooks';
import { colors, typography } from '../theme';
import { TabIcon } from './TabIcon';
import type { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

export function CustomerTabs() {
  const cartCount = useAppSelector((state) => state.cart.cart?.itemCount ?? 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: typography.tiny,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused }) => <TabIcon glyph="✦" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused }) => <TabIcon glyph="♡" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Cart',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⛁" focused={focused} badge={cartCount} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon glyph="❐" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }) => <TabIcon glyph="☺" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
