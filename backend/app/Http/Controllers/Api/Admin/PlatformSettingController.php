<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Services\AuditService;
use App\Services\PlatformSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PlatformSettingController extends Controller
{
    public function __construct(
        protected PlatformSettingsService $settings
    ) {
    }

    /**
     * Endpoint public : retourne les tarifs officiels et coordonnées de contact
     * dynamiques depuis la base de données.
     */
    public function publicConfig(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->settings->getPublicConfig(),
        ]);
    }

    /**
     * Liste les paramètres administrables.
     * Les paramètres du groupe `finance` (RIB, MoMo, seuil retrait) sont strictement
     * réservés au propriétaire financier (M. Justin MAGNIDE).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isFinancialOwner = $user && $user->isFinancialOwner();

        $query = PlatformSetting::with('updatedBy:id,name,prenom,email')
            ->orderBy('groupe')
            ->orderBy('id');

        if (! $isFinancialOwner) {
            $query->where('groupe', '!=', 'finance');
        }

        $items = $query->get()->map(function (PlatformSetting $setting) use ($isFinancialOwner) {
            $isFinanceProtected = in_array($setting->groupe, ['finance', 'tarifs'], true);

            return [
                'id' => $setting->id,
                'cle' => $setting->cle,
                'valeur' => $setting->typedValue(),
                'valeur_brute' => $setting->valeur,
                'type' => $setting->type,
                'groupe' => $setting->groupe,
                'label' => $setting->label,
                'description' => $setting->description,
                'is_public' => $setting->is_public,
                'editable' => ! $isFinanceProtected || $isFinancialOwner,
                'updated_at' => $setting->updated_at?->toIso8601String(),
                'updated_by' => $setting->updatedBy ? [
                    'id' => $setting->updatedBy->id,
                    'nom' => trim($setting->updatedBy->name . ' ' . $setting->updatedBy->prenom),
                    'email' => $setting->updatedBy->email,
                ] : null,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'can_edit_financial' => $isFinancialOwner,
                'items' => $items->values(),
                'grouped' => $items->groupBy('groupe'),
            ],
        ]);
    }

    /**
     * Met à jour un ou plusieurs paramètres de la plateforme dans une transaction atomique.
     * Toute modification de paramètre financier ou tarifaire est strictement bloquée
     * pour tout utilisateur autre que M. Justin MAGNIDE (`isFinancialOwner()`).
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $isFinancialOwner = $user && $user->isFinancialOwner();

        $validated = $request->validate([
            'settings' => ['required', 'array', 'min:1'],
            'settings.*.cle' => ['required', 'string', 'exists:platform_settings,cle'],
            'settings.*.valeur' => ['required'],
        ]);

        $entries = $validated['settings'];
        $keys = array_column($entries, 'cle');
        $existingSettings = PlatformSetting::whereIn('cle', $keys)->get()->keyBy('cle');

        // 1. Contrôle d'accès financier strict + validation par clé
        $errors = [];
        foreach ($entries as $index => $entry) {
            $setting = $existingSettings->get($entry['cle']);
            if (! $setting) {
                continue;
            }

            if (in_array($setting->groupe, ['finance', 'tarifs'], true) && ! $isFinancialOwner) {
                AuditService::securityAlert(
                    'TENTATIVE_MODIFICATION_PARAMETRE_FINANCIER',
                    "Utilisateur ID {$user->id} ({$user->email}) a tenté de modifier le paramètre financier '{$setting->cle}'.",
                    ['cle' => $setting->cle, 'ip' => $request->ip()]
                );

                return response()->json([
                    'success' => false,
                    'code' => 'FINANCIAL_VAULT_FORBIDDEN',
                    'message' => 'Accès refusé : Seul M. Justin MAGNIDE (propriétaire financier) peut modifier les tarifs et paramètres financiers.',
                ], 403);
            }

            $value = $entry['valeur'];
            $keyRules = $this->validationRulesForKey($setting);
            $v = Validator::make(['valeur' => $value], ['valeur' => $keyRules]);
            if ($v->fails()) {
                $errors["settings.{$index}.valeur"] = $v->errors()->all();
            }
        }

        if (! empty($errors)) {
            return response()->json([
                'success' => false,
                'message' => 'Certaines valeurs de paramètres sont invalides.',
                'errors' => $errors,
            ], 422);
        }

        // Vérification cohérence TTL démasquage (default <= max)
        $newDefaultTtl = null;
        $newMaxTtl = null;
        foreach ($entries as $entry) {
            if ($entry['cle'] === 'demasquage_default_ttl_minutes') {
                $newDefaultTtl = (int) $entry['valeur'];
            } elseif ($entry['cle'] === 'demasquage_max_ttl_minutes') {
                $newMaxTtl = (int) $entry['valeur'];
            }
        }
        $effectiveDefaultTtl = $newDefaultTtl ?? $this->settings->getDemasquageDefaultTtlMinutes();
        $effectiveMaxTtl = $newMaxTtl ?? $this->settings->getDemasquageMaxTtlMinutes();
        if ($effectiveDefaultTtl > $effectiveMaxTtl) {
            return response()->json([
                'success' => false,
                'message' => 'La durée par défaut de démasquage ne peut pas dépasser la durée maximale autorisée.',
            ], 422);
        }

        $updated = DB::transaction(function () use ($entries, $user) {
            $results = [];
            foreach ($entries as $entry) {
                $setting = $this->settings->set($entry['cle'], $entry['valeur'], $user);
                $results[] = [
                    'cle' => $setting->cle,
                    'valeur' => $setting->typedValue(),
                    'groupe' => $setting->groupe,
                    'updated_at' => $setting->updated_at?->toIso8601String(),
                ];
            }

            return $results;
        });

        return response()->json([
            'success' => true,
            'message' => count($updated) . ' paramètre(s) mis à jour avec succès.',
            'data' => [
                'updated' => $updated,
                'public_config' => $this->settings->getPublicConfig(),
            ],
        ]);
    }

    /**
     * Règles de validation spécifiques selon la clé et le type du paramètre.
     *
     * @return array<int, string>
     */
    protected function validationRulesForKey(PlatformSetting $setting): array
    {
        return match ($setting->cle) {
            'tarif_deblocage_coordonnees',
            'tarif_visite',
            'tarif_post_client',
            'tarif_post_agent' => ['integer', 'min:1', 'max:1000000'],
            'retrait_montant_minimum' => ['integer', 'min:100', 'max:10000000'],
            'demasquage_default_ttl_minutes' => ['integer', 'min:15', 'max:1440'],
            'demasquage_max_ttl_minutes' => ['integer', 'min:15', 'max:10080'],
            'support_email' => ['string', 'email', 'max:150'],
            default => match ($setting->type) {
                'integer' => ['integer', 'min:0'],
                'boolean' => ['boolean'],
                default => ['string', 'min:1', 'max:255'],
            },
        };
    }
}
