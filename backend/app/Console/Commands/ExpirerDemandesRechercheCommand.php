<?php

namespace App\Console\Commands;

use App\Models\Demande_client;
use App\Services\AuditService;
use Illuminate\Console\Command;

class ExpirerDemandesRechercheCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'demandes:expirer';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Expire automatiquement les demandes de recherche actives dont la date limite de validité est dépassée.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $demandes = Demande_client::where('status', 'active')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->get();

        $count = 0;

        foreach ($demandes as $demande) {
            $ancienStatut = $demande->workflow_status;
            $demande->update([
                'status' => 'closed',
                'motif_cloture' => 'delai_depasse',
                'cloture_at' => now(),
                'motif_cloture_details' => 'Expiration automatique : date limite de validité dépassée.',
            ]);

            AuditService::log('demande_recherche_expiree_auto', $demande, [
                'ancien_statut' => $ancienStatut,
                'nouveau_statut' => 'expiree',
                'motif_cloture' => 'delai_depasse',
                'expires_at' => $demande->expires_at?->toIso8601String(),
                'mode' => 'automatique_scheduler',
            ]);

            $count++;
        }

        $this->info("{$count} demande(s) de recherche expirée(s) automatiquement.");

        return self::SUCCESS;
    }
}
