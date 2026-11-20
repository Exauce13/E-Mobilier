import { ImageSource } from 'expo-image';
import {
  BackendProperty,
  PropertyDocumentItem,
  PropertyMediaItem,
  PropertyUserSummary,
} from '@/types/api';

export type PropertyCategory = 'tous' | 'parcelle' | 'maison' | 'chambre';
export type TransactionType = 'location' | 'vente';

export interface PropertyItem {
  id: string;
  backendId?: number;
  type: Exclude<PropertyCategory, 'tous'>;
  transactionType: TransactionType;
  title: string;
  city?: string;
  address?: string;
  surfaceArea?: number;
  bedrooms?: number;
  location: {
    commune: string;
    arrondissement?: string;
    quartier: string;
    fullAddress: string;
  };
  price: number;
  priceFormatted: string;
  periodLabel: string;
  tags: string[];
  features: {
    chambres?: number;
    salon?: boolean;
    surface?: number;
    titreFoncier?: boolean;
    eauElectricite?: string;
    accessibilite?: string;
    avanceMois?: number;
    isNegotiable?: boolean;
  };
  unlockFee: number;
  visitFee?: number;
  unlockButtonText: string;
  image: ImageSource | number;
  isFavorite: boolean;
  isUnlocked: boolean;
  status?: string;
  motifRejet?: string | null;
  description?: string | null;
  locationDetails?: string | null;
  media?: PropertyMediaItem[];
  documents?: PropertyDocumentItem[];
  owner?: PropertyUserSummary;
}

export interface FilterCategory {
  id: PropertyCategory;
  label: string;
}

const FALLBACK_IMAGES: Record<Exclude<PropertyCategory, 'tous'>, number> = {
  maison: require('@/assets/images/properties/villa_akpakpa.jpg'),
  parcelle: require('@/assets/images/properties/parcelle_calavi.jpg'),
  chambre: require('@/assets/images/properties/chambre_cadjehoun.jpg'),
};

export function formatFcfa(amount: number | string): string {
  const num = Number(amount) || 0;
  return `${Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F CFA`;
}

export function resolveStorageUrl(rawUrl: string | undefined | null, storageBaseUrl: string): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const normalized = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${storageBaseUrl}${normalized}`;
}

export function mapBackendPropertyToItem(
  prop: BackendProperty,
  storageBaseUrl: string,
  favoriteIds: Set<string> = new Set()
): PropertyItem {
  const priceNum = Number(prop.prix) || 0;
  const isLocation = prop.transaction_type === 'location';
  const periodLabel = isLocation ? '/mois' : '';
  const typeLabel =
    prop.type === 'parcelle'
      ? 'Parcelle'
      : prop.type === 'chambre'
      ? 'Chambre'
      : 'Maison';
  const actionLabel = isLocation ? 'à louer' : 'à vendre';
  const locationSuffix = prop.quartier
    ? `${prop.commune} (${prop.quartier})`
    : prop.commune;

  const tags: string[] = [];
  if (prop.nombres_chambres && prop.nombres_chambres > 0) {
    tags.push(`${prop.nombres_chambres} ch`);
  }
  if (prop.surface) {
    tags.push(`${Math.round(Number(prop.surface))} m²`);
  }
  if (prop.eau_courant) {
    tags.push(prop.eau_courant);
  }
  if (prop.is_negotiable) {
    tags.push('Négociable');
  }
  if (isLocation && prop.avance_mois) {
    tags.push(`Avance ${prop.avance_mois} mois`);
  }

  const firstImageMedia = prop.media?.find((m) => m.media_type !== 'video');
  const resolvedImageUri = resolveStorageUrl(firstImageMedia?.media_url, storageBaseUrl);
  const unlockFee = prop.unlock_fee ?? 50;

  return {
    id: String(prop.id),
    backendId: prop.id,
    type: prop.type,
    transactionType: prop.transaction_type,
    title: `${typeLabel} ${actionLabel} - ${locationSuffix}`,
    city: prop.commune,
    address: prop.quartier ? `${prop.quartier}, ${prop.commune}` : prop.commune,
    surfaceArea: Number(prop.surface) || undefined,
    bedrooms: prop.nombres_chambres || undefined,
    location: {
      commune: prop.commune,
      arrondissement: prop.arrondissement ?? undefined,
      quartier: prop.quartier ?? prop.arrondissement ?? '',
      fullAddress: [prop.quartier, prop.arrondissement, prop.commune]
        .filter(Boolean)
        .join(', '),
    },
    price: priceNum,
    priceFormatted: `${formatFcfa(priceNum)}${periodLabel}`,
    periodLabel,
    tags,
    features: {
      chambres: prop.nombres_chambres ?? undefined,
      surface: Number(prop.surface) || undefined,
      titreFoncier: (prop.documents?.length ?? 0) > 0,
      eauElectricite: prop.eau_courant ?? undefined,
      accessibilite: prop.accessibilite ?? undefined,
      avanceMois: prop.avance_mois ?? undefined,
      isNegotiable: prop.is_negotiable ?? false,
    },
    unlockFee,
    visitFee: prop.visit_fee ?? 500,
    unlockButtonText: `Débloquer les détails (${unlockFee} F)`,
    image: resolvedImageUri ? { uri: resolvedImageUri } : FALLBACK_IMAGES[prop.type] ?? FALLBACK_IMAGES.maison,
    isFavorite: favoriteIds.has(String(prop.id)),
    isUnlocked: Boolean(prop.is_unlocked),
    status: prop.status,
    motifRejet: prop.motif_rejet,
    description: prop.description,
    locationDetails: prop.location_details,
    media: prop.media,
    documents: prop.documents,
    owner: prop.user,
  };
}
