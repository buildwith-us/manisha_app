import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as Device from 'expo-device';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import {
  clearTokens,
  getRefreshToken,
  isTokenExpired,
  loadTokens,
  saveTokens,
} from '../../api/tokenStorage';
import type { Address, User } from '../../api/types';

/**
 * PRD 8.1 authSlice — current user, phone number, account type and wholesale
 * approval status. Also owns the app-start token lifecycle from PRD 8.10.
 */

export type AuthStatus = 'booting' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Phone awaiting OTP entry, kept so the OTP screen can resend. */
  pendingPhone: string | null;
  pendingAccountType: 'retail' | 'wholesale';
  /** Wholesale details typed on the login screen, submitted with the OTP. */
  pendingApplication: { businessName?: string; gstNumber?: string } | null;
  /** Populated only in development, where the API echoes the OTP back. */
  devCode: string | null;
  otpExpiresInSeconds: number;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  status: 'booting',
  user: null,
  pendingPhone: null,
  pendingAccountType: 'retail',
  pendingApplication: null,
  devCode: null,
  otpExpiresInSeconds: 0,
  loading: false,
  error: null,
};

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * PRD 8.10 — app start:
 *   no access token         → login screen
 *   token present, expired  → refresh; success → dashboard, failure → login
 *   token present, valid    → straight to the dashboard, no OTP prompt
 */
export const bootstrapSession = createAsyncThunk<User | null>(
  'auth/bootstrap',
  async () => {
    const { accessToken, refreshToken } = await loadTokens();
    if (!accessToken || !refreshToken) return null;

    if (isTokenExpired(accessToken)) {
      try {
        const result = await authApi.refresh(refreshToken);
        await saveTokens(result.accessToken, result.refreshToken);
        return result.user;
      } catch {
        await clearTokens();
        return null;
      }
    }

    try {
      return await authApi.me();
    } catch {
      await clearTokens();
      return null;
    }
  },
);

export const sendOtp = createAsyncThunk<
  { phone: string; devCode?: string; expiresInSeconds: number },
  { phone: string; accountType?: 'retail' | 'wholesale' },
  { rejectValue: string }
>('auth/sendOtp', async ({ phone }, { rejectWithValue }) => {
  try {
    const result = await authApi.sendOtp(phone);
    return { phone, devCode: result.devCode, expiresInSeconds: result.expiresInSeconds };
  } catch (error) {
    return rejectWithValue(messageFor(error));
  }
});

export const verifyOtp = createAsyncThunk<
  User,
  {
    phone: string;
    code: string;
    accountType?: 'retail' | 'wholesale';
    application?: { businessName?: string; gstNumber?: string };
  },
  { rejectValue: string }
>('auth/verifyOtp', async (input, { rejectWithValue }) => {
  try {
    const result = await authApi.verifyOtp({
      ...input,
      deviceId: Device.osInternalBuildId ?? Device.modelId ?? undefined,
    });
    await saveTokens(result.accessToken, result.refreshToken);
    return result.user;
  } catch (error) {
    return rejectWithValue(messageFor(error));
  }
});

export const refreshProfile = createAsyncThunk<User>('auth/refreshProfile', async () =>
  authApi.me(),
);

/** PRD 8.10 — logout invalidates the refresh token server-side, not just on-device. */
export const signOut = createAsyncThunk('auth/signOut', async () => {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await authApi.logout(refreshToken).catch(() => undefined);
  }
  await clearTokens();
});

export const applyForWholesale = createAsyncThunk<
  User,
  { businessName?: string; gstNumber?: string },
  { rejectValue: string }
>('auth/applyForWholesale', async (input, { rejectWithValue }) => {
  try {
    return await authApi.applyForWholesale(input);
  } catch (error) {
    return rejectWithValue(messageFor(error));
  }
});

export const updateProfile = createAsyncThunk<User, { name?: string; email?: string }>(
  'auth/updateProfile',
  async (input) => authApi.updateProfile(input),
);

/* ── Addresses (PRD 4.3) ────────────────────────────────────────────────── */

export const fetchAddresses = createAsyncThunk<Address[]>('auth/fetchAddresses', async () =>
  authApi.listAddresses(),
);

export const saveAddress = createAsyncThunk<
  Address[],
  { id?: string; input: Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean } },
  { rejectValue: string }
>('auth/saveAddress', async ({ id, input }, { rejectWithValue }) => {
  try {
    return id ? await authApi.updateAddress(id, input) : await authApi.addAddress(input);
  } catch (error) {
    return rejectWithValue(messageFor(error));
  }
});

export const deleteAddress = createAsyncThunk<Address[], string>(
  'auth/deleteAddress',
  async (id) => authApi.deleteAddress(id),
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Called by the Axios interceptor when the refresh token is dead. */
    sessionExpired(state) {
      state.status = 'signedOut';
      state.user = null;
      state.error = 'Your session expired. Please sign in again.';
    },
    clearError(state) {
      state.error = null;
    },
    resetOtpFlow(state) {
      state.pendingPhone = null;
      state.devCode = null;
      state.otpExpiresInSeconds = 0;
      state.error = null;
    },
    setPendingAccountType(state, action: PayloadAction<'retail' | 'wholesale'>) {
      state.pendingAccountType = action.payload;
    },
    setPendingApplication(
      state,
      action: PayloadAction<{ businessName?: string; gstNumber?: string } | null>,
    ) {
      state.pendingApplication = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.pending, (state) => {
        state.status = 'booting';
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = action.payload ? 'signedIn' : 'signedOut';
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.status = 'signedOut';
        state.user = null;
      })

      .addCase(sendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingPhone = action.payload.phone;
        state.devCode = action.payload.devCode ?? null;
        state.otpExpiresInSeconds = action.payload.expiresInSeconds;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Could not send the code.';
      })

      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.status = 'signedIn';
        state.pendingPhone = null;
        state.devCode = null;
        state.pendingApplication = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Could not verify the code.';
      })

      .addCase(refreshProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })

      .addCase(signOut.fulfilled, (state) => {
        state.status = 'signedOut';
        state.user = null;
        state.pendingPhone = null;
        state.error = null;
      })

      .addCase(applyForWholesale.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(applyForWholesale.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not submit your application.';
      })

      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })

      .addCase(fetchAddresses.fulfilled, (state, action) => {
        if (state.user) state.user.addresses = action.payload;
      })
      .addCase(saveAddress.fulfilled, (state, action) => {
        if (state.user) state.user.addresses = action.payload;
      })
      .addCase(saveAddress.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not save the address.';
      })
      .addCase(deleteAddress.fulfilled, (state, action) => {
        if (state.user) state.user.addresses = action.payload;
      });
  },
});

export const {
  sessionExpired,
  clearError,
  resetOtpFlow,
  setPendingAccountType,
  setPendingApplication,
} = authSlice.actions;
export default authSlice.reducer;
