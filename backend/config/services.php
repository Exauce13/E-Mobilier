<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'kkiapay' => [
        'sandbox' => env('KKIAPAY_SANDBOX', true),
        'base_url' => env('KKIAPAY_BASE_URL', 'https://api-sandbox.kkiapay.me'),
        'public_key' => env('KKIAPAY_PUBLIC_KEY', '05d022e0b35311f1ad5611a76aeee288'),
        'private_key' => env('KKIAPAY_PRIVATE_KEY', 'tpk_05d022e2b35311f1ad5611a76aeee288'),
        'secret_key' => env('KKIAPAY_SECRET_KEY', 'tsk_05d049f0b35311f1ad5611a76aeee288'),
        'widget_script' => env('KKIAPAY_WIDGET_SCRIPT', 'https://cdn.kkiapay.me/k.js'),
        'theme' => env('KKIAPAY_THEME', '#0095ff'),
    ],

];
