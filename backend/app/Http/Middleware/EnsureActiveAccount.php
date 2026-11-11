<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAccount
{
    /**
     * Vérifie que le compte utilisateur n'est pas suspendu.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isSuspendu()) {
            // Révocation immédiate des jetons d'accès actuels
            if (method_exists($user, 'currentAccessToken') && $user->currentAccessToken()) {
                $user->currentAccessToken()->delete();
            }

            return response()->json([
                'success' => false,
                'message' => 'Votre compte a été suspendu par l\'administration. Accès interdit.',
                'code' => 'ACCOUNT_SUSPENDED',
            ], 403);
        }

        return $next($request);
    }
}

