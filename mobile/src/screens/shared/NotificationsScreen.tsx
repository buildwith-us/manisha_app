import { useCallback, useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../store/slices/notificationSlice';
import { colors, spacing, typography } from '../../theme';

const CATEGORY_GLYPH: Record<string, string> = {
  order: '❐',
  wholesale: '◎',
  promotion: '✦',
  system: '◔',
};

/** PRD 8.1 — the in-app notification list backed by notificationSlice. */
export function NotificationsScreen() {
  const dispatch = useAppDispatch();
  const { items, unread, loading } = useAppSelector((state) => state.notification);

  useEffect(() => {
    void dispatch(fetchNotifications());
  }, [dispatch]);

  const refresh = useCallback(() => {
    void dispatch(fetchNotifications());
  }, [dispatch]);

  if (items.length === 0 && !loading) {
    return (
      <Screen>
        <EmptyState
          icon="◔"
          title="No notifications yet"
          message="Order updates and store offers will show up here."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      {unread > 0 ? (
        <View style={styles.header}>
          <Text style={styles.unreadCount}>{unread} unread</Text>
          <Pressable onPress={() => dispatch(markAllNotificationsRead())} hitSlop={8}>
            <Text style={styles.markAll}>Mark all as read</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (!item.read) dispatch(markNotificationRead(item.id));
            }}
            style={[styles.row, !item.read && styles.rowUnread]}
          >
            <Text style={styles.glyph}>{CATEGORY_GLYPH[item.category] ?? '◔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {!item.read ? <View style={styles.dot} /> : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  unreadCount: { ...typography.caption, color: colors.textMuted },
  markAll: { ...typography.captionStrong, color: colors.primary },
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowUnread: { backgroundColor: colors.primarySoft },
  glyph: { fontSize: 18, color: colors.gold, marginTop: 2 },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 19 },
  time: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
