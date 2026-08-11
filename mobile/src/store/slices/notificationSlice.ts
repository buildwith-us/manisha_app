import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { notificationApi } from '../../api/endpoints';
import type { AppNotification } from '../../api/types';

/**
 * PRD 8.1 notificationSlice — FCM token registration, permission state and the
 * in-app notification list.
 */

type PermissionState = 'unknown' | 'granted' | 'denied' | 'undetermined';

interface NotificationState {
  items: AppNotification[];
  unread: number;
  permission: PermissionState;
  pushToken: string | null;
  loading: boolean;
}

const initialState: NotificationState = {
  items: [],
  unread: 0,
  permission: 'unknown',
  pushToken: null,
  loading: false,
};

export const fetchNotifications = createAsyncThunk<{ items: AppNotification[]; unread: number }>(
  'notification/fetch',
  async () => {
    const { data } = await notificationApi.list(1, 50);
    return data;
  },
);

export const markNotificationRead = createAsyncThunk<string, string>(
  'notification/markRead',
  async (id) => {
    await notificationApi.markRead(id);
    return id;
  },
);

export const markAllNotificationsRead = createAsyncThunk<void>(
  'notification/markAllRead',
  async () => {
    await notificationApi.markAllRead();
  },
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setPermission(state, action: PayloadAction<PermissionState>) {
      state.permission = action.payload;
    },
    setPushToken(state, action: PayloadAction<string | null>) {
      state.pushToken = action.payload;
    },
    /** A push arriving while the app is open goes straight into the list. */
    notificationReceived(state, action: PayloadAction<AppNotification>) {
      state.items = [action.payload, ...state.items];
      state.unread += 1;
    },
    resetNotifications(state) {
      state.items = [];
      state.unread = 0;
      state.pushToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.unread = action.payload.unread;
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.loading = false;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.items = state.items.map((item) =>
          item.id === action.payload ? { ...item, read: true } : item,
        );
        state.unread = Math.max(0, state.unread - 1);
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((item) => ({ ...item, read: true }));
        state.unread = 0;
      });
  },
});

export const { setPermission, setPushToken, notificationReceived, resetNotifications } =
  notificationSlice.actions;
export default notificationSlice.reducer;
