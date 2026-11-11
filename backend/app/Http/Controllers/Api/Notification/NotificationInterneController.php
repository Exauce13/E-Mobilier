<?php

namespace App\Http\Controllers\Api\Notification;

use App\Http\Controllers\Controller;
use App\Models\NotificationInterne;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationInterneController extends Controller
{
    /**
     * Retourne le fil interne des alertes pour l'utilisateur connecté.
     * Filtrage hermétique : les montants et coordonnées clients sont masqués pour les profils secondaires.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = NotificationInterne::where('user_id', $user->id)
            ->latest()
            ->paginate($request->integer('per_page', 20));

        $nonLuesCount = NotificationInterne::where('user_id', $user->id)
            ->where('lu', false)
            ->count();

        // Nettoyage contextuel pour les profils secondaires
        $transformed = $notifications->getCollection()->map(function (NotificationInterne $notif) use ($user) {
            $data = $notif->data ?? [];

            if (! $user->isFinancialOwner()) {
                unset($data['montant'], $data['amount'], $data['solde'], $data['commission']);
            }

            return [
                'id' => $notif->id,
                'type' => $notif->type,
                'titre' => $notif->titre,
                'message' => $notif->message,
                'data' => $data,
                'lu' => $notif->lu,
                'lu_a' => $notif->lu_a?->toIso8601String(),
                'created_at' => $notif->created_at->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'statistiques' => [
                'non_lues' => $nonLuesCount,
                'total' => $notifications->total(),
            ],
            'data' => $transformed,
            'pagination' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    /**
     * Marque une notification comme lue.
     */
    public function lire(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $notification = NotificationInterne::where('user_id', $user->id)
            ->findOrFail($id);

        $notification->marquerCommeLue();

        return response()->json([
            'success' => true,
            'message' => 'Notification marquée comme lue.',
            'data' => [
                'id' => $notification->id,
                'lu' => true,
                'lu_a' => $notification->lu_a->toIso8601String(),
            ],
        ]);
    }

    /**
     * Marque toutes les notifications de l'utilisateur comme lues.
     */
    public function toutLire(Request $request): JsonResponse
    {
        $user = $request->user();

        NotificationInterne::where('user_id', $user->id)
            ->where('lu', false)
            ->update([
                'lu' => true,
                'lu_a' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Toutes les notifications ont été marquées comme lues.',
        ]);
    }
}

