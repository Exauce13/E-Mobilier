<?php

namespace App\Providers;

use App\Logging\FinancialLogScrubber;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Caviardage automatique des logs (Log Scrubber)
        try {
            if (method_exists(Log::getLogger(), 'pushProcessor')) {
                Log::getLogger()->pushProcessor(new FinancialLogScrubber());
            }
        } catch (\Throwable $e) {
            // Ignorer si logger non initialisé en CLI
        }
    }
}
