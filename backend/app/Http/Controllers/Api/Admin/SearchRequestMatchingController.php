<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DemandeClientResource;
use App\Models\Demande_client;
use App\Models\NotificationInterne;
use App\Models\Proprietes;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use App\Services\PropertyMatchingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchRequestMatchingController extends Controller
{
    public function __construct(
        protected PropertyMatchingService $matchingService
    ) {
    }

    /**
     * Assigne formellement la demande de recherche à l'administrateur connecté
     * (ou permet au Super Admin Principal de réattribuer à un gestionnaire précis).
     * Empêche la double prise en charge concurrente grâce à un verrouillage SQL.
     */
    public function prendreEnCharge(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'gestionnaire_id' => ['nullable', 'integer', 'exists:users,id'],
            'force_reassign' => ['nullable', 'boolean'],
        ]);

        return DB::transaction(function () use ($request, $id, $user, $validated) {
            $demande = Demande_client::with('gestionnaire:id,name,prenom,email')->lockForUpdate()->findOrFail($id);

            if (! $this->canAccessDemande($user, $demande)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Accès interdit : demande hors de votre zone.',
                ], 403);
            }

            if ($demande->isCloturee()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Action impossible : cette demande de recherche est déjà clôturée.',
                ], 422);
            }

            $isSuperAdminPrincipal = $user->isSuperAdminPrincipal();
            $forceReassign = ! empty($validated['force_reassign']) && $isSuperAdminPrincipal;
            $targetAssigneeId = $user->id;

            if (! empty($validated['gestionnaire_id'])) {
                if (! $isSuperAdminPrincipal && (int) $validated['gestionnaire_id'] !== (int) $user->id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Seul le Super Administrateur Principal peut réattribuer une demande à un autre agent.',
                    ], 403);
                }
                $targetUser = User::findOrFail((int) $validated['gestionnaire_id']);
                if (! $targetUser->isAnyAdmin() && ! $targetUser->hasRole('Agent mobilier')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'L\'utilisateur sélectionné n\'est pas un gestionnaire ou agent autorisé.',
                    ], 422);
                }
                $targetAssigneeId = $targetUser->id;
            }

            // Empêcher plusieurs agents de prendre simultanément en charge la même demande
            if ($demande->gestionnaire_id !== null && ! $forceReassign) {
                if ((int) $demande->gestionnaire_id === (int) $targetAssigneeId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cette demande est déjà prise en charge par cet agent.',
                    ], 409);
                }

                $nomResponsable = $demande->gestionnaire?->full_name ?: "Agent #{$demande->gestionnaire_id}";

                return response()->json([
                    'success' => false,
                    'message' => "Cette demande est déjà prise en charge par {$nomResponsable}. Seul le Super Administrateur Principal peut la réattribuer.",
                ], 409);
            }

            $ancienStatut = $demande->workflow_status;
            $ancienGestionnaireId = $demande->gestionnaire_id;

            $demande->update([
                'gestionnaire_id' => $targetAssigneeId,
                'prise_en_charge_at' => now(),
            ]);

            $demande->refresh()->load([
                'client',
                'zone',
                'gestionnaire:id,name,prenom,email',
                'cloturePar:id,name,prenom,email',
                'matchedPropriete.media',
                'proprietesAssociees.media',
            ]);

            AuditService::log(
                $ancienGestionnaireId ? 'demande_recherche_reattribuee' : 'demande_recherche_prise_en_charge',
                $demande,
                [
                    'ancien_statut' => $ancienStatut,
                    'nouveau_statut' => $demande->workflow_status,
                    'ancien_gestionnaire_id' => $ancienGestionnaireId,
                    'gestionnaire_id' => $targetAssigneeId,
                    'effectue_par' => $user->id,
                ]
            );

            return response()->json([
                'success' => true,
                'message' => $ancienGestionnaireId
                    ? 'Dossier de recherche réattribué avec succès.'
                    : 'Dossier de recherche pris en charge avec succès.',
                'demande' => new DemandeClientResource($demande),
            ]);
        });
    }

    /**
     * Algorithme multicritères de rapprochement (Matching Engine) entre la demande et le catalogue publié.
     */
    public function matchingBiens(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::with(['proprietesAssociees.media', 'matchedPropriete.media'])->findOrFail($id);

        if (! $this->canAccessDemande($user, $demande)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès interdit : demande hors de votre zone.',
            ], 403);
        }

        $resultats = $this->matchingService->findMatches($demande);

        // Biens déjà associés (pour consultation ultérieure)
        $biensAssocies = $demande->proprietesAssociees->map(function (Proprietes $prop) {
            $img = $prop->media->first(fn ($m) => ($m->media_type ?? 'image') === 'image') ?? $prop->media->first();
            return [
                'propriete_id' => $prop->id,
                'type' => $prop->type,
                'transaction_type' => $prop->transaction_type,
                'commune' => $prop->commune,
                'arrondissement' => $prop->arrondissement,
                'quartier' => $prop->quartier,
                'prix' => (float) $prop->prix,
                'surface' => $prop->surface !== null ? (float) $prop->surface : null,
                'nombres_chambres' => $prop->nombres_chambres,
                'status' => $prop->status,
                'photo_url' => $img?->media_url,
                'score_matching_pourcentage' => $prop->pivot?->score_matching,
                'note_agent' => $prop->pivot?->note_agent,
                'client_notifie' => (bool) ($prop->pivot?->client_notifie ?? false),
                'notifie_at' => $prop->pivot?->notifie_at,
                'associe_at' => $prop->pivot?->created_at,
            ];
        })->values()->all();

        return response()->json([
            'success' => true,
            'demande_id' => $demande->id,
            'reference_dossier' => 'DEM-' . str_pad((string) $demande->id, 5, '0', STR_PAD_LEFT),
            'criteres_recherche' => [
                'type' => $demande->property_type,
                'transaction' => $demande->transaction_type,
                'commune' => $demande->target_commune,
                'arrondissement' => $demande->target_arrondissement,
                'quartier' => $demande->target_quartier,
                'budget_max' => (float) $demande->budget_max,
                'criteria_details' => $demande->criteria_details,
            ],
            'total_biens_compatibles' => count($resultats),
            'biens_suggeres' => $resultats,
            'biens_associes' => $biensAssocies,
        ]);
    }

    /**
     * Associe formellement un ou plusieurs biens disponibles (publiés) au dossier client
     * et expédie une notification (SMS + Notification interne in-app) au client.
     */
    public function associerBien(Request $request, int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::with(['client', 'proprietesAssociees'])->findOrFail($id);

        if (! $this->canAccessDemande($user, $demande)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès interdit : demande hors de votre zone.',
            ], 403);
        }

        if ($demande->isCloturee()) {
            return response()->json([
                'success' => false,
                'message' => 'Action impossible : cette demande est déjà clôturée.',
            ], 422);
        }

        if (! $this->canManageDemande($user, $demande)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé : cette demande est attribuée à un autre agent.',
            ], 403);
        }

        $validated = $request->validate([
            'propriete_id' => ['required_without:propriete_ids', 'integer', 'exists:proprietes,id'],
            'propriete_ids' => ['required_without:propriete_id', 'array', 'min:1', 'max:20'],
            'propriete_ids.*' => ['integer', 'exists:proprietes,id'],
            'note_agent' => ['nullable', 'string', 'max:500'],
            'notifier_client' => ['nullable', 'boolean'],
        ]);

        $ids = [];
        if (! empty($validated['propriete_ids'])) {
            $ids = array_values(array_unique(array_map('intval', $validated['propriete_ids'])));
        } elseif (! empty($validated['propriete_id'])) {
            $ids = [(int) $validated['propriete_id']];
        }

        $proprietes = Proprietes::whereIn('id', $ids)->get();
        $indisponibles = $proprietes->filter(fn (Proprietes $p) => $p->status !== 'published');
        if ($indisponibles->isNotEmpty()) {
            $badIds = $indisponibles->pluck('id')->implode(', #');
            return response()->json([
                'success' => false,
                'message' => "Impossible d'associer un bien indisponible ou non publié (#{$badIds}). Seuls les biens publiés sont éligibles.",
            ], 422);
        }

        $notifierClient = array_key_exists('notifier_client', $validated) ? (bool) $validated['notifier_client'] : true;
        $noteAgent = $validated['note_agent'] ?? null;

        DB::transaction(function () use ($demande, $proprietes, $user, $noteAgent, $notifierClient) {
            // Si la demande n'était pas encore prise en charge, l'attribuer automatiquement à l'agent
            $updates = [
                'matched_propriete_id' => $proprietes->first()->id,
            ];
            if ($demande->gestionnaire_id === null) {
                $updates['gestionnaire_id'] = $user->id;
                $updates['prise_en_charge_at'] = now();
            }
            $demande->update($updates);

            foreach ($proprietes as $prop) {
                $eval = $this->matchingService->evaluate($demande, $prop);
                $demande->proprietesAssociees()->syncWithoutDetaching([
                    $prop->id => [
                        'associe_par_id' => $user->id,
                        'score_matching' => $eval['score'],
                        'note_agent' => $noteAgent,
                        'client_notifie' => $notifierClient,
                        'notifie_at' => $notifierClient ? now() : null,
                    ],
                ]);
            }
        });

        AuditService::log('demande_recherche_bien_associe', $demande, [
            'gestionnaire_id' => $user->id,
            'propriete_ids' => $proprietes->pluck('id')->all(),
            'propriete_id' => $proprietes->first()->id,
            'note_agent' => $noteAgent,
            'notifier_client' => $notifierClient,
        ]);

        // Notification du client (SMS + Notification interne in-app)
        if ($notifierClient && $demande->client) {
            $count = $proprietes->count();
            $first = $proprietes->first();
            $resume = $count === 1
                ? "Un bien correspondant à votre recherche a été sélectionné pour vous (#{$first->id} - {$first->type} à {$first->commune})."
                : "{$count} biens correspondant à votre recherche ont été sélectionnés pour vous (dont #{$first->id} - {$first->type} à {$first->commune}).";

            $contenu = "E-MOBILIER : {$resume} Consultez votre espace pour découvrir les détails et planifier une visite.";

            $notificationService->dispatchWithFallback(
                canal: 'sms',
                filePriorite: 'notifications-paiement',
                destinataireType: 'client',
                destinataireIdentifiant: $demande->client->telephone ?? $demande->client->email,
                sujet: 'Nouvelle opportunité immobilière',
                contenuPublic: $contenu,
                userId: $demande->client_id,
                referenceEvenement: "DEM-{$demande->id}"
            );

            NotificationInterne::create([
                'user_id' => $demande->client_id,
                'type' => 'matching_bien',
                'titre' => $count === 1 ? 'Un bien proposé pour votre recherche' : "{$count} biens proposés pour votre recherche",
                'message' => $resume . ($noteAgent ? " Note : {$noteAgent}" : ''),
                'data' => [
                    'demande_id' => $demande->id,
                    'propriete_ids' => $proprietes->pluck('id')->all(),
                    'reference' => 'DEM-' . str_pad((string) $demande->id, 5, '0', STR_PAD_LEFT),
                ],
            ]);
        }

        $demande->refresh()->load([
            'client',
            'zone',
            'gestionnaire:id,name,prenom,email',
            'cloturePar:id,name,prenom,email',
            'matchedPropriete.media',
            'proprietesAssociees.media',
        ]);

        $msgCount = $proprietes->count();
        $msg = $msgCount > 1
            ? "{$msgCount} biens ont été rattachés à la demande" . ($notifierClient ? ' et le client a été notifié.' : '.')
            : 'Le bien a été rattaché à la demande' . ($notifierClient ? ' et le client a été notifié.' : '.');

        return response()->json([
            'success' => true,
            'message' => $msg,
            'demande' => new DemandeClientResource($demande),
        ]);
    }

    /**
     * Clôture formelle de la demande de recherche avec validation stricte des transitions,
     * des permissions et des règles d'expiration.
     */
    public function cloturer(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $demande = Demande_client::findOrFail($id);

        if (! $this->canAccessDemande($user, $demande)) {
            return response()->json([
                'success' => false,
                'message' => 'Accès interdit : demande hors de votre zone.',
            ], 403);
        }

        if ($demande->isCloturee()) {
            return response()->json([
                'success' => false,
                'message' => "Transition invalide : cette demande est déjà clôturée (statut : {$demande->workflow_status}).",
            ], 422);
        }

        $validated = $request->validate([
            'motif_cloture' => ['required', 'string', 'in:satisfaite,abandonnee_client,delai_depasse'],
            'motif_details' => ['nullable', 'string', 'max:1000'],
        ]);

        $motif = $validated['motif_cloture'];

        // Vérification des droits : seul l'agent responsable ou le Super Admin Principal peut clôturer
        // (pour delai_depasse, autorisé aussi si non assignée mais réellement expirée)
        if ($motif !== 'delai_depasse' && ! $user->isSuperAdminPrincipal()) {
            if ($demande->gestionnaire_id === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Veuillez d\'abord prendre en charge cette demande avant de la clôturer.',
                ], 422);
            }
            if ((int) $demande->gestionnaire_id !== (int) $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Accès refusé : seul l\'agent responsable ou le Super Administrateur Principal peut clôturer cette demande.',
                ], 403);
            }
        }

        // Empêcher l'expiration manuelle arbitraire avant la date limite de validité
        if ($motif === 'delai_depasse') {
            if ($demande->expires_at && now()->lt($demande->expires_at)) {
                $echeance = $demande->expires_at->format('d/m/Y à H:i');
                return response()->json([
                    'success' => false,
                    'message' => "Expiration manuelle refusée : cette demande est encore valide jusqu'au {$echeance}. L'expiration s'effectue automatiquement après cette échéance.",
                ], 422);
            }
        }

        $ancienStatut = $demande->workflow_status;
        $newStatus = $motif === 'satisfaite' ? 'fulfilled' : 'closed';

        $demande->update([
            'status' => $newStatus,
            'motif_cloture' => $motif,
            'motif_cloture_details' => $validated['motif_details'] ?? null,
            'cloture_at' => now(),
            'cloture_par_id' => $user->id,
        ]);

        $demande->refresh()->load([
            'client',
            'zone',
            'gestionnaire:id,name,prenom,email',
            'cloturePar:id,name,prenom,email',
            'matchedPropriete.media',
            'proprietesAssociees.media',
        ]);

        AuditService::log('demande_recherche_cloturee', $demande, [
            'ancien_statut' => $ancienStatut,
            'nouveau_statut' => $demande->workflow_status,
            'gestionnaire_id' => $user->id,
            'motif_cloture' => $motif,
            'motif_details' => $validated['motif_details'] ?? null,
        ]);

        $labels = [
            'satisfaite' => 'Demande marquée comme satisfaite avec succès.',
            'abandonnee_client' => 'Demande clôturée comme abandonnée par le client.',
            'delai_depasse' => 'Demande clôturée comme expirée (échéance dépassée).',
        ];

        return response()->json([
            'success' => true,
            'message' => $labels[$motif] ?? 'Demande de recherche clôturée avec succès.',
            'demande' => new DemandeClientResource($demande),
        ]);
    }

    protected function canAccessDemande(User $user, Demande_client $demande): bool
    {
        if (! $user->isResponsableZone() || $user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
            return true;
        }

        $userZone = $user->zone;
        $commune = $userZone?->commune;
        $isSameZone = ($demande->zone_id && (int) $demande->zone_id === (int) $user->zone_id);
        $isSameCommune = ($commune && $demande->target_commune && str_contains(mb_strtolower($demande->target_commune), mb_strtolower($commune)));

        return $isSameZone || $isSameCommune;
    }

    protected function canManageDemande(User $user, Demande_client $demande): bool
    {
        if ($user->isSuperAdminPrincipal()) {
            return true;
        }

        if ($demande->gestionnaire_id === null) {
            return true;
        }

        return (int) $demande->gestionnaire_id === (int) $user->id;
    }
}
