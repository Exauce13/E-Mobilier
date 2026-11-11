<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SystemHealthController extends Controller
{
    /**
     * Rapport d'état de santé et de diagnostic de l'infrastructure.
     * Accessible au Super Admin Technique et au Super Admin Principal.
     * Règle stricte : zéro donnée monétaire ou financière.
     */
    public function health(): JsonResponse
    {
        $startTime = microtime(true);

        // 1. Test Base de données PostgreSQL
        $dbStatus = 'OK';
        $dbLatencyMs = null;
        try {
            $dbStart = microtime(true);
            DB::select('SELECT 1');
            $dbLatencyMs = round((microtime(true) - dbStart) * 1000, 2);
        } catch (\Throwable $e) {
            $dbStatus = 'ERROR : ' . $e->getMessage();
        }

        // 2. Test Cache système
        $cacheStatus = 'OK';
        try {
            Cache::put('health_check_ping', 'pong', 10);
            $cachePing = Cache::get('health_check_ping');
            if ($cachePing !== 'pong') {
                $cacheStatus = 'DEGRADED';
            }
        } catch (\Throwable $e) {
            $cacheStatus = 'ERROR : ' . $e->getMessage();
        }

        // 3. Supervision des files d'attente (Queues / Jobs)
        $pendingJobs = 0;
        $failedJobs = 0;
        try {
            if (DB::getSchemaBuilder()->hasTable('jobs')) {
                $pendingJobs = DB::table('jobs')->count();
            }
            if (DB::getSchemaBuilder()->hasTable('failed_jobs')) {
                $failedJobs = DB::table('failed_jobs')->count();
            }
        } catch (\Throwable $e) {
            // Ignorer si la table n'est pas interrogée
        }

        $totalLatencyMs = round((microtime(true) - $startTime) * 1000, 2);

        return response()->json([
            'success' => true,
            'message' => 'Diagnostic de santé de l\'infrastructure E-Mobilier généré avec succès.',
            'timestamp' => now()->toIso8601String(),
            'environment' => config('app.env'),
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'infrastructure' => [
                'database' => [
                    'driver' => config('database.default'),
                    'status' => $dbStatus,
                    'latency_ms' => $dbLatencyMs,
                ],
                'cache' => [
                    'driver' => config('cache.default'),
                    'status' => $cacheStatus,
                ],
                'queues' => [
                    'driver' => config('queue.default'),
                    'pending_jobs_count' => $pendingJobs,
                    'failed_jobs_count' => $failedJobs,
                ],
            ],
            'response_time_ms' => $totalLatencyMs,
        ]);
    }
}

