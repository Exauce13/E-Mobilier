<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFinancialOwner
{
    /**
     * Protège le Coffre-Fort Financier et les retraits.
     * Accessible STRICTEMENT à MAGNIDE Justin (Root Financial Owner).
     * Rejette tout autre utilisateur (y compris Super Admin Technique ou Co-Principal).
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

        if (! $user->isFinancialOwner()) {
            AuditService::securityAlert('VIOLATION_COFFRE_FORT_FINANCIER', "Tentative d'accès non autorisée au Coffre-Fort Financier par l'utilisateur ID {$user->id} ({$user->email})", [
                'route' => $request->path(),
                'method' => $request->method(),
                'ip' => $request->ip(),
                'user_roles' => $user->getRoleNames()->toArray(),
            ]);

            try {
                app(\App\Services\Notifications\MultiChannelNotificationService::class)->notifierAlerteSecurite(
                    'VIOLATION_COFFRE_FORT_FINANCIER',
                    "Tentative d'intrusion sur {$request->path()} par {$user->email} (ID {$user->id})"
                );
            } catch (\Throwable $e) {
                // Ignore silent notification error in middleware
            }

            return response()->json([
                'success' => false,
                'message' => 'Accès formellement interdit : Le module financier, les soldes, le Grand Livre et les retraits sont la propriété exclusive de M. Justin MAGNIDE.',
                'code' => 'FINANCIAL_VAULT_FORBIDDEN',
            ], 403);
        }

        return $next($request);
    }
}
