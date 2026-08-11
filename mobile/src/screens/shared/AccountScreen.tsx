import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Card, Screen } from '../../components/ui';
import {
  PERMISSIONS,
  useAppDispatch,
  useAppSelector,
  useIsStaff,
  usePermission,
} from '../../store/hooks';
import { applyForWholesale, refreshProfile, signOut } from '../../store/slices/authSlice';
import { setPermission, setPushToken } from '../../store/slices/notificationSlice';
import { registerForPush } from '../../utils/push';
import { colors, spacing, typography, wholesaleStatusStyle } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const unread = useAppSelector((state) => state.notification.unread);
  const pushPermission = useAppSelector((state) => state.notification.permission);
  const isStaff = useIsStaff();
  const canBroadcast = usePermission(PERMISSIONS.NOTIFICATION_BROADCAST);
  const canManageUsers = usePermission(PERMISSIONS.USER_MANAGE);
  const canManageCategories = usePermission(PERMISSIONS.CATEGORY_MANAGE);

  const [applying, setApplying] = useState(false);

  useEffect(() => {
    void dispatch(refreshProfile());
  }, [dispatch]);

  const handlePushToggle = async (enabled: boolean) => {
    if (!enabled) {
      dispatch(setPermission('denied'));
      return;
    }
    const token = await registerForPush();
    dispatch(setPushToken(token));
    dispatch(setPermission(token ? 'granted' : 'denied'));

    if (!token) {
      Alert.alert(
        'Notifications unavailable',
        'Enable notifications for Manisha Fashions in your device settings. Note that push requires a development build, not Expo Go.',
      );
    }
  };

  const handleApplyWholesale = () => {
    Alert.alert(
      'Apply for wholesale pricing?',
      'An admin will review your application. Wholesale pricing unlocks once approved.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setApplying(true);
            await dispatch(applyForWholesale({}));
            setApplying(false);
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You will need to verify your number again next time.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void dispatch(signOut()) },
    ]);
  };

  if (!user) return <Screen />;

  const status = wholesaleStatusStyle[user.wholesaleStatus];

  return (
    <Screen scroll>
      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.name ?? user.phone).slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name ?? 'Add your name'}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
        </View>
        <Badge
          label={
            user.accountType === 'admin'
              ? 'Admin'
              : user.accountType === 'staff'
                ? 'Staff'
                : status.label
          }
          background={status.bg}
          foreground={status.fg}
        />
      </Card>

      <MenuGroup title="Account">
        <MenuRow label="Profile details" onPress={() => navigation.navigate('Profile')} />
        {!isStaff ? (
          <MenuRow label="Delivery addresses" onPress={() => navigation.navigate('Addresses')} />
        ) : null}
        <MenuRow
          label="Notifications"
          badge={unread > 0 ? unread : undefined}
          onPress={() => navigation.navigate('Notifications')}
        />
      </MenuGroup>

      {isStaff ? (
        <MenuGroup title="Store management">
          {canManageCategories ? (
            <MenuRow label="Categories" onPress={() => navigation.navigate('AdminCategories')} />
          ) : null}
          {canBroadcast ? (
            <MenuRow label="Send a notification" onPress={() => navigation.navigate('AdminNotify')} />
          ) : null}
          {canManageUsers ? (
            <MenuRow label="Customer & staff accounts" onPress={() => navigation.navigate('AdminUsers')} />
          ) : null}
        </MenuGroup>
      ) : null}

      {/* PRD 4.1 — a retail customer can apply for wholesale from inside the app. */}
      {user.accountType === 'retail' ? (
        <Card style={styles.upsell}>
          <Text style={styles.upsellTitle}>Buying for a shop?</Text>
          <Text style={styles.upsellBody}>
            Apply for a wholesale account to see wholesale pricing once an admin approves you.
          </Text>
          <Button
            label="Apply for wholesale"
            onPress={handleApplyWholesale}
            variant="secondary"
            loading={applying}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <MenuGroup title="Preferences">
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowHint}>Order updates and offers</Text>
          </View>
          <Switch
            value={pushPermission === 'granted'}
            onValueChange={handlePushToggle}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>
      </MenuGroup>

      <Button label="Sign out" onPress={handleSignOut} variant="ghost" />
    </Screen>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <Card style={styles.groupCard}>{children}</Card>
    </View>
  );
}

function MenuRow({
  label,
  onPress,
  badge,
}: {
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.menuRight}>
        {badge ? <Badge label={String(badge)} background={colors.primary} foreground={colors.textInverse} /> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.title, color: colors.primary },
  name: { ...typography.bodyStrong, color: colors.text },
  phone: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  group: { marginBottom: spacing.xl },
  groupTitle: { ...typography.tiny, color: colors.textMuted, marginBottom: spacing.sm, letterSpacing: 0.6 },
  groupCard: { padding: 0 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { ...typography.body, color: colors.text },
  rowHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  upsell: { marginBottom: spacing.xl, backgroundColor: colors.goldSoft, borderColor: colors.goldSoft },
  upsellTitle: { ...typography.heading, color: colors.text },
  upsellBody: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
