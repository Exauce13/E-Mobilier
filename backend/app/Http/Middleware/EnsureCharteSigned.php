<?php

namespace App\Http\Middleware;

use App\Models\DocumentLegal;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCharteSigned
{
    /**
     * Exige que les administrateurs secondaires aient signé la charte active.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Les Super Admins ne sont pas bloqués par ce middleware
        if (! $user || $user->isSuperAdminPrincipal() || $user->isSuperAdminTechnique()) {
            return $next($request);
        }

        // Pour la Secrétaire et le Responsable de zone : signature obligatoire
        if ($user->isSecretaire() || $user->isResponsableZone()) {
            $charte = DocumentLegal::courante('charte_non_contournement');

            if ($charte && ! $user->hasSignedCurrentCharte()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Signature obligatoire requise : vous devez accepter et signer numériquement la Charte de Confidentialité et de Non-Contournement avant d\'accéder à l\'espace d\'administration.',
                    'code' => 'CHARTE_SIGNATURE_REQUIRED',
                    'data' => [
                        'document_id' => $charte->id,
                        'titre' => $charte->titre,
                        'version' => $charte->version,
                        'hash' => $charte->hash_contenu,
                    ],
                ], 403);
            }
        }

        return $next($request);
    }
}

