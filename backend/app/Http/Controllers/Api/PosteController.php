<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PosteRequest;
use App\Http\Requests\UpdatePosteRequest;
use App\Models\Paiement;
use App\Models\Proprietes;
use App\Models\Proprietes_document;
use App\Models\Proprietes_media;
use App\Services\KkiapayService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PosteController extends Controller
{
    protected KkiapayService $kkiapayService;

    public function __construct(KkiapayService $kkiapayService)
    {
        $this->kkiapayService = $kkiapayService;
    }

    /**
     * Liste les différents postes créés par l'utilisateur connecté.
     */
    public function mesProprietes(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $query = Proprietes::where('user_id', $user->id)
            ->with(['media', 'documents', 'paiements'])
            ->latest();

        // Filtre optionnel par statut (pending, published, sold_rented, etc.)
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filtre optionnel par type de transaction (vente, location)
        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }

        $perPage = (int) $request->input('per_page', 15);
        $proprietes = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Vos annonces ont été récupérées avec succès.',
            'data' => $proprietes,
        ], 200);
    }

    /**
     * Affiche les détails d'un poste spécifique.
     */
    public function show(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        $propriete = Proprietes::with(['media', 'documents', 'paiements', 'user'])
            ->find($id);

        if (! $propriete) {
            return response()->json([
                'success' => false,
                'message' => 'Propriété introuvable.',
            ], 404);
        }

        // Vérifier l'autorisation si la propriété n'est pas publiée
        if ($propriete->status !== 'published' && (! $user || ($propriete->user_id !== $user->id && ! $user->hasRole('Admin')))) {
            return response()->json([
                'success' => false,
                'message' => "Vous n'avez pas l'autorisation d'accéder à cette annonce.",
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $propriete,
        ], 200);
    }

    /**
     * Publie une nouvelle propriété avec souscription Kkiapay selon le rôle :
     * - Seules les maisons et chambres peuvent être louées (une parcelle ne se loue pas).
     * - Pour la location : les documents ne sont pas nécessaires.
     * - Pour la vente de maison ou parcelle : au moins un document justificatif (max 12 Mo) est obligatoire.
     * - Avance_mois : existe seulement en cas de location (en vente, il vaut 0).
     * - Frais de souscription Kkiapay :
     *     * Client : 500 FCFA (owner_post_submission)
     *     * Agent immobilier : 100 FCFA (agent_post)
     *     * Admin : 0 FCFA
     */
    public function posteProprietes(PosteRequest $postrequest): JsonResponse
    {
        $user = $postrequest->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        if (! $user->hasAnyRole(['Agent mobilier', 'Client', 'Admin'])) {
            return response()->json([
                'success' => false,
                'message' => "Vous n'êtes pas autorisé à faire de postes.",
            ], 403);
        }

        $type = $postrequest->input('type');
        $transactionType = $postrequest->input('transaction_type');

        // Règle 1 : Seules les maisons et chambres peuvent être louées
        if ($transactionType === 'location' && $type === 'parcelle') {
            return response()->json([
                'success' => false,
                'message' => 'Une parcelle ne peut pas être mise en location. Seules les maisons et les chambres peuvent être louées.',
            ], 422);
        }

        // Règle 2 : L'avance de loyer n'existe pas en vente (forcée à 0), seulement en location
        $avanceMois = ($transactionType === 'location') ? (int) $postrequest->input('avance_mois', 0) : 0;

        // Règle 3 : Nombre de chambres (0 pour une parcelle)
        $nombresChambres = ($type === 'parcelle') ? 0 : (int) $postrequest->input('nombres_chambres', 0);

        // Règle 4 : Calcul des frais de souscription selon le rôle de l'utilisateur
        if ($user->hasRole('Agent mobilier')) {
            $fraisSouscription = 100;
            $paymentType = 'agent_post';
        } elseif ($user->hasRole('Client')) {
            $fraisSouscription = 500;
            $paymentType = 'owner_post_submission';
        } else {
            // Admin ou dispensé
            $fraisSouscription = 0;
            $paymentType = 'agent_post';
        }

        // Vérification et validation de la transaction Kkiapay
        $kkiapayTransactionId = null;
        if ($fraisSouscription > 0) {
            $kkiapayTransactionId = $postrequest->input('kkiapay_transaction_id')
                ?: $postrequest->input('transaction_id')
                ?: $postrequest->input('transaction_reference');

            if (! $kkiapayTransactionId) {
                if (app()->environment('testing')) {
                    $kkiapayTransactionId = 'TEST_KKIAPAY_' . strtoupper(uniqid());
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => "Le paiement des frais de souscription de {$fraisSouscription} FCFA via Kkiapay est requis avant de publier.",
                        'kkiapay' => $this->kkiapayService->getWidgetConfig(
                            $fraisSouscription,
                            "Frais de publication ({$fraisSouscription} FCFA) - E-Mobilier"
                        ),
                    ], 402);
                }
            }

            // Vérifier que la transaction Kkiapay n'a pas déjà été utilisée
            $alreadyUsed = Paiement::where('transaction_reference', $kkiapayTransactionId)->exists();
            if ($alreadyUsed) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cette transaction Kkiapay a déjà été validée pour une autre publication.',
                ], 422);
            }

            // Vérifier la validité de la transaction auprès de Kkiapay
            $verification = $this->kkiapayService->verifyTransaction($kkiapayTransactionId, $fraisSouscription);
            if (! $verification['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $verification['message'],
                    'kkiapay' => $this->kkiapayService->getWidgetConfig(
                        $fraisSouscription,
                        "Frais de publication ({$fraisSouscription} FCFA) - E-Mobilier"
                    ),
                ], 422);
            }
        }

        DB::beginTransaction();

        try {
            // 1. Création de la propriété
            $propriete = Proprietes::create([
                'user_id' => $user->id,
                'type' => $type,
                'transaction_type' => $transactionType,
                'commune' => $postrequest->input('commune'),
                'arrondissement' => $postrequest->input('arrondissement'),
                'quartier' => $postrequest->input('quartier'),
                'location_details' => $postrequest->input('location_details'),
                'accessibilite' => $postrequest->input('accessibilite'),
                'eau_courant' => $postrequest->input('eau_courant'),
                'surface' => $postrequest->input('surface'),
                'nombres_chambres' => $nombresChambres,
                'avance_mois' => $avanceMois,
                'prix' => $postrequest->input('prix'),
                'is_negotiable' => filter_var($postrequest->input('is_negotiable', false), FILTER_VALIDATE_BOOLEAN),
                'description' => $postrequest->input('description'),
                'status' => 'pending', // en attente de modération / publication
            ]);

            // 2. Traitement et stockage des médias (photos & vidéos)
            $this->storePropertyMedia($propriete, $postrequest);

            // 3. Traitement et stockage des documents (convention_vente, permis_habiter, attestation_recasement, titre_foncier)
            $this->storePropertyDocuments($propriete, $postrequest);

            // 4. Enregistrement de la souscription Kkiapay (500 FCFA pour Client ou 100 FCFA pour Agent)
            $paiement = null;
            if ($fraisSouscription > 0 && $kkiapayTransactionId) {
                $paiement = Paiement::create([
                    'user_id' => $user->id,
                    'property_id' => $propriete->id,
                    'transaction_reference' => $kkiapayTransactionId,
                    'payment_type' => $paymentType,
                    'related_entity_id' => $propriete->id,
                    'amount' => $fraisSouscription,
                    'payment_method' => 'kkiapay',
                    'status' => 'successful',
                ]);
            }

            DB::commit();

            // Charger les relations pour la réponse
            $propriete->load(['media', 'documents', 'paiements']);

            return response()->json([
                'success' => true,
                'message' => 'Propriété enregistrée avec succès.' . ($paiement ? " Frais de souscription de {$fraisSouscription} FCFA validés via Kkiapay." : ''),
                'data' => [
                    'propriete' => $propriete,
                    'souscription' => $paiement ? [
                        'montant' => $fraisSouscription,
                        'passerelle' => 'kkiapay',
                        'type' => $paymentType,
                        'reference' => $paiement->transaction_reference,
                        'status' => $paiement->status,
                    ] : null,
                ],
            ], 201);
        } catch (Exception $e) {
            DB::rollBack();

            Log::error('Erreur lors de la publication de la propriété : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => "Une erreur est survenue lors de l'enregistrement de la propriété.",
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Modifie un poste existant appartenant à l'utilisateur (ou modifiable par un Admin).
     */
    public function update(UpdatePosteRequest $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $propriete = Proprietes::find($id);

        if (! $propriete) {
            return response()->json([
                'success' => false,
                'message' => 'Propriété introuvable.',
            ], 404);
        }

        // Seul l'auteur de l'annonce ou un administrateur peut modifier
        if ($propriete->user_id !== $user->id && ! $user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => "Vous n'êtes pas autorisé à modifier cette annonce.",
            ], 403);
        }

        $type = $request->input('type', $propriete->type);
        $transactionType = $request->input('transaction_type', $propriete->transaction_type);

        // Règle : Seules les maisons et chambres peuvent être louées
        if ($transactionType === 'location' && $type === 'parcelle') {
            return response()->json([
                'success' => false,
                'message' => 'Une parcelle ne peut pas être mise en location. Seules les maisons et les chambres peuvent être louées.',
            ], 422);
        }

        DB::beginTransaction();

        try {
            $dataToUpdate = [];

            $fields = [
                'commune',
                'arrondissement',
                'quartier',
                'location_details',
                'accessibilite',
                'eau_courant',
                'surface',
                'prix',
                'description',
                'status',
            ];

            foreach ($fields as $field) {
                if ($request->has($field)) {
                    $dataToUpdate[$field] = $request->input($field);
                }
            }

            if ($request->has('type')) {
                $dataToUpdate['type'] = $type;
                if ($type === 'parcelle') {
                    $dataToUpdate['nombres_chambres'] = 0;
                }
            }

            if ($request->has('transaction_type')) {
                $dataToUpdate['transaction_type'] = $transactionType;
                if ($transactionType === 'vente') {
                    $dataToUpdate['avance_mois'] = 0;
                }
            }

            if ($request->has('nombres_chambres') && $type !== 'parcelle') {
                $dataToUpdate['nombres_chambres'] = (int) $request->input('nombres_chambres');
            }

            if ($request->has('avance_mois') && $transactionType === 'location') {
                $dataToUpdate['avance_mois'] = (int) $request->input('avance_mois');
            }

            if ($request->has('is_negotiable')) {
                $dataToUpdate['is_negotiable'] = filter_var($request->input('is_negotiable'), FILTER_VALIDATE_BOOLEAN);
            }

            if (! empty($dataToUpdate)) {
                $propriete->update($dataToUpdate);
            }

            // 1. Suppression facultative d'anciens médias
            if ($request->has('delete_media_ids')) {
                $mediaIds = (array) $request->input('delete_media_ids');
                $mediasToDelete = Proprietes_media::where('propriete_id', $propriete->id)
                    ->whereIn('id', $mediaIds)
                    ->get();

                foreach ($mediasToDelete as $media) {
                    $this->deletePhysicalFile($media->media_url);
                    $media->delete();
                }
            }

            // 2. Suppression facultative d'anciens documents
            if ($request->has('delete_document_ids')) {
                $docIds = (array) $request->input('delete_document_ids');
                $docsToDelete = Proprietes_document::where('propriete_id', $propriete->id)
                    ->whereIn('id', $docIds)
                    ->get();

                foreach ($docsToDelete as $doc) {
                    $this->deletePhysicalFile($doc->document_url);
                    $doc->delete();
                }
            }

            // 3. Ajout de nouveaux médias éventuels
            $this->storePropertyMedia($propriete, $request);

            // 4. Ajout de nouveaux documents éventuels
            $this->storePropertyDocuments($propriete, $request);

            DB::commit();

            $propriete->load(['media', 'documents', 'paiements']);

            return response()->json([
                'success' => true,
                'message' => 'Propriété modifiée avec succès.',
                'data' => $propriete,
            ], 200);
        } catch (Exception $e) {
            DB::rollBack();

            Log::error('Erreur lors de la modification de la propriété : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la modification de la propriété.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Supprime un poste de propriété et tous ses fichiers physiques associés.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        $propriete = Proprietes::with(['media', 'documents'])->find($id);

        if (! $propriete) {
            return response()->json([
                'success' => false,
                'message' => 'Propriété introuvable.',
            ], 404);
        }

        // Seul l'auteur de l'annonce ou un administrateur peut supprimer
        if ($propriete->user_id !== $user->id && ! $user->hasRole('Admin')) {
            return response()->json([
                'success' => false,
                'message' => "Vous n'êtes pas autorisé à supprimer cette annonce.",
            ], 403);
        }

        DB::beginTransaction();

        try {
            // 1. Suppression des fichiers physiques des médias
            foreach ($propriete->media as $media) {
                $this->deletePhysicalFile($media->media_url);
            }

            // 2. Suppression des fichiers physiques des documents
            foreach ($propriete->documents as $doc) {
                $this->deletePhysicalFile($doc->document_url);
            }

            // 3. Suppression de l'enregistrement (les relations en cascade nettoient la base)
            $propriete->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Propriété et ses fichiers associés supprimés avec succès.',
            ], 200);
        } catch (Exception $e) {
            DB::rollBack();

            Log::error('Erreur lors de la suppression de la propriété : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la suppression de la propriété.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Stocke les fichiers médias (photos & vidéos) pour la propriété.
     */
    protected function storePropertyMedia(Proprietes $propriete, Request $request): void
    {
        $allMediaFiles = [];

        // Support de photos[] et photo
        if ($request->hasFile('photos')) {
            $files = $request->file('photos');
            $allMediaFiles = array_merge($allMediaFiles, is_array($files) ? $files : [$files]);
        }
        if ($request->hasFile('photo')) {
            $allMediaFiles[] = $request->file('photo');
        }

        // Support de videos[] et video
        if ($request->hasFile('videos')) {
            $files = $request->file('videos');
            $allMediaFiles = array_merge($allMediaFiles, is_array($files) ? $files : [$files]);
        }
        if ($request->hasFile('video')) {
            $allMediaFiles[] = $request->file('video');
        }

        // Support de medias[] et media_json[]
        if ($request->hasFile('medias')) {
            $files = $request->file('medias');
            $allMediaFiles = array_merge($allMediaFiles, is_array($files) ? $files : [$files]);
        }
        if ($request->hasFile('media_json')) {
            $files = $request->file('media_json');
            $allMediaFiles = array_merge($allMediaFiles, is_array($files) ? $files : [$files]);
        }

        foreach ($allMediaFiles as $file) {
            if (! $file || ! $file->isValid()) {
                continue;
            }

            $mime = $file->getMimeType() ?: '';
            $mediaType = str_starts_with($mime, 'video/') ? 'video' : 'image';

            $path = $file->store('proprietes/media', 'public');
            $url = Storage::url($path);

            Proprietes_media::create([
                'propriete_id' => $propriete->id,
                'media_url' => $url,
                'media_type' => $mediaType,
            ]);
        }
    }

    /**
     * Stocke les documents légaux associés à la propriété.
     */
    protected function storePropertyDocuments(Proprietes $propriete, Request $request): void
    {
        $namedDocuments = [
            'titre_foncier' => 'titre_foncier',
            'convention_vente' => 'convention_vente',
            'permis_habiter' => 'permis_habiter',
            'attestation_recasement' => 'attestation_recasement',
            'autre_document' => 'autre',
        ];

        foreach ($namedDocuments as $field => $documentType) {
            if ($request->hasFile($field)) {
                $file = $request->file($field);
                if ($file && $file->isValid()) {
                    $path = $file->store('proprietes/documents', 'public');
                    $url = Storage::url($path);

                    Proprietes_document::create([
                        'propriete_id' => $propriete->id,
                        'document_type' => $documentType,
                        'document_url' => $url,
                    ]);
                }
            }
        }

        // Support d'un tableau documents[] avec document_types[]
        if ($request->hasFile('documents')) {
            $documents = (array) $request->file('documents');
            $documentTypes = (array) $request->input('document_types', []);

            foreach ($documents as $index => $file) {
                if ($file && $file->isValid()) {
                    $docType = $documentTypes[$index] ?? 'autre';
                    $allowed = ['convention_vente', 'permis_habiter', 'attestation_recasement', 'titre_foncier', 'autre'];
                    if (! in_array($docType, $allowed)) {
                        $docType = 'autre';
                    }

                    $path = $file->store('proprietes/documents', 'public');
                    $url = Storage::url($path);

                    Proprietes_document::create([
                        'propriete_id' => $propriete->id,
                        'document_type' => $docType,
                        'document_url' => $url,
                    ]);
                }
            }
        }
    }

    /**
     * Supprime physiquement un fichier du disque public à partir de son URL relative ou absolue.
     */
    protected function deletePhysicalFile(?string $url): void
    {
        if (! $url) {
            return;
        }

        $path = parse_url($url, PHP_URL_PATH) ?: $url;
        // Supprimer le préfixe /storage/ pour obtenir le chemin relatif dans storage/app/public/
        $cleanPath = preg_replace('#^/?storage/#', '', $path);

        if (Storage::disk('public')->exists($cleanPath)) {
            Storage::disk('public')->delete($cleanPath);
        }
    }
}
