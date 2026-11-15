import type { FilterCategory } from '@/types/property';

export const FILTER_CATEGORIES: FilterCategory[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'parcelle', label: 'Parcelle' },
  { id: 'maison', label: 'Maison' },
  { id: 'chambre', label: 'Chambre à louer' },
];

export const BENIN_COMMUNES: string[] = [
  'Toutes les communes',
  'Cotonou',
  'Abomey-Calavi',
  'Sèmè-Kpodji',
  'Ouidah',
  'Porto-Novo',
  'Parakou',
  'Bohicon',
  'Abomey',
  'Natitingou',
  'Lokossa',
];

export const QUARTIERS_BY_COMMUNE: Record<string, string[]> = {
  Cotonou: [
    'Tous',
    'Fidjrossè',
    'Akpakpa',
    'Cadjehoun',
    'Haie Vive',
    'Agla',
    'Gbégamey',
    'Zogbo',
    'Vèdoko',
    'Mènontin',
  ],
  'Abomey-Calavi': [
    'Tous',
    'Godomey',
    'Calavi Kpota',
    'Togoudo',
    'Zoca',
    'Tankpè',
    'Arconville',
    'Akassato',
  ],
  'Sèmè-Kpodji': ['Tous', 'Ekpè', 'Sèmè-Podji', 'Djeffa', 'Agblangandan'],
  Ouidah: ['Tous', 'Pahou', 'Cococodji', 'Ouidah Centre', 'Djègbadji'],
  'Porto-Novo': ['Tous', 'Ouando', 'Tokpota', 'Djassin', 'Agbokou'],
};
