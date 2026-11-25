import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PropertyInquiryItem } from '@/types/api';

const FAVORITES_KEY = 'e_mobilier_favorites_v1';
const LOCAL_INQUIRIES_KEY = 'e_mobilier_local_inquiries_v1';

export const favoritesStorage = {
  getAll: async (): Promise<Set<string>> => {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  },

  toggle: async (id: string): Promise<Set<string>> => {
    const current = await favoritesStorage.getAll();
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(current)));
    } catch {
      // Ignore storage error
    }
    return current;
  },
};

export const localInquiriesStorage = {
  list: async (): Promise<PropertyInquiryItem[]> => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_INQUIRIES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  add: async (item: PropertyInquiryItem): Promise<void> => {
    try {
      const current = await localInquiriesStorage.list();
      const next = [item, ...current.filter((i) => i.id !== item.id)].slice(0, 50);
      await AsyncStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  },
};
