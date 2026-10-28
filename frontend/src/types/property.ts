export type PropertyType = 'tous' | 'parcelle' | 'maison' | 'chambre';

export type TransactionType = 'vente' | 'location';

export interface PropertyItem {
  id: string;
  type: 'parcelle' | 'maison' | 'chambre';
  transactionType: TransactionType;
  title: string;
  location: {
    commune: string;
    quartier: string;
    fullAddress?: string;
  };
  price: number;
  priceFormatted: string;
  periodLabel?: string; // '/mois' or ''
  tags: string[];
  features: {
    chambres?: number;
    salon?: boolean;
    surface?: number;
    titreFoncier?: boolean;
    eauElectricite?: string;
  };
  unlockFee: number;
  unlockButtonText: string;
  image: any;
  isUnlocked?: boolean;
  isFavorite?: boolean;
}

export interface FilterCategory {
  id: PropertyType;
  label: string;
  count?: number;
}
