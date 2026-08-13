import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Button,
  ErrorBanner,
  Group,
  LoadingView,
  NavBar,
  Screen,
  SectionLabel,
  SelectionMark,
} from '../../components/ui';
import { configApi, type StoreConfig } from '../../api/endpoints';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { checkout, clearError, fetchCart } from '../../store/slices/cartSlice';
import { fetchAddresses } from '../../store/slices/authSlice';
import { colors, radius, shadow, spacing, typography } from '../../theme';
import { formatPaise } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/types';
import type { PaymentMethod } from '../../api/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Checkout'>;

/**
 * PRD 4.3 / 4.4 — order summary, address selection, and payment method.
 * Three grouped decisions and one total: Razorpay orders ship free, COD adds
 * the flat shipping charge the server owns.
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
  const [firstItem, ...restItems] = cart.items;
  const restCount = restItems.reduce((sum, item) => sum + item.quantity, 0);
  const restTotal = restItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <Screen edges={['top']}>
      <NavBar title="Checkout" onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {error ? <ErrorBanner message={error} onRetry={() => dispatch(clearError())} /> : null}

        <SectionLabel>Deliver to</SectionLabel>
        {selectedAddress ? (
          <View style={[styles.addressCard, shadow]}>
            <View style={styles.addressTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressName}>{selectedAddress.fullName}</Text>
                <Text style={styles.addressLine}>
                  {selectedAddress.line1}
                  {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}
                  {'\n'}
                  {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                </Text>
                <Text style={styles.addressLine}>{selectedAddress.phone}</Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('Addresses', { selectMode: true })}
                hitSlop={8}
              >
                <Text style={styles.action}>Change</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.addressCard, shadow]}>
            <Text style={styles.addressLine}>
              You have no saved addresses yet. Add one to continue.
            </Text>
            <Button
              label="Add a delivery address"
              onPress={() => navigation.navigate('AddressForm')}
              variant="secondary"
              style={{ marginTop: spacing.lg }}
            />
          </View>
        )}

        <View style={styles.block}>
          <SectionLabel>Payment</SectionLabel>
          <Group>
            <PaymentOption
              selected={paymentMethod === 'razorpay'}
              disabled={config ? !config.razorpayEnabled : false}
              onPress={() => setPaymentMethod('razorpay')}
              title="Pay online"
              subtitle="UPI, cards & netbanking"
              note={config && !config.razorpayEnabled ? 'Unavailable' : 'Free'}
              noteTone={config && !config.razorpayEnabled ? 'muted' : 'success'}
            />
            <PaymentOption
              selected={paymentMethod === 'cod'}
              onPress={() => setPaymentMethod('cod')}
              title="Cash on delivery"
              subtitle="Pay the courier on arrival"
              note={config ? `+${formatPaise(config.codShippingCharge)}` : undefined}
            />
          </Group>
        </View>

        <View style={styles.block}>
          <SectionLabel>Order summary</SectionLabel>
          <View style={[styles.summaryCard, shadow]}>
            {firstItem ? (
              <SummaryLine
                label={`${firstItem.quantity} × ${firstItem.product.name}`}
                value={formatPaise(firstItem.lineTotal)}
              />
            ) : null}
            {restCount > 0 ? (
              <SummaryLine
                label={`${restCount} more item${restCount === 1 ? '' : 's'}`}
                value={formatPaise(restTotal)}
                divided
              />
            ) : null}
            <SummaryLine
              label="Shipping"
              value={shippingCharge === 0 ? 'Free' : formatPaise(shippingCharge)}
              valueTone={shippingCharge === 0 ? 'success' : 'default'}
              divided
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPaise(total)}</Text>
        </View>
        <Button
          label={paymentMethod === 'cod' ? 'Place order' : 'Pay now'}
          onPress={handlePlaceOrder}
          loading={placingOrder}
          disabled={!selectedAddressId || cart.items.length === 0}
        />
      </View>
    </Screen>
  );
}

/** A grouped row whose leading mark carries the selection. */
function PaymentOption({
  selected,
  onPress,
  title,
  subtitle,
  note,
  noteTone = 'muted',
  disabled = false,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  note?: string;
  noteTone?: 'muted' | 'success';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.option,
        disabled && styles.optionDisabled,
        pressed && !disabled && styles.optionPressed,
      ]}
    >
      <SelectionMark selected={selected} />
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      {note ? (
        <Text style={noteTone === 'success' ? styles.optionFree : styles.optionNote}>{note}</Text>
      ) : null}
    </Pressable>
  );
}

function SummaryLine({
  label,
  value,
  divided = false,
  valueTone = 'default',
}: {
  label: string;
  value: string;
  divided?: boolean;
  valueTone?: 'default' | 'success';
}) {
  return (
    <View style={[styles.summaryLine, divided && styles.summaryDivided]}>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, valueTone === 'success' && { color: colors.success }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },
  block: { marginTop: spacing.xl },

  addressCard: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface },
  addressTop: { flexDirection: 'row', gap: spacing.lg },
  addressName: { ...typography.bodyStrong, fontWeight: '600', color: colors.text },
  addressLine: { ...typography.callout, color: colors.textMuted, lineHeight: 23, marginTop: 6 },
  action: { ...typography.calloutStrong, color: colors.primary },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg - 2,
  },
  optionPressed: { backgroundColor: '#FAFAFB' },
  optionDisabled: { opacity: 0.5 },
  optionTitle: { ...typography.bodyStrong, color: colors.text },
  optionSubtitle: { ...typography.caption, color: colors.textFaint, marginTop: 3 },
  optionFree: { ...typography.captionStrong, color: colors.success },
  optionNote: { ...typography.caption, color: colors.textFaint },

  summaryCard: { paddingHorizontal: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 13,
  },
  summaryDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  summaryLabel: { ...typography.callout, color: colors.textMuted, flex: 1 },
  summaryValue: { ...typography.calloutStrong, color: colors.text },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md + 2,
  },
  totalLabel: { ...typography.callout, color: colors.textMuted },
  totalValue: { ...typography.title2, color: colors.text },
});
