<?php

namespace App\Http\Controllers\Api\Finance;

use App\Http\Controllers\Controller;
use App\Models\NotificationAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialNotificationAuditController extends Controller
{
    /**
     * Journal exhaustif des notifications financières expédiées (WhatsApp, SMS, Push).
     * Accessible UNIQUEMENT par M. Justin MAGNIDE (financial_owner).
     */
    public function index(Request $request): JsonResponse
    {
        $query = NotificationAuditLog::query()->latest();

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

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'totaux' => [
                'total_expedies' => NotificationAuditLog::where('statut', 'envoye')->count(),
                'total_replis_sms' => NotificationAuditLog::where('statut', 'replie_sms')->count(),
                'total_echecs' => NotificationAuditLog::where('statut', 'echec')->count(),
            ],
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}

