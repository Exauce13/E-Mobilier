<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdminPrincipal
{
    /**
     * Vérifie que l'utilisateur est STRICTEMENT le Super Admin Principal (MAGNIDE Justin).
     * Rejette tout autre profil (y compris le Super Admin Technique).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur non authentifié.',
            ], 401);
        }

        if (! $user->isSuperAdminPrincipal()) {
            AuditService::securityAlert('VIOLATION_PERIMETRE_PROPRIETAIRE', "Tentative d'accès illégitime à l'espace réservé de Justin MAGNIDE par l'utilisateur ID {$user->id} ({$user->email})", [
                'route' => $request->path(),
                'method' => $request->method(),
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Accès formellement interdit. Cette ressource est réservée au Super Administrateur Principal (Propriétaire).',
            ], 403);
        }

        return $next($request);
    }
}

