export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function normalizePhoneInput(raw: string): string {
  return raw.replace(/[\s.-]+/g, '').trim();
}

/**
 * Valide un numéro de téléphone béninois (01XXXXXXXX ou +22901XXXXXXXX) ou international (8-15 chiffres).
 */
export function isValidPhone(phone: string, strictBenin = false): boolean {
  const cleaned = normalizePhoneInput(phone);
  if (!cleaned) return false;
  if (strictBenin) {
    return /^(\+229|00229|229)?01[0-9]{8}$/.test(cleaned);
  }
  return /^(\+?[0-9]{8,15})$/.test(cleaned);
}

export function isValidPersonName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && /^[\p{L}\s''-]+$/u.test(trimmed);
}

export function splitFullName(fullName?: string, nom?: string, prenom?: string): { nom: string; prenom: string } {
  if (nom && prenom) {
    return { nom: nom.trim(), prenom: prenom.trim() };
  }
  const raw = (fullName || nom || prenom || '').trim();
  if (!raw) return { nom: '', prenom: '' };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) {
    return { nom: parts[0], prenom: '' };
  }
  return {
    prenom: parts[0],
    nom: parts.slice(1).join(' '),
  };
}

export function isFutureDateString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = new Date(trimmed.replace(' ', 'T'));
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
}

export function formatLocalFutureDate(daysAhead: number, hour: number, minute = 0): string {
  const d = new Date(Date.now() + daysAhead * 86400 * 1000);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function getStatusDisplay(status: string): { label: string; bg: string; text: string } {
  switch (status.toLowerCase()) {
    case 'published':
    case 'confirmed':
    case 'confirme':
    case 'fulfilled':
    case 'traite':
    case 'completed':
      return {
        label:
          status === 'published'
            ? 'Publié'
            : status === 'confirmed' || status === 'confirme'
            ? 'Confirmé'
            : status === 'completed'
            ? 'Terminée'
            : status === 'fulfilled'
            ? 'Satisfaite'
            : 'Traité',
        bg: '#ECFDF5',
        text: '#047857',
      };
    case 'pending':
    case 'pending_payment':
    case 'en_cours':
    case 'active':
    case 'nouveau':
      return {
        label:
          status === 'pending'
            ? 'En attente'
            : status === 'pending_payment'
            ? 'Paiement requis'
            : status === 'en_cours'
            ? 'En cours'
            : status === 'nouveau'
            ? 'Nouveau'
            : 'Active',
        bg: '#FEF3C7',
        text: '#92400E',
      };
    case 'rejected':
    case 'cancelled':
    case 'annule':
      return {
        label: status === 'rejected' ? 'Rejeté' : 'Annulé',
        bg: '#FEE2E2',
        text: '#B91C1C',
      };
    case 'sold_rented':
    case 'closed':
      return {
        label: status === 'sold_rented' ? 'Conclu' : 'Clôturée',
        bg: '#EFF6FF',
        text: '#1E40AF',
      };
    default:
      return {
        label: status,
        bg: '#F1F5F9',
        text: '#334155',
      };
  }
}

export function getInquiryTypeLabel(type: string): string {
  switch (type) {
    case 'demande_visite':
      return 'Demande de visite';
    case 'rendez_vous':
      return 'Prise de rendez-vous';
    case 'contact':
      return 'Contact propriétaire / agent';
    case 'formulaire_client':
      return 'Formulaire client';
    default:
      return type;
  }
}
