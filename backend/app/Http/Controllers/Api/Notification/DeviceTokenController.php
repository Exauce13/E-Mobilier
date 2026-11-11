<?php

namespace App\Http\Controllers\Api\Notification;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceTokenController extends Controller
{
    /**
     * Enregistre ou actualise le jeton Push (Web/Mobile) rattaché à l'utilisateur connecté.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:500'],
            'platform' => ['nullable', 'string', 'in:web,android,ios'],
            'device_name' => ['nullable', 'string', 'max:150'],
        ]);

        $user = $request->user();

        $deviceToken = DeviceToken::updateOrCreate(
            [
                'user_id' => $user->id,
                'token' => $validated['token'],
            ],
            [
                'platform' => $validated['platform'] ?? 'web',
                'device_name' => $validated['device_name'] ?? null,
                'is_active' => true,
                'last_used_at' => now(),
            ]
        );

        // Mise à jour de compatibilité sur la colonne users.device_token
        $user->update(['device_token' => $validated['token']]);

        return response()->json([
            'success' => true,
            'message' => 'Jeton Push enregistré avec succès.',
            'data' => [
                'id' => $deviceToken->id,
                'platform' => $deviceToken->platform,
                'is_active' => $deviceToken->is_active,
            ],
        ], 201);
    }

    /**
     * Supprime ou désactive le jeton Push lors de la déconnexion de l'appareil.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();

        if (! empty($validated['token'])) {
            DeviceToken::where('user_id', $user->id)
                ->where('token', $validated['token'])
                ->delete();

            if ($user->device_token === $validated['token']) {
                $user->update(['device_token' => null]);
            }
        } else {
            DeviceToken::where('user_id', $user->id)->delete();
            $user->update(['device_token' => null]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jeton Push révoqué avec succès.',
        ]);
    }
}

