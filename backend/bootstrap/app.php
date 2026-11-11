<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'active' => \App\Http\Middleware\EnsureActiveAccount::class,
            'charte.signed' => \App\Http\Middleware\EnsureCharteSigned::class,
            'super_admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
            'super_admin_principal' => \App\Http\Middleware\EnsureSuperAdminPrincipal::class,
            'financial_owner' => \App\Http\Middleware\EnsureFinancialOwner::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (\Spatie\Permission\Exceptions\UnauthorizedException $e, Request $request) {
            $roles = $e->getRequiredRoles();
            if ($roles === ['Admin']) {
                $message = 'Accès refusé. Cette section est strictement réservée aux administrateurs.';
            } elseif (in_array('Client', $roles) && ! in_array('Agent mobilier', $roles)) {
                $message = 'Accès refusé. Seuls les clients sont autorisés à publier des demandes de recherche de biens.';
            } else {
                $message = 'Accès refusé. Vous ne disposez pas du rôle requis pour accéder à cette ressource.';
            }

            return response()->json([
                'success' => false,
                'message' => $message,
            ], 403);
        });
    })->create();
