import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../theme';

/**
 * Typographic tab icons — keeps the bundle free of an icon library while
 * staying crisp at any density.
 */
export function TabIcon({
  glyph,
  focused,
  badge,
}: {
  glyph: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.glyph, { color: focused ? colors.primary : colors.textMuted }]}>
        {glyph}
      </Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: 34, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 19 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.tiny, fontSize: 10, color: colors.textInverse },
});
