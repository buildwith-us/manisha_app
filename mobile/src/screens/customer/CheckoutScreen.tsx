import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Button, Card, ErrorBanner, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { configApi, type StoreConfig } from '../../api/endpoints';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { checkout, clearError, fetchCart } from '../../store/slices/cartSlice';
import { fetchAddresses } from '../../store/slices/authSlice';
import { colors, radius, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { PaymentMethod } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Checkout'>;

/**
 * PRD 4.3 / 4.4 — order summary, address selection, and payment method.
 * Razorpay orders ship free; COD adds the flat shipping charge the server owns.
 */
export function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const cart = useAppSelector((state) => state.cart.cart);
  const placingOrder = useAppSelector((state) => state.cart.placingOrder);
  const error = useAppSelector((state) => state.cart.error);
  const addresses = useAppSelector((state) => state.auth.user?.addresses ?? []);

  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchCart());
    void dispatch(fetchAddresses());
    configApi
      .get()
      .then((result) => {
        setConfig(result);
        // Fall back to COD when online payment is not configured.
        if (!result.razorpayEnabled) setPaymentMethod('cod');
      })
      .catch(() => setConfig(null));
  }, [dispatch]);

  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      setSelectedAddressId((addresses.find((entry) => entry.isDefault) ?? addresses[0]).id);
    }
  }, [addresses, selectedAddressId]);

  const shippingCharge = useMemo(() => {
    if (!config) return 0;
    return paymentMethod === 'cod' ? config.codShippingCharge : config.prepaidShippingCharge;
  }, [config, paymentMethod]);

  const subtotal = cart?.subtotal ?? 0;
  const total = subtotal + shippingCharge;

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) return;

    const result = await dispatch(checkout({ addressId: selectedAddressId, paymentMethod }));
    if (!checkout.fulfilled.match(result)) return;

    const { order, payment } = result.payload;

    if (order.paymentMethod === 'razorpay' && payment) {
      navigation.replace('RazorpayCheckout', { orderId: order.id, handle: payment });
      return;
    }
    navigation.replace('OrderConfirmation', { orderId: order.id });
  };

  if (!cart) return <LoadingView />;

  const selectedAddress = addresses.find((entry) => entry.id === selectedAddressId);

  return (
    <Screen scroll edges={['bottom']}>
      {error ? <ErrorBanner message={error} onRetry={() => dispatch(clearError())} /> : null}

      <SectionHeader
        title="Deliver to"
        action={
          <Pressable onPress={() => navigation.navigate('Addresses', { selectMode: true })}>
            <Text style={styles.link}>{addresses.length > 0 ? 'Change' : 'Add'}</Text>
          </Pressable>
        }
      />

      {selectedAddress ? (
        <Card style={{ marginBottom: spacing.xl }}>
          <View style={styles.addressHeader}>
            <Text style={styles.addressName}>{selectedAddress.fullName}</Text>
            <Badge label={selectedAddress.label} />
          </View>
          <Text style={styles.addressLine}>
            {selectedAddress.line1}
            {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}
          </Text>
          <Text style={styles.addressLine}>
            {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
          </Text>
          <Text style={styles.addressPhone}>{selectedAddress.phone}</Text>
        </Card>
      ) : (
        <Card style={{ marginBottom: spacing.xl }}>
          <Text style={styles.muted}>
            You have no saved addresses yet. Add one to continue.
          </Text>
          <Button
            label="Add a delivery address"
            onPress={() => navigation.navigate('AddressForm')}
            variant="secondary"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      <SectionHeader title="Payment method" />
      <View style={{ marginBottom: spacing.xl }}>
        <PaymentOption
          selected={paymentMethod === 'razorpay'}
          disabled={config ? !config.razorpayEnabled : false}
          onPress={() => setPaymentMethod('razorpay')}
          title="Pay online"
          subtitle="UPI, cards, netbanking & wallets — no shipping charge"
          note={config && !config.razorpayEnabled ? 'Currently unavailable' : 'Free shipping'}
        />
        <PaymentOption
          selected={paymentMethod === 'cod'}
          onPress={() => setPaymentMethod('cod')}
          title="Cash on delivery"
          subtitle="Pay the courier when your order arrives"
          note={config ? `+${formatPaise(config.codShippingCharge)} shipping` : undefined}
        />
      </View>

      <SectionHeader title="Order summary" />
      <Card>
        {cart.items.map((item) => (
          <View key={item.productId} style={styles.summaryLine}>
            <Text style={styles.summaryItem} numberOfLines={1}>
              {item.quantity} × {item.product.name}
            </Text>
            <Text style={styles.summaryAmount}>{formatPaise(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.separator} />

        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryAmount}>{formatPaise(subtotal)}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={styles.summaryAmount}>
            {shippingCharge === 0 ? 'Free' : formatPaise(shippingCharge)}
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.summaryLine}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatPaise(total)}</Text>
        </View>

        {cart.priceTier === 'wholesale' ? (
          <Text style={styles.tierNote}>Wholesale pricing applied to this order.</Text>
        ) : null}
      </Card>

      <Button
        label={paymentMethod === 'cod' ? 'Place order' : 'Pay now'}
        onPress={handlePlaceOrder}
        loading={placingOrder}
        disabled={!selectedAddressId || cart.items.length === 0}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

function PaymentOption({
  selected,
  onPress,
  title,
  subtitle,
  note,
  disabled = false,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected, disabled && styles.optionDisabled]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      {note ? <Text style={styles.optionNote}>{note}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { ...typography.captionStrong, color: colors.primary },
  muted: { ...typography.caption, color: colors.textMuted },

  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addressName: { ...typography.bodyStrong, color: colors.text },
  addressLine: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  addressPhone: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionDisabled: { opacity: 0.5 },
  optionTitle: { ...typography.bodyStrong, color: colors.text },
  optionSubtitle: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  optionNote: { ...typography.tiny, color: colors.primary },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  summaryItem: { ...typography.caption, color: colors.textMuted, flex: 1 },
  summaryLabel: { ...typography.body, color: colors.textMuted },
  summaryAmount: { ...typography.bodyStrong, color: colors.text },
  totalLabel: { ...typography.heading, color: colors.text },
  totalAmount: { ...typography.title, color: colors.primary },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  tierNote: { ...typography.tiny, color: colors.success, marginTop: spacing.sm },
});
