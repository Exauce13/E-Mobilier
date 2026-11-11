<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    /**
     * Vérifie que l'utilisateur est soit Super Admin Principal, soit Super Admin Technique.
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

        if (! $user->isSuperAdminPrincipal() && ! $user->isSuperAdminTechnique()) {
            AuditService::securityAlert('ACCES_REFUSE_SUPER_ADMIN', "Tentative d'accès non autorisée à une route Super Admin par l'utilisateur ID {$user->id} ({$user->email})", [
                'route' => $request->path(),
                'method' => $request->method(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Accès refusé. Cette action est strictement réservée aux Super Administrateurs (Principal ou Technique).',
            ], 403);
        }

        return $next($request);
    }
}

