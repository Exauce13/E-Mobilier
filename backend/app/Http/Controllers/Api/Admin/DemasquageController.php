<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Demande_client;
use App\Models\DemandeDemasquage;
use App\Models\Visite_client;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DemasquageController extends Controller
{
    /**
     * Soumet une demande formelle de démasquage temporaire sur un dossier précis.
     * Réservé aux Secrétaires et Responsables de zone.
     */
    public function demander(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'type_dossier' => ['required', 'string', Rule::in(['visite', 'demande_client'])],
            'dossier_id' => ['required', 'integer'],
            'motif' => ['required', 'string', 'max:255'],
            'justification' => ['required', 'string', 'min:10', 'max:1000'],
        ]);

        // 1. Vérification de l'existence effective du dossier cible
        if ($validated['type_dossier'] === 'visite') {
            $dossier = Visite_client::with(['propriete', 'client'])->findOrFail($validated['dossier_id']);
            // Contrôle d'affectation pour Resp. Zone
            if ($user->isResponsableZone()) {
                $userZoneId = $user->zone_id;
                $visiteZoneId = $dossier->zone_id ?? $dossier->propriete?->zone_id;
                if ($visiteZoneId !== $userZoneId && $dossier->target_agent_id !== $user->id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Action refusée : Vous ne pouvez pas demander le démasquage d\'un dossier hors de votre zone.',
                    ], 403);
                }
            }
        } else {
            $dossier = Demande_client::with('client')->findOrFail($validated['dossier_id']);
            if ($user->isResponsableZone()) {
                $userZone = $user->zone;
                $commune = $userZone?->commune;
                $isSameZone = ($dossier->zone_id && $dossier->zone_id === $user->zone_id);
                $isSameCommune = ($commune && str_contains(strtolower($dossier->target_commune), strtolower($commune)));
                if (! $isSameZone && ! $isSameCommune) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Action refusée : Cette demande de recherche relève d\'une zone distincte de votre affectation.',
                    ], 403);
                }
            }
        }

        // 2. Empêcher les doublons de demandes actives ou en attente
        $demandeExistante = DemandeDemasquage::where('user_id', $user->id)
            ->where('type_dossier', $validated['type_dossier'])
            ->where('dossier_id', $validated['dossier_id'])
            ->where(function ($q) {
                $q->where('statut', 'en_attente')
                    ->orWhere(function ($activeQ) {
                        $activeQ->where('statut', 'approuve')
                            ->where('expires_at', '>', now());
                    });
            })
            ->first();

        if ($demandeExistante) {
            $msg = $demandeExistante->statut === 'en_attente'
                ? 'Une demande de démasquage est déjà en cours d\'examen par la direction pour ce dossier.'
                : "Vous disposez déjà d'une autorisation active pour ce dossier jusqu'au {$demandeExistante->expires_at->format('d/m/Y H:i')}.";

            return response()->json([
                'success' => false,
                'message' => $msg,
                'statut' => $demandeExistante->statut,
                'demande_id' => $demandeExistante->id,
            ], 422);
        }

        $demande = DemandeDemasquage::create([
            'user_id' => $user->id,
            'type_dossier' => $validated['type_dossier'],
            'dossier_id' => $validated['dossier_id'],
            'motif' => $validated['motif'],
            'justification' => $validated['justification'],
            'statut' => 'en_attente',
            'duree_minutes' => config('emobilier.demasquage_default_ttl_minutes', 120),
        ]);

        AuditService::log('demande_demasquage_soumise', $demande, [
            'type_dossier' => $demande->type_dossier,
            'dossier_id' => $demande->dossier_id,
            'motif' => $demande->motif,
            'demandeur' => $user->email,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Votre demande de démasquage a été transmise aux Super Administrateurs pour examen.',
            'data' => $demande,
        ], 201);
    }

    /**
     * Liste les demandes de démasquage soumises par l'agent connecté.
     */
    public function mesDemandes(Request $request): JsonResponse
    {
        $user = $request->user();

        $demandes = DemandeDemasquage::with(['approbateur:id,name,prenom,email'])
            ->where('user_id', $user->id)
            ->latest()
            ->paginate((int) $request->input('per_page', 20));

        // Injecter dynamiquement l'état d'expiration
        $demandes->getCollection()->transform(function ($item) {
            $item->is_currently_active = $item->isActif();
            if ($item->isActif()) {
                $item->temps_restant_minutes = round(now()->diffInMinutes($item->expires_at, false));
            } else {
                $item->temps_restant_minutes = 0;
            }

            return $item;
        });

        return response()->json([
            'success' => true,
            'message' => 'Historique de vos demandes de démasquage récupéré avec succès.',
            'data' => $demandes,
        ]);
    }

    /**
     * File d'attente des demandes de démasquage en attente d'instruction.
     * Réservé aux Super Administrateurs (Principal et Technique).
     */
    public function enAttente(Request $request): JsonResponse
    {
        $demandes = DemandeDemasquage::with(['user:id,name,prenom,email,statut,zone_id', 'user.zone:id,nom,code'])
            ->where('statut', 'en_attente')
            ->orderBy('created_at', 'asc')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'message' => 'File d\'attente des demandes de démasquage récupérée avec succès.',
            'data' => $demandes,
        ]);
    }

    /**
     * Approuve formellement une demande de démasquage avec durée de vie (TTL).
     */
    public function approuver(Request $request, int $id): JsonResponse
    {
        $approbateur = $request->user();
        $demande = DemandeDemasquage::findOrFail($id);

        if ($demande->statut !== 'en_attente') {
            return response()->json([
                'success' => false,
                'message' => "Cette demande a déjà été traitée (statut actuel : '{$demande->statut}').",
            ], 422);
        }

        $validated = $request->validate([
            'duree_minutes' => ['nullable', 'integer', 'min:15', 'max:1440'],
        ]);

        $duree = $validated['duree_minutes'] ?? config('emobilier.demasquage_default_ttl_minutes', 120);
        $expiresAt = now()->addMinutes($duree);

        $demande->update([
            'statut' => 'approuve',
            'approved_by' => $approbateur->id,
            'approved_at' => now(),
            'duree_minutes' => $duree,
            'expires_at' => $expiresAt,
        ]);

        AuditService::log('approbation_demasquage', $demande, [
            'type_dossier' => $demande->type_dossier,
            'dossier_id' => $demande->dossier_id,
            'beneficiaire_id' => $demande->user_id,
            'approbateur_id' => $approbateur->id,
            'duree_minutes' => $duree,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Demande approuvée avec succès. Coordonnées consultables pendant {$duree} minutes (jusqu'au {$expiresAt->format('d/m/Y H:i')}).",
            'data' => $demande,
        ]);
    }

    /**
     * Rejette une demande de démasquage avec motif d'opposition consigné dans l'audit.
     */
    public function refuser(Request $request, int $id): JsonResponse
    {
        $refuseur = $request->user();
        $demande = DemandeDemasquage::findOrFail($id);

        if ($demande->statut !== 'en_attente') {
            return response()->json([
                'success' => false,
                'message' => "Cette demande a déjà été traitée (statut : '{$demande->statut}').",
            ], 422);
        }

        $validated = $request->validate([
            'motif_refus' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $demande->update([
            'statut' => 'refuse',
            'refused_at' => now(),
            'motif_refus' => $validated['motif_refus'],
        ]);

        AuditService::log('refus_demasquage', $demande, [
            'type_dossier' => $demande->type_dossier,
            'dossier_id' => $demande->dossier_id,
            'beneficiaire_id' => $demande->user_id,
            'refuseur_id' => $refuseur->id,
            'motif_refus' => $validated['motif_refus'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Demande de démasquage refusée.',
            'data' => $demande,
        ]);
    }

    /**
     * Révoque immédiatement une autorisation en cours avant son terme naturel.
     */
    public function revoquer(Request $request, int $id): JsonResponse
    {
        $revoqueur = $request->user();
        $demande = DemandeDemasquage::findOrFail($id);

        if ($demande->statut !== 'approuve') {
            return response()->json([
                'success' => false,
                'message' => 'Seule une demande activement approuvée peut être révoquée.',
            ], 422);
        }

        $demande->update([
            'statut' => 'revoque',
            'revoque_at' => now(),
            'revoque_by' => $revoqueur->id,
            'expires_at' => now(), // Révocation immédiate
        ]);

        AuditService::log('revocation_demasquage', $demande, [
            'type_dossier' => $demande->type_dossier,
            'dossier_id' => $demande->dossier_id,
            'beneficiaire_id' => $demande->user_id,
            'revoqueur_id' => $revoqueur->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Autorisation de démasquage révoquée immédiatement.',
            'data' => $demande,
        ]);
    }

    /**
     * POINT CRITIQUE DE SÉCURITÉ :
     * Délivre les coordonnées réelles d'un dossier unitaire si et seulement si l'appelant
     * est Super Admin ou dispose d'une autorisation TTL active (now < expires_at).
     * Journalise chaque lecture dans l'audit.
     */
    public function coordonnees(Request $request, string $type, int $id): JsonResponse
    {
        $user = $request->user();

        // 1. Validation du type
        if (! in_array($type, ['visite', 'demande_client'], true)) {
            return response()->json([
                'success' => false,
                'message' => "Type de dossier invalide. Valeurs admises : 'visite' ou 'demande_client'.",
            ], 422);
        }

        // 2. Récupération du dossier cible et du client
        if ($type === 'visite') {
            $dossier = Visite_client::with(['client', 'propriete'])->findOrFail($id);
            $client = $dossier->client;
            $ref = 'VIS-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
        } else {
            $dossier = Demande_client::with('client')->findOrFail($id);
            $client = $dossier->client;
            $ref = 'DEM-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
        }

        if (! $client) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun profil client associé à ce dossier.',
            ], 404);
        }

        // 3. Contrôle des droits d'accès
        $isSuperAdmin = $user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique();
        $hasActiveTtl = DemandeDemasquage::hasActiveAccess($user->id, $type, $id);

        if (! $isSuperAdmin && ! $hasActiveTtl) {
            AuditService::securityAlert('TENTATIVE_LECTURE_COORDONNEES_SANS_AUTORISATION', "L'utilisateur ID {$user->id} ({$user->email}) a tenté de lire les coordonnées du dossier {$ref} sans autorisation valide.", [
                'type_dossier' => $type,
                'dossier_id' => $id,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Accès refusé : Vous ne disposez pas d\'une autorisation active et non expirée pour consulter les coordonnées réelles de ce client.',
                'code' => 'UNAUTHORIZED_CONTACT_ACCESS',
                'demasquage_requis' => true,
            ], 403);
        }

        // 4. Récupération de l'échéance si sous TTL
        $expiresAt = null;
        if (! $isSuperAdmin) {
            $grant = DemandeDemasquage::where('user_id', $user->id)
                ->where('type_dossier', $type)
                ->where('dossier_id', $id)
                ->where('statut', 'approuve')
                ->where('expires_at', '>', now())
                ->latest()
                ->first();
            $expiresAt = $grant?->expires_at?->toIso8601String();
        }

        // 5. Journalisation obligatoire de chaque lecture de données sensibles
        AuditService::log('consultation_coordonnees_sensibles', $dossier, [
            'type_dossier' => $type,
            'dossier_id' => $id,
            'reference' => $ref,
            'client_cible_id' => $client->id,
            'consulte_par' => $user->email,
            'mode_acces' => $isSuperAdmin ? 'SUPER_ADMIN' : 'TTL_DEMASQUAGE',
            'expires_at' => $expiresAt,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Coordonnées réelles du client débloquées avec succès.',
            'data' => [
                'dossier_reference' => $ref,
                'client_id' => $client->id,
                'nom' => $client->name,
                'prenom' => $client->prenom,
                'nom_complet' => $client->full_name,
                'telephone' => $client->telephone,
                'email' => $client->email,
                'is_verifed' => $client->is_verifed,
                'mode_acces' => $isSuperAdmin ? 'Permanent (Super Admin)' : 'Temporaire (TTL)',
                'expires_at' => $expiresAt,
            ],
        ]);
    }
}

