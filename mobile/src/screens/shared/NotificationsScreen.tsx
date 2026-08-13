import { useCallback, useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState, Group, NavBar, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../store/slices/notificationSlice';
import { colors, radius, spacing, typography } from '../../theme';

/**
 * PRD 8.1 — the in-app notification list. Unread is marked by a single accent
 * dot and a heavier title; read entries simply go quiet.
 */
export function NotificationsScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { items, unread, loading } = useAppSelector((state) => state.notification);

  useEffect(() => {
    void dispatch(fetchNotifications());
  }, [dispatch]);

  const refresh = useCallback(() => {
    void dispatch(fetchNotifications());
  }, [dispatch]);

  return (
    <Screen edges={['top']}>
      <NavBar
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          unread > 0 ? (
            <Pressable onPress={() => dispatch(markAllNotificationsRead())} hitSlop={8}>
              <Text style={styles.markAll}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      {items.length === 0 && !loading ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          message="Order updates and store offers will show up here."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
        >
          <Group>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (!item.read) dispatch(markNotificationRead(item.id));
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.dot, !item.read && styles.dotUnread]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.title, item.read && styles.titleRead]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.time}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  {item.body ? (
                    <Text style={[styles.body, item.read && styles.bodyRead]}>{item.body}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </Group>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { ...typography.calloutStrong, color: colors.primary },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },

  row: {
    flexDirection: 'row',
    gap: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg + 2,
  },
  rowPressed: { backgroundColor: '#FAFAFB' },
  dot: { width: 8, height: 8, borderRadius: radius.pill, marginTop: 7 },
  dotUnread: { backgroundColor: colors.primary },

  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  title: { ...typography.bodyStrong, fontWeight: '600', color: colors.text, flex: 1 },
  titleRead: { fontWeight: '500', color: colors.textMuted },
  time: { ...typography.footnote, color: colors.textFaint },
  body: { ...typography.callout, color: colors.textMuted, lineHeight: 23, marginTop: spacing.xs },
  bodyRead: { color: colors.textFaint },
});
