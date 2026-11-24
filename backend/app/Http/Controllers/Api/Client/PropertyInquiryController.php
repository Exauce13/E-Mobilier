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

        // Notification interne silencieuse au destinataire (agent/propriétaire)
        if ($recipientId && (! $user || $recipientId !== $user->id)) {
            try {
                $typeLabel = match ($inquiry->type) {
                    'demande_visite' => 'Nouvelle demande de visite',
                    'rendez_vous' => 'Nouvelle prise de rendez-vous',
                    'contact' => 'Nouveau message de contact',
                    default => 'Nouvelle demande client',
                };

                NotificationInterne::create([
                    'user_id' => $recipientId,
                    'type' => 'property_inquiry',
                    'titre' => $typeLabel,
                    'message' => sprintf(
                        '%s %s souhaite échanger au sujet de votre bien #%d (%s).',
                        $inquiry->prenom,
                        $inquiry->nom,
                        $propriete->id,
                        $propriete->commune
                    ),
                    'data' => [
                        'inquiry_id' => $inquiry->id,
                        'property_id' => $propriete->id,
                        'inquiry_type' => $inquiry->type,
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
                    $q->orWhere('email', $user->email);
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
     * Tableau de bord complet pour l'Agent Immobilier :
     * KPIs biens, visites, demandes reçues et prospects clients.
     */
    public function agentDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        $myProperties = Proprietes::where('user_id', $user->id)
            ->with(['media', 'documents'])
            ->latest()
            ->get();

        $receivedInquiries = PropertyInquiry::with(['propriete:id,type,transaction_type,commune,quartier,prix,status'])
            ->where('recipient_id', $user->id)
            ->latest()
            ->limit(50)
            ->get();

        $receivedVisits = Visite_client::with(['propriete:id,type,transaction_type,commune,quartier,prix,status', 'client:id,name,prenom'])
            ->where(function ($q) use ($user) {
                $q->where('target_agent_id', $user->id)
                    ->orWhereHas('propriete', fn ($pq) => $pq->where('user_id', $user->id));
            })
            ->latest()
            ->limit(30)
            ->get();

        // Synthèse unique des clients/prospects ayant interagi avec l'agent
        $clientsMap = [];
        foreach ($receivedInquiries as $inq) {
            $key = strtolower($inq->email ?: $inq->telephone);
            if (! isset($clientsMap[$key])) {
                $clientsMap[$key] = [
                    'key' => $key,
                    'nom' => $inq->nom,
                    'prenom' => $inq->prenom,
                    'telephone' => $inq->telephone,
                    'email' => $inq->email,
                    'total_demandes' => 0,
                    'derniere_interaction' => $inq->created_at?->toISOString(),
                    'dernier_type' => $inq->type,
                    'dernier_statut' => $inq->status,
                ];
            }
            $clientsMap[$key]['total_demandes']++;
        }

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
                    'total_demandes' => $receivedInquiries->count(),
                    'demandes_nouvelles' => $receivedInquiries->where('status', 'nouveau')->count(),
                    'total_clients' => count($clientsMap),
                ],
                'proprietes' => $myProperties,
                'inquiries' => $receivedInquiries,
                'visites' => $receivedVisits,
                'clients' => array_values($clientsMap),
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
