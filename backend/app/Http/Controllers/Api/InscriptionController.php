<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AuthentificationRequest;
use App\Http\Requests\InscriptionRequest;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Notifications\MultiChannelNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;

class InscriptionController extends Controller
{
    /**
     * Inscription d'un nouvel utilisateur (Client ou Agent immobilier).
     */
    public function inscription(InscriptionRequest $request): JsonResponse
    {
        try {
            return DB::transaction(function () use ($request) {
                $telephone = $request->input('telephone');
                $email = $request->input('email');
                $password = Hash::make($request->input('password'));

                $name = $request->input('name');
                $prenom = $request->input('prenom') ?? $name;

                // Création de l'utilisateur
                $user = User::create([
                    'name' => $name,
                    'prenom' => $prenom,
                    'email' => $email,
                    'telephone' => $telephone,
                    'password' => $password,
                    'is_verifed' => false,
                ]);

                // Attribution du rôle selon le choix du frontend
                $roleInput = $request->input('role', 'Client');
                $roleName = match ($roleInput) {
                    'agent_immobilier', 'Agent mobilier' => 'Agent mobilier',
                    'Admin', 'admin' => 'Admin',
                    default => 'Client',
                };

                // S'assurer que le rôle existe en base
                Role::firstOrCreate(['name' => $roleName]);
                $user->assignRole($roleName);

                // Génération du token d'accès Sanctum
                $token = $user->createToken('auth_token')->plainTextToken;

                return response()->json([
                    'success' => true,
                    'message' => 'Compte créé avec succès!Bienvenue dans la communauté E-Mobilier.',
                    'data' => [
                        'user' => $this->formatUserResponse($user),
                        'token' => $token,
                        'token_type' => 'Bearer',
                    ],
                ], 201);
            });
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la création du compte.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Authentification d'un utilisateur par numéro de téléphone béninois ou email et mot de passe.
     * Pour les rôles administrateurs, déclenche obligatoirement la double authentification par OTP (2FA).
     */
    public function authentification(AuthentificationRequest $request): JsonResponse
    {
        try {
            $identifier = $request->input('telephone') ?? $request->input('phone');
            $password = $request->input('password');

            // Recherche de l'utilisateur par téléphone ou email
            $user = User::where('telephone', $identifier)
                ->orWhere('email', $identifier)
                ->first();

            if (! $user || ! Hash::check($password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Numéro de téléphone ou mot de passe incorrect.',
                    'errors' => [
                        'credentials' => ['Les identifiants fournis ne correspondent pas à nos enregistrements.'],
                    ],
                ], 401);
            }

            // Vérifier si le compte est suspendu
            if ($user->isSuspendu()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ce compte a été suspendu par l\'administration.',
                ], 403);
            }

            // DOUBLE AUTHENTIFICATION PAR OTP (2FA) POUR TOUS LES RÔLES ADMINISTRATEURS
            if ($user->isAnyAdmin()) {
                $codeOtp = $user->generateTwoFactorOtp();

                try {
                    app(MultiChannelNotificationService::class)->notifierOtpConnexionAdmin($user, $codeOtp);
                } catch (\Throwable $e) {
                    Log::error('[2FA_OTP_NOTIFICATION_ERROR] ' . $e->getMessage());
                }

                AuditService::log('admin_2fa_otp_emitted', $user, [
                    'admin_id' => $user->id,
                    'email' => $user->email,
                    'roles' => $user->getRoleNames()->values()->all(),
                    'expires_at' => $user->two_factor_otp_expires_at?->toIso8601String(),
                ]);

                $responsePayload = [
                    'success' => true,
                    'requires_two_factor' => true,
                    'message' => 'Double authentification requise. Un code de sécurité OTP a été envoyé.',
                    'data' => [
                        'requires_two_factor' => true,
                        'two_factor_token' => $user->two_factor_token,
                        'role' => $user->getRoleNames()->first() ?? 'Admin',
                        'destination_masquee' => $this->maskDestination($user),
                        'expires_in' => ((int) config('emobilier.admin_2fa_otp_ttl_minutes', 5)) * 60,
                    ],
                ];

                if (app()->environment(['local', 'testing'])) {
                    $responsePayload['data']['test_otp_code'] = $codeOtp;
                }

                return response()->json($responsePayload, 200);
            }

            // Génération du token Sanctum standard pour les utilisateurs non-administrateurs (Client, Agent)
            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'success' => true,
                'message' => 'Connexion réussie ! Bienvenue sur E-Mobilier.',
                'data' => [
                    'user' => $this->formatUserResponse($user),
                    'token' => $token,
                    'token_type' => 'Bearer',
                ],
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la connexion.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Étape 2 de l'authentification Admin : Validation du code OTP (2FA).
     */
    public function verifierOtp2Fa(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'two_factor_token' => 'required|string',
            'code_otp' => 'required|string',
        ], [
            'two_factor_token.required' => 'Le jeton de session de double authentification est requis.',
            'code_otp.required' => 'Le code OTP de confirmation est requis.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $token = (string) $request->input('two_factor_token');
            $codeOtp = trim((string) $request->input('code_otp'));

            $user = User::where('two_factor_token', $token)->first();

            if (! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Session de double authentification expirée ou introuvable. Veuillez vous reconnecter.',
                ], 401);
            }

