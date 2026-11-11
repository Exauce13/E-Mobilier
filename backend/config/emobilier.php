<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Super Administrateur Principal (Root Owner Binding)
    |--------------------------------------------------------------------------
    |
    | Identité immuable du propriétaire légal et décisionnaire (MAGNIDE Justin).
    | Ce compte est sanctuarisé au niveau du noyau de sécurité : aucune API ne
    | peut altérer, rétrograder, suspendre ou supprimer ce profil.
    |
    */
    'super_admin_principal_email' => env('SUPER_ADMIN_PRINCIPAL_EMAIL', 'justin.magnide@e-mobilier.bj'),
    'super_admin_principal_id' => env('SUPER_ADMIN_PRINCIPAL_ID', null),

    /*
    |--------------------------------------------------------------------------
    | Rôles du Système (RBAC)
    |--------------------------------------------------------------------------
    */
    'roles' => [
        'super_admin_principal' => 'Super Admin Principal',
        'super_admin_technique' => 'Super Admin Technique',
        'secretaire' => 'Secrétaire',
        'responsable_zone' => 'Responsable de zone',
        'client' => 'Client',
        'agent_mobilier' => 'Agent mobilier',
    ],

    /*
    |--------------------------------------------------------------------------
    | Paramètres de Sécurité & Anti-Contournement
    |--------------------------------------------------------------------------
    */
    'demasquage_default_ttl_minutes' => (int) env('DEMASQUAGE_DEFAULT_TTL_MINUTES', 120),
    'demasquage_max_ttl_minutes' => (int) env('DEMASQUAGE_MAX_TTL_MINUTES', 1440), // 24h
];

