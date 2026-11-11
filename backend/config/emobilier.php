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

    /*
    |--------------------------------------------------------------------------
    | Passerelle de Paiement Agnostique & Coffre-Fort Financier (Phase 3)
    |--------------------------------------------------------------------------
    */
    'payment_gateway' => env('PAYMENT_GATEWAY', 'kkiapay'),

    'beneficiaire_officiel' => [
        'titulaire' => 'MAGNIDE JUSTIN - E-MOBILIER SARL',
        'mobile_money' => env('COMPANY_BENEFICIARY_MOMO', '+229 97 00 00 01'),
        'rib_bancaire' => env('COMPANY_BENEFICIARY_RIB', 'BJ063 01001 00000000000 45'),
    ],

    'payout_otp_ttl_minutes' => (int) env('PAYOUT_OTP_TTL_MINUTES', 3),
    'payout_max_otp_attempts' => (int) env('PAYOUT_MAX_OTP_ATTEMPTS', 3),

    'tarifs_officiels' => [
        'visite' => 500,
        'deblocage_coordonnees' => 50,
        'post_client' => 500,
        'post_agent' => 100,
    ],
];