            $maxAttempts = (int) config('emobilier.admin_2fa_max_otp_attempts', 3);

            // Vérification anti-brute-force préalable
            if ($user->two_factor_otp_tentatives >= $maxAttempts) {
                $user->clearTwoFactorOtp();
                AuditService::securityAlert('BRUTE_FORCE_2FA_OTP', "Tentatives excessives de validation OTP 2FA sur l'administrateur {$user->email}");
                return response()->json([
                    'success' => false,
                    'message' => "Session 2FA verrouillée suite à {$maxAttempts} tentatives erronées. Veuillez vous reconnecter.",
                ], 429);
            }

            // Vérification de la validité temporelle (TTL)
            if (! $user->two_factor_otp_expires_at || now()->gt($user->two_factor_otp_expires_at)) {
                $user->clearTwoFactorOtp();
                return response()->json([
                    'success' => false,
                    'message' => 'Le code de confirmation OTP a expiré (validité 5 minutes). Veuillez relancer une connexion.',
                ], 422);
            }

            // Incrémentation des tentatives
            $user->increment('two_factor_otp_tentatives');
            $user->refresh();

            // Comparaison cryptographique sécurisée à temps constant
            $computedHash = hash('sha256', $codeOtp);
            if (! hash_equals((string) $user->two_factor_otp_hash, $computedHash)) {
                if ($user->two_factor_otp_tentatives >= $maxAttempts) {
                    $user->clearTwoFactorOtp();
                    AuditService::securityAlert('BRUTE_FORCE_2FA_OTP', "Tentatives excessives de validation OTP 2FA sur l'administrateur {$user->email}");
                    return response()->json([
                        'success' => false,
                        'message' => "Code OTP bloqué suite à {$maxAttempts} tentatives erronées. Veuillez vous reconnecter.",
                    ], 429);
                }

                $tentativesRestantes = $maxAttempts - $user->two_factor_otp_tentatives;
                return response()->json([
                    'success' => false,
                    'message' => "Code OTP invalide. Tentatives restantes avant verrouillage : {$tentativesRestantes}.",
                    'data' => [
                        'tentatives_restantes' => $tentativesRestantes,
                    ],
                ], 422);
            }

            // Validation 2FA réussie : purge de l'OTP et émission du token Sanctum
            $user->clearTwoFactorOtp();

