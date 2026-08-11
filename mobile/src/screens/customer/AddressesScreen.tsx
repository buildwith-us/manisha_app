import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Card, EmptyState, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { deleteAddress, fetchAddresses, saveAddress } from '../../store/slices/authSlice';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Addresses'>;
type Route = RouteProp<RootStackParamList, 'Addresses'>;

/** PRD 4.3 — add / edit / select delivery address, multiple saved addresses. */
export function AddressesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();
  const addresses = useAppSelector((state) => state.auth.user?.addresses ?? []);

  const selectMode = route.params?.selectMode ?? false;

  useEffect(() => {
    void dispatch(fetchAddresses());
  }, [dispatch]);

  const handleSetDefault = async (id: string) => {
    const address = addresses.find((entry) => entry.id === id);
    if (!address || address.isDefault) return;
    await dispatch(saveAddress({ id, input: { ...address, isDefault: true } }));
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove this address?', 'You can add it again later.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void dispatch(deleteAddress(id)),
      },
    ]);
  };

  if (addresses.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="⌂"
          title="No saved addresses"
          message="Add a delivery address to check out faster next time."
          action={
            <Button
              label="Add an address"
              onPress={() => navigation.navigate('AddressForm')}
              fullWidth={false}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['bottom']}>
      {addresses.map((address) => (
        <Card
          key={address.id}
          style={styles.card}
          onPress={
            selectMode
              ? () => {
                  void handleSetDefault(address.id);
                  navigation.goBack();
                }
              : undefined
          }
        >
          <View style={styles.header}>
            <Text style={styles.name}>{address.fullName}</Text>
            <View style={styles.badges}>
              <Badge label={address.label} />
              {address.isDefault ? (
                <Badge
                  label="Default"
                  background={colors.successSoft}
                  foreground={colors.success}
                />
              ) : null}
            </View>
          </View>

          <Text style={styles.line}>
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ''}
          </Text>
          <Text style={styles.line}>
            {address.city}, {address.state} {address.pincode}
          </Text>
          <Text style={styles.line}>{address.phone}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => navigation.navigate('AddressForm', { addressId: address.id })}
              hitSlop={8}
            >
              <Text style={styles.action}>Edit</Text>
            </Pressable>
            {!address.isDefault ? (
              <Pressable onPress={() => handleSetDefault(address.id)} hitSlop={8}>
                <Text style={styles.action}>Set as default</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => handleDelete(address.id)} hitSlop={8}>
              <Text style={[styles.action, styles.destructive]}>Remove</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      <Button
        label="Add another address"
        onPress={() => navigation.navigate('AddressForm')}
        variant="secondary"
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  name: { ...typography.bodyStrong, color: colors.text },
  badges: { flexDirection: 'row', gap: spacing.xs },
  line: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { ...typography.captionStrong, color: colors.primary },
  destructive: { color: colors.danger },
});
