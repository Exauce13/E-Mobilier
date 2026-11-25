<?php

namespace App\Services;

use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Throwable;

class PlatformSettingsService
{
    public const CACHE_KEY = 'emobilier:platform_settings:all';

    /**
     * Cache en mémoire par requête pour éviter toute requête répétée.
     *
     * @var array<string, mixed>|null
     */
    protected static ?array $memoryCache = null;

    /**
     * Charge tous les paramètres (cache applicatif + mémoire).
     * Retourne un tableau vide sans lever d'exception si la table n'est pas encore migrée.
     *
     * @return array<string, mixed>
     */
    public function allValues(): array
    {
        if (self::$memoryCache !== null) {
            return self::$memoryCache;
        }

        try {
            $values = Cache::remember(self::CACHE_KEY, 300, function () {
                if (! Schema::hasTable('platform_settings')) {
                    return [];
                }

                $result = [];
                foreach (PlatformSetting::all() as $setting) {
                    $result[$setting->cle] = $setting->typedValue();
                }

                return $result;
            });

            self::$memoryCache = is_array($values) ? $values : [];
        } catch (Throwable) {
            self::$memoryCache = [];
        }

        return self::$memoryCache;
    }

    /**
     * Invalide les caches mémoire et applicatif.
     */
    public function clearCache(): void
    {
        self::$memoryCache = null;
        Cache::forget(self::CACHE_KEY);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $all = $this->allValues();

        return array_key_exists($key, $all) && $all[$key] !== null
            ? $all[$key]
            : $default;
    }

    public function getInt(string $key, int $default = 0): int
    {
        $val = $this->get($key, $default);

        return is_numeric($val) ? (int) $val : $default;
    }

    public function getString(string $key, string $default = ''): string
    {
        $val = $this->get($key, $default);

        return is_scalar($val) ? (string) $val : $default;
    }

    /**
     * Tarifs officiels de la plateforme (en FCFA), centralisés en BDD avec fallback config.
     *
     * @return array{deblocage_coordonnees: int, visite: int, post_client: int, post_agent: int}
     */
    public function getTarifs(): array
    {
        return [
            'deblocage_coordonnees' => $this->getInt(
                'tarif_deblocage_coordonnees',
                (int) config('emobilier.tarifs_officiels.deblocage_coordonnees', 50)
            ),
            'visite' => $this->getInt(
                'tarif_visite',
                (int) config('emobilier.tarifs_officiels.visite', 500)
            ),
            'post_client' => $this->getInt(
                'tarif_post_client',
                (int) config('emobilier.tarifs_officiels.post_client', 500)
            ),
            'post_agent' => $this->getInt(
                'tarif_post_agent',
                (int) config('emobilier.tarifs_officiels.post_agent', 100)
            ),
        ];
    }

    /**
     * Coordonnées du compte bénéficiaire officiel pour les décaissements.
     *
     * @return array{titulaire: string, mobile_money: string, rib_bancaire: string}
     */
    public function getBeneficiaireOfficiel(): array
    {
        return [
            'titulaire' => $this->getString(
                'beneficiaire_titulaire',
                (string) config('emobilier.beneficiaire_officiel.titulaire', 'MAGNIDE JUSTIN - E-MOBILIER SARL')
            ),
            'mobile_money' => $this->getString(
                'beneficiaire_momo',
                (string) config('emobilier.beneficiaire_officiel.mobile_money', '+229 97 00 00 01')
            ),
            'rib_bancaire' => $this->getString(
                'beneficiaire_rib',
                (string) config('emobilier.beneficiaire_officiel.rib_bancaire', 'BJ063 01001 00000000000 45')
            ),
        ];
    }

    public function getMinPayoutAmount(): int
    {
        return $this->getInt('retrait_montant_minimum', 1000);
    }

    public function getDemasquageDefaultTtlMinutes(): int
    {
        return $this->getInt(
            'demasquage_default_ttl_minutes',
            (int) config('emobilier.demasquage_default_ttl_minutes', 120)
        );
    }

    public function getDemasquageMaxTtlMinutes(): int
    {
        return $this->getInt(
            'demasquage_max_ttl_minutes',
            (int) config('emobilier.demasquage_max_ttl_minutes', 1440)
        );
    }

    /**
     * Configuration publique exposée au frontend (sans données sensibles ni finance interne).
     */
    public function getPublicConfig(): array
    {
        return [
            'platform_name' => $this->getString('platform_name', 'E-Mobilier'),
            'platform_legal_name' => $this->getString('platform_legal_name', 'E-MOBILIER SARL (Bénin)'),
            'currency' => 'FCFA',
            'tarifs' => $this->getTarifs(),
            'contact' => [
                'phone' => $this->getString('support_phone', '+229 01 97 00 11 22'),
                'email' => $this->getString('support_email', 'contact@e-mobilier.bj'),
                'office_address' => $this->getString('office_address', 'Cadjehoun, Cotonou'),
            ],
        ];
    }

    /**
     * Met à jour un paramètre existant, invalide le cache et journalise dans l'audit immuable.
     */
    public function set(string $key, mixed $value, ?User $actor = null): PlatformSetting
    {
        $setting = PlatformSetting::where('cle', $key)->firstOrFail();
        $oldValue = $setting->valeur;

        $serialized = match ($setting->type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false',
            'json' => is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE),
            'integer' => (string) ((int) $value),
            default => (string) $value,
        };

        $setting->update([
            'valeur' => $serialized,
            'updated_by' => $actor?->id,
        ]);

        $this->clearCache();

        $isFinancial = in_array($setting->groupe, ['finance', 'tarifs'], true);
        AuditService::log(
            'modification_parametre_plateforme',
            $setting,
            [
                'cle' => $setting->cle,
                'groupe' => $setting->groupe,
                'ancienne_valeur' => $oldValue,
                'nouvelle_valeur' => $serialized,
                'modifie_par' => $actor?->email,
            ],
            $isFinancial,
            $actor?->id
        );

        return $setting->fresh();
    }
}