            AuditService::log('admin_2fa_success', $user, [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'role' => $user->getRoleNames()->first() ?? 'Admin',
            ]);

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'success' => true,
                'message' => 'Double authentification réussie ! Bienvenue sur E-Mobilier.',
                'data' => [
                    'user' => $this->formatUserResponse($user),
                    'token' => $token,
                    'token_type' => 'Bearer',
                ],
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la vérification du code OTP.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Renvoi d'un nouveau code OTP en conservant la session 2FA active.
     */
    public function renvoyerOtp2Fa(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'two_factor_token' => 'required|string',
        ], [
            'two_factor_token.required' => 'Le jeton de session de double authentification est requis.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $token = (string) $request->input('two_factor_token');
            $user = User::where('two_factor_token', $token)->first();

            if (! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Session de double authentification introuvable ou expirée.',
                ], 401);
            }

            $codeOtp = $user->generateTwoFactorOtp($user->two_factor_token);

            try {
                app(MultiChannelNotificationService::class)->notifierOtpConnexionAdmin($user, $codeOtp);
            } catch (\Throwable $e) {
                Log::error('[2FA_OTP_RESEND_ERROR] ' . $e->getMessage());
            }

            AuditService::log('admin_2fa_otp_resend', $user, [
                'admin_id' => $user->id,
                'email' => $user->email,
            ]);

            $responsePayload = [
                'success' => true,
                'message' => 'Un nouveau code OTP a été expédié avec succès.',
                'data' => [
                    'two_factor_token' => $user->two_factor_token,
                    'destination_masquee' => $this->maskDestination($user),
                    'expires_in' => ((int) config('emobilier.admin_2fa_otp_ttl_minutes', 5)) * 60,
                ],
            ];

            if (app()->environment(['local', 'testing'])) {
                $responsePayload['data']['test_otp_code'] = $codeOtp;
            }

            return response()->json($responsePayload, 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors du renvoi du code OTP.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Déconnexion de l'utilisateur authentifié (révocation du token).
     */
    public function deconnexion(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            if ($user) {
                $user->currentAccessToken()?->delete();
            }

            return response()->json([
                'success' => true,
                'message' => 'Déconnexion réussie.',
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la déconnexion.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupération du profil de l'utilisateur connecté.
     */
    public function profil(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            if (! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Non authentifié.',
                ], 401);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => $this->formatUserResponse($user),
                ],
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la récupération du profil.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mise à jour des informations de profil (nom, prénom).
     */
    public function updateProfil(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
            'prenom' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
        ]);

        $user->update($validated);
        $user->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Profil mis à jour avec succès.',
            'data' => [
                'user' => $this->formatUserResponse($user),
            ],
        ], 200);
    }

    /**
     * Mise à jour de la photo de profil de l'utilisateur connecté.
     */
    public function updatePhotoProfil(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120'],
        ]);

        try {
            if ($user->photo_profil && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->photo_profil)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->photo_profil);
            }

            $path = $request->file('photo')->store('avatars', 'public');
            $user->update(['photo_profil' => $path]);
            $user->refresh();

            \App\Services\AuditService::log('profil_photo_modifiee', $user, [
                'photo_profil' => $path,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Photo de profil mise à jour avec succès.',
                'data' => [
                    'user' => $this->formatUserResponse($user),
                ],
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de mettre à jour la photo de profil.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Suppression de la photo de profil de l'utilisateur connecté.
     */
    public function deletePhotoProfil(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié.'], 401);
        }

        if ($user->photo_profil && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->photo_profil)) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($user->photo_profil);
        }

        $user->update(['photo_profil' => null]);
        $user->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Photo de profil supprimée.',
            'data' => [
                'user' => $this->formatUserResponse($user),
            ],
        ], 200);
    }

    /**
     * Formate les données de l'utilisateur pour le frontend.
     */
    protected function formatUserResponse(User $user): array
    {
        $roles = $user->getRoleNames()->values()->all();
        $primaryRole = $roles[0] ?? 'Client';

        $frontendRole = match ($primaryRole) {
            'Agent mobilier' => 'agent_immobilier',
            default => 'client_proprietaire',
        };

        $photoUrl = null;
        if (! empty($user->photo_profil)) {
            $photoUrl = str_starts_with($user->photo_profil, 'http')
                ? $user->photo_profil
                : url('storage/' . ltrim($user->photo_profil, '/'));
        }

        return [
            'id' => (string) $user->id,
            'name' => $user->fullName ?: trim("{$user->prenom} {$user->name}"),
            'nom' => $user->name,
            'prenom' => $user->prenom,
            'fullName' => $user->fullName ?: trim("{$user->prenom} {$user->name}"),
            'phone' => $user->telephone,
            'telephone' => $user->telephone,
            'email' => $user->email,
            'photo_profil' => $user->photo_profil,
            'photo_url' => $photoUrl,
            'role' => $frontendRole,
            'roles' => $roles,
            'is_financial_owner' => $user->isFinancialOwner(),
            'statut' => $user->statut ?? 'actif',
            'zone_id' => $user->zone_id,
            'is_verifed' => (bool) $user->is_verifed,
            'balanceFifa' => 5000,
            'created_at' => $user->created_at,
        ];
    }

    /**
     * Masque les coordonnées de destination pour des raisons de confidentialité.
     */
    protected function maskDestination(User $user): string
    {
        if (! empty($user->telephone)) {
            $phone = trim($user->telephone);
            if (strlen($phone) >= 8) {
                return substr($phone, 0, 6) . '••••' . substr($phone, -2);
            }
            return substr($phone, 0, 3) . '••••';
        }

        if (! empty($user->email)) {
            $parts = explode('@', $user->email);
            $name = $parts[0];
            $domain = $parts[1] ?? 'e-mobilier.bj';
            $maskedName = strlen($name) > 2 ? substr($name, 0, 2) . '•••' : $name . '•';
            return "{$maskedName}@{$domain}";
        }

        return 'canal sécurisé interne';
    }
}
