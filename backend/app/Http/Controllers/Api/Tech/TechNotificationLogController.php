<?php

namespace App\Http\Controllers\Api\Tech;

use App\Http\Controllers\Controller;
use App\Models\NotificationAuditLog;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TechNotificationLogController extends Controller
{
    /**
     * Journal technique des canaux d'envoi.
     * Accessible par Super Admin Tech et Principal.
     * RÈGLE DE SÉCURITÉ : Zéro montant, zéro contenu financier confidentiel.
     */
    public function index(Request $request): JsonResponse
    {
        $query = NotificationAuditLog::query()
            ->select([
                'id',
                'reference_evenement',
                'file_priorite',
                'canal',
                'destinataire_type',
                'sujet',
                'statut',
                'tentatives',
                'erreur_technique',
                'latence_ms',
                'created_at',
            ])
            ->latest();

        if ($request->filled('canal')) {
            $query->where('canal', $request->query('canal'));
        }

        if ($request->filled('statut')) {
            $query->where('statut', $request->query('statut'));
        }

        if ($request->filled('file_priorite')) {
            $query->where('file_priorite', $request->query('file_priorite'));
        }

        $logs = $query->paginate($request->integer('per_page', 25));

        $totalLogs = NotificationAuditLog::count();
        $totalSuccess = NotificationAuditLog::whereIn('statut', ['envoye', 'replie_sms'])->count();
        $successRate = $totalLogs > 0 ? round(($totalSuccess / $totalLogs) * 100, 2) : 100.0;
        $avgLatency = (int) round(NotificationAuditLog::avg('latence_ms') ?? 0);

        return response()->json([
            'success' => true,
            'statistiques_techniques' => [
                'total_evenements' => $totalLogs,
                'taux_succes_pourcentage' => $successRate,
                'total_replis_sms' => NotificationAuditLog::where('statut', 'replie_sms')->count(),
                'total_en_echec_dlq' => NotificationAuditLog::where('statut', 'echec')->count(),
                'latence_moyenne_ms' => $avgLatency,
            ],
            'data' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * Réinjecte une notification en échec dans la file d'attente (Dead Letter Queue).
     * Sans exposition de contenu monétaire.
     */
    public function relancer(int $id, MultiChannelNotificationService $notificationService): JsonResponse
    {
        $log = NotificationAuditLog::findOrFail($id);

        if ($log->statut !== 'echec') {
            return response()->json([
                'success' => false,
                'message' => "Seules les notifications en état d'échec peuvent être relancées (statut actuel: {$log->statut}).",
            ], 422);
        }

        // Relance avec le canal de secours (SMS)
        $newLog = $notificationService->dispatchWithFallback(
            canal: 'sms',
            filePriorite: $log->file_priorite,
            destinataireType: $log->destinataire_type,
            destinataireIdentifiant: $log->destinataire_identifiant,
            sujet: '[RELANCE] ' . $log->sujet,
            contenuPublic: $log->contenu_public,
            contenuConfidentiel: $log->contenu_confidentiel,
            montant: $log->montant,
            referenceEvenement: $log->reference_evenement
        );

        // Mettre à jour l'ancien log
        $log->update(['statut' => 'relance_effectuee']);

        return response()->json([
            'success' => true,
            'message' => 'Notification réinjectée avec succès dans la file prioritaire SMS.',
            'nouveau_statut' => $newLog->statut,
            'nouveau_log_id' => $newLog->id,
        ]);
    }
}

