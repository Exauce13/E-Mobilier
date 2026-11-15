import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaymentOperationType } from '@/types/api';

export interface StoredPaymentRef {
  reference: string;
  transactionId: string;
  operation: PaymentOperationType;
  amount: number;
  label: string;
  createdAt: string;
}

const STORAGE_KEY = 'e_mobilier_payment_refs';
let memoryRefs: StoredPaymentRef[] = [];

export const paymentHistoryStorage = {
  add: async (entry: StoredPaymentRef): Promise<void> => {
    memoryRefs = [entry, ...memoryRefs.filter((r) => r.reference !== entry.reference)].slice(0, 30);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryRefs));
    } catch {
      // Ignore storage error
    }
  },
  list: async (): Promise<StoredPaymentRef[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryRefs = parsed;
        }
      }
    } catch {
      // Ignore parse error
    }
    return memoryRefs;
  },
};
