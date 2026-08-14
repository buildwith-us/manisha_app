import type { NavigatorScreenParams } from '@react-navigation/native';
import type { OrderStatus, RazorpayHandle } from '../api/types';

export type CustomerTabParamList = {
  Catalog: undefined;
  Wishlist: undefined;
  Cart: undefined;
  Orders: undefined;
  Account: undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Manage: undefined;
  AdminOrders: { status?: OrderStatus } | undefined;
  Wholesale: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Otp: undefined;
  WholesalePending: undefined;

  // Shells
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList>;
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;

  // Customer
  ProductDetail: { productId: string };
  Filters: undefined;
  Checkout: undefined;
  RazorpayCheckout: { orderId: string; handle: RazorpayHandle };
  OrderConfirmation: { orderId: string };
  OrderDetail: { orderId: string };
  Addresses: { selectMode?: boolean } | undefined;
  AddressForm: { addressId?: string } | undefined;
  Profile: undefined;

  // Admin
  AdminProductForm: { productId?: string } | undefined;
  AdminCategories: undefined;
  AdminOrderDetail: { orderId: string };
  AdminUsers: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
