<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DocumentLegal;
use App\Models\SignatureLegale;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LegalDocumentController extends Controller
{
    /**
     * Délivre la dernière version en vigueur des Conditions Générales d'Utilisation.
     * Route publique accessible à tous.
     */
    public function cguCourante(): JsonResponse
    {
        $cgu = DocumentLegal::courante('cgu');

        if (! $cgu) {
            return response()->json([
                'success' => false,
                'message' => 'Aucune version active des CGU n\'est actuellement disponible.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Dernière version active des CGU récupérée avec succès.',
            'data' => [
                'id' => $cgu->id,
                'type' => $cgu->type,
                'titre' => $cgu->titre,
                'version' => $cgu->version,
                'contenu' => $cgu->contenu,
                'hash_contenu' => $cgu->hash_contenu,
                'published_at' => $cgu->published_at,
            ],
        ]);
    }

    /**
     * Publie une nouvelle version des CGU ou de la Charte de Non-Contournement.
     * Réservé aux Super Administrateurs.
     */
    public function publierDocument(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', Rule::in(['cgu', 'charte_non_contournement'])],
            'titre' => ['required', 'string', 'max:255'],
            'version' => ['required', 'string', 'max:50'],
            'contenu' => ['required', 'string'],
        ]);

        // Désactiver les anciennes versions du même type
        DocumentLegal::where('type', $validated['type'])->update(['is_active' => false]);

        $hash = hash('sha256', $validated['contenu']);

        $doc = DocumentLegal::create([
            'type' => $validated['type'],
            'titre' => $validated['titre'],
            'version' => $validated['version'],
            'contenu' => $validated['contenu'],
            'hash_contenu' => $hash,
            'is_active' => true,
            'published_at' => now(),
        ]);

        AuditService::log('publication_document_legal', $doc, [
            'type' => $doc->type,
            'version' => $doc->version,
            'hash' => $doc->hash_contenu,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Nouvelle version {$doc->version} du document '{$doc->type}' publiée avec succès.",
            'data' => $doc,
        ], 201);
    }

    /**
     * Consigne la signature numérique horodatée de la Charte de Non-Contournement.
     * Réservé aux Secrétaires et Responsables de zone.
     */
    public function signerCharte(Request $request): JsonResponse
    {
        $user = $request->user();
        $charte = DocumentLegal::courante('charte_non_contournement');

        if (! $charte) {
            return response()->json([
                'success' => false,
                'message' => 'Aucune Charte de Non-Contournement active n\'est actuellement requise.',
            ], 404);
        }

        $validated = $request->validate([
            'acceptation' => ['required', 'accepted'],
        ]);

        // Vérification si déjà signée
        $signatureExistante = SignatureLegale::where('user_id', $user->id)
            ->where('document_legal_id', $charte->id)
            ->first();

        if ($signatureExistante) {
            return response()->json([
                'success' => true,
                'message' => 'Vous avez déjà signé la version en vigueur de cette charte.',
                'data' => [
                    'signed_at' => $signatureExistante->signed_at,
                    'version' => $charte->version,
                    'hash_document' => $signatureExistante->hash_document,
                ],
            ]);
        }

        $signature = SignatureLegale::create([
            'user_id' => $user->id,
            'document_legal_id' => $charte->id,
            'hash_document' => $charte->hash_contenu,
            'ip_address' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?? '', 0, 500),
            'signed_at' => now(),
        ]);

        AuditService::log('signature_charte_non_contournement', $charte, [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'version' => $charte->version,
            'hash' => $charte->hash_contenu,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Charte de Confidentialité et de Non-Contournement signée avec succès. Accès d\'administration débloqué.',
            'data' => [
                'signed_at' => $signature->signed_at,
                'version' => $charte->version,
                'hash_document' => $signature->hash_document,
            ],
        ]);
    }
}

