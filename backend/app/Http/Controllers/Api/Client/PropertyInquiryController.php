<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\PropertyInquiryRequest;
use App\Models\NotificationInterne;
use App\Models\PropertyInquiry;
use App\Models\Proprietes;
use App\Models\Visite_client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PropertyInquiryController extends Controller
{
    /**
     * Enregistre une demande d'action sur un bien (demande de visite, prise de RDV,
     * contact propriétaire/agent) ou un formulaire client complet.
     * Accessible connecté ou non (les coordonnées Nom, Prénom, Téléphone, E-mail sont toujours enregistrées).
     */
    public function store(PropertyInquiryRequest $request, int|string|null $propertyIdParam = null): JsonResponse
    {
        $user = $request->user('sanctum') ?? $request->user();
        $propertyId = $propertyIdParam ?? $request->input('property_id');
        $propriete = null;
        $recipientId = null;

        if ($propertyId) {
            $propriete = Proprietes::with('user')->find($propertyId);
            if (! $propriete) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le bien immobilier sélectionné est introuvable.',
                ], 404);
            }
            $recipientId = $propriete->user_id;
        }

        $inquiry = PropertyInquiry::create([
            'property_id' => $propriete?->id,
            'user_id' => $user?->id,
            'recipient_id' => $recipientId,
            'type' => $request->input('type'),
            'nom' => trim((string) $request->input('nom')),
            'prenom' => trim((string) $request->input('prenom')),
            'telephone' => trim((string) $request->input('telephone')),
            'email' => trim((string) $request->input('email')),
            'scheduled_date' => $request->input('scheduled_date'),
            'meeting_mode' => $request->input('meeting_mode'),
            'sujet' => $request->input('sujet'),
            'commune' => $request->input('commune') ?? $propriete?->commune,
            'quartier' => $request->input('quartier') ?? $propriete?->quartier,
            'budget' => $request->input('budget'),
            'message' => $request->input('message'),
            'status' => 'nouveau',
        ]);

        // RÈGLE DE MONOPOLE E-MOBILIER :
        // Un client propriétaire ne doit JAMAIS recevoir de notification ni voir les demandes faites sur ses biens.
        // Seul un Agent mobilier est informé de façon anonyme (prénom + nom uniquement, zéro contact).
        $recipientIsAgent = $propriete && $propriete->user && $propriete->user->hasRole('Agent mobilier');
        if ($recipientId && $recipientIsAgent && (! $user || $recipientId !== $user->id)) {
            try {
                NotificationInterne::create([
                    'user_id' => $recipientId,
                    'type' => 'property_inquiry',
                    'titre' => 'Nouvelle sollicitation sur votre bien',
                    'message' => sprintf(
                        '%s %s a manifesté son intérêt pour votre bien #%d (%s). La coordination est assurée par E-Mobilier.',
                        $inquiry->prenom,
                        $inquiry->nom,
                        $propriete->id,
                        $propriete->commune
                    ),
                    'data' => [
                        'property_id' => $propriete->id,
                    ],
                    'lu' => false,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Notification interne inquiry ignorée : ' . $e->getMessage());
            }
        }

        $successMessages = [
            'demande_visite' => 'Votre demande de visite a été enregistrée avec succès. Notre équipe vous contactera rapidement.',
            'rendez_vous' => 'Votre rendez-vous a été enregistré avec succès. Une confirmation vous sera transmise.',
            'contact' => 'Votre message a bien été transmis au propriétaire / agent immobilier.',
            'formulaire_client' => 'Votre formulaire client a été enregistré avec succès. Un conseiller E-Mobilier vous recontactera.',
        ];

        return response()->json([
            'success' => true,
            'message' => $successMessages[$inquiry->type] ?? 'Votre demande a été enregistrée avec succès.',
            'data' => $inquiry->load(['propriete:id,type,transaction_type,commune,quartier,prix,status']),
        ], 201);
    }

    /**
     * Liste les demandes / contacts / rendez-vous envoyés par l'utilisateur connecté.
     */
    public function mesDemandes(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        $query = PropertyInquiry::with(['propriete:id,type,transaction_type,commune,quartier,prix,status'])
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id);
                if ($user->email) {
                    $q->orWhere(function ($sub) use ($user) {
                        $sub->whereNull('user_id')
                            ->where('email', $user->email);
                    });
                }
            })
            ->latest();

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $paginated = $query->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $paginated,
        ], 200);
    }

    /**
     * Tableau de bord pour l'Agent Immobilier uniquement (RÈGLE DE MONOPOLE E-MOBILIER) :
     * - Interdit aux Clients propriétaires (un client ne voit JAMAIS les demandes faites sur ses biens).
     * - L'Agent voit ses biens + les demandes de visite sur ses biens avec UNIQUEMENT le nom/prénom du client
     *   (téléphone et email strictement masqués, zéro CRM contact direct).
     */
    public function agentDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        if (! $user->hasRole('Agent mobilier') && ! $user->isAnyAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Accès réservé aux Agents mobiliers agréés.',
            ], 403);
        }

        $myProperties = Proprietes::where('user_id', $user->id)
            ->with(['media', 'documents'])
            ->latest()
            ->get();

        // Règle de monopole : uniquement les visites où l'agent est target_agent_id,
        // avec UNIQUEMENT id, name, prenom du client (ZÉRO téléphone, ZÉRO email).
        $receivedVisits = Visite_client::with([
            'propriete:id,type,transaction_type,commune,quartier,prix,status',
            'client:id,name,prenom',
        ])
            ->where('target_agent_id', $user->id)
            ->latest()
            ->limit(50)
            ->get()
            ->map(function (Visite_client $v) {
                $arr = $v->toArray();
                if (isset($arr['client']) && is_array($arr['client'])) {
                    $arr['client'] = [
                        'id' => $arr['client']['id'] ?? null,
                        'name' => $arr['client']['name'] ?? '',
                        'prenom' => $arr['client']['prenom'] ?? '',
                        'telephone' => null,
                        'email' => null,
                    ];
                }

                return $arr;
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'kpis' => [
                    'total_biens' => $myProperties->count(),
                    'biens_publies' => $myProperties->where('status', 'published')->count(),
                    'biens_en_attente' => $myProperties->whereIn('status', ['pending', 'pending_payment'])->count(),
                    'biens_conclus' => $myProperties->where('status', 'sold_rented')->count(),
                    'total_visites' => $receivedVisits->count(),
                    'visites_en_attente' => $receivedVisits->where('status', 'pending')->count(),
                    'total_demandes' => 0,
                    'demandes_nouvelles' => 0,
                    'total_clients' => 0,
                ],
                'proprietes' => $myProperties,
                'inquiries' => [],
                'visites' => $receivedVisits,
                'clients' => [],
            ],
        ], 200);
    }

    /**
     * Met à jour le statut d'une demande (Agent destinataire, Admin, ou annulation par le demandeur).
     */
    public function updateStatut(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        $inquiry = PropertyInquiry::find($id);
        if (! $inquiry) {
            return response()->json(['success' => false, 'message' => 'Demande introuvable.'], 404);
        }

        $request->validate([
            'status' => ['required', 'string', 'in:nouveau,en_cours,confirme,traite,annule'],
        ]);

        $newStatus = $request->input('status');
        $isAdmin = $user->hasAnyRole(['Admin', 'Super Admin Principal', 'Super Admin Technique', 'Secrétaire']);
        $isRecipient = $inquiry->recipient_id === $user->id;
        $isRequester = $inquiry->user_id === $user->id;

        if (! $isAdmin && ! $isRecipient && ! ($isRequester && $newStatus === 'annule')) {
            return response()->json([
                'success' => false,
                'message' => "Vous n'êtes pas autorisé à modifier cette demande.",
            ], 403);
        }

        $inquiry->update(['status' => $newStatus]);

        return response()->json([
            'success' => true,
            'message' => 'Statut mis à jour avec succès.',
            'data' => $inquiry,
        ], 200);
    }
}
