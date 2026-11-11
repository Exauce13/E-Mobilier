<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Zone;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ZoneController extends Controller
{
    /**
     * Liste l'ensemble des zones géographiques.
     * Accessible à tous les administrateurs.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Zone::query();

        // Filtre optionnel par statut actif
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filtre par commune ou département
        if ($request->filled('commune')) {
            $query->where('commune', 'ILIKE', '%' . $request->input('commune') . '%');
        }
        if ($request->filled('departement')) {
            $query->where('departement', 'ILIKE', '%' . $request->input('departement') . '%');
        }

        $zones = $query->withCount(['users', 'proprietes'])
            ->orderBy('departement')
            ->orderBy('commune')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Référentiel des zones géographiques récupéré avec succès.',
            'count' => $zones->count(),
            'data' => $zones,
        ]);
    }

    /**
     * Crée une nouvelle zone géographique.
     * Réservé aux Super Administrateurs.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'departement' => ['required', 'string', 'max:100'],
            'commune' => ['required', 'string', 'max:100'],
            'arrondissements' => ['nullable', 'array'],
            'code' => ['required', 'string', 'max:50', 'unique:zones,code'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $zone = Zone::create($validated);

        AuditService::log('creation_zone', $zone, [
            'nom' => $zone->nom,
            'code' => $zone->code,
            'commune' => $zone->commune,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Zone géographique créée avec succès.',
            'data' => $zone,
        ], 201);
    }

    /**
     * Met à jour une zone géographique (limites ou activation/désactivation).
     * Réservé aux Super Administrateurs.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $zone = Zone::findOrFail($id);

        $validated = $request->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'departement' => ['sometimes', 'string', 'max:100'],
            'commune' => ['sometimes', 'string', 'max:100'],
            'arrondissements' => ['nullable', 'array'],
            'code' => ['sometimes', 'string', 'max:50', Rule::unique('zones', 'code')->ignore($zone->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $zone->update($validated);

        AuditService::log('modification_zone', $zone, [
            'modifications' => $validated,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Zone géographique mise à jour avec succès.',
            'data' => $zone,
        ]);
    }
}

