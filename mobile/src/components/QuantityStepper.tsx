import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export function QuantityStepper({
  quantity,
  onChange,
  min = 0,
  max = 999,
  disabled = false,
}: {
  quantity: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const canDecrease = !disabled && quantity > min;
  const canIncrease = !disabled && quantity < max;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onChange(quantity - 1)}
        disabled={!canDecrease}
        hitSlop={6}
        style={[styles.button, !canDecrease && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Text style={styles.symbol}>−</Text>
      </Pressable>

      <Text style={styles.quantity}>{quantity}</Text>

      <Pressable
        onPress={() => onChange(quantity + 1)}
        disabled={!canIncrease}
        hitSlop={6}
        style={[styles.button, !canIncrease && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
      >
        <Text style={styles.symbol}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  button: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  buttonDisabled: { opacity: 0.4 },
  symbol: { fontSize: 18, color: colors.text, lineHeight: 22 },
  quantity: {
    ...typography.bodyStrong,
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
});
