<?php

namespace App\Http\Requests;

use App\Models\Demande_client;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdatePostRechercheRequest extends FormRequest
{
    /**
     * Détermine si l'utilisateur est autorisé à effectuer cette requête.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prépare les données pour la validation.
     * Supporte camelCase (frontend React Native / Web) ou snake_case.
     */
    protected function prepareForValidation(): void
    {
        $mergeData = [];

        // Mapping propertyType / type -> property_type
        if ($this->has('propertyType') && ! $this->has('property_type')) {
            $mergeData['property_type'] = $this->input('propertyType');
        } elseif ($this->has('type') && ! $this->has('property_type')) {
            $mergeData['property_type'] = $this->input('type');
        }

        // Mapping transactionType -> transaction_type
        if ($this->has('transactionType') && ! $this->has('transaction_type')) {
            $mergeData['transaction_type'] = $this->input('transactionType');
        }

        // Mapping targetCommune / commune -> target_commune
        if ($this->has('targetCommune') && ! $this->has('target_commune')) {
            $mergeData['target_commune'] = $this->input('targetCommune');
        } elseif ($this->has('commune') && ! $this->has('target_commune')) {
            $mergeData['target_commune'] = $this->input('commune');
        }

        // Mapping targetArrondissement / arrondissement -> target_arrondissement
        if ($this->has('targetArrondissement') && ! $this->has('target_arrondissement')) {
            $mergeData['target_arrondissement'] = $this->input('targetArrondissement');
        } elseif ($this->has('arrondissement') && ! $this->has('target_arrondissement')) {
            $mergeData['target_arrondissement'] = $this->input('arrondissement');
        }

        // Mapping targetQuartier / quartier -> target_quartier
        if ($this->has('targetQuartier') && ! $this->has('target_quartier')) {
            $mergeData['target_quartier'] = $this->input('targetQuartier');
        } elseif ($this->has('quartier') && ! $this->has('target_quartier')) {
            $mergeData['target_quartier'] = $this->input('quartier');
        }

        // Mapping budgetMax / budget -> budget_max
        if ($this->has('budgetMax') && ! $this->has('budget_max')) {
            $mergeData['budget_max'] = $this->input('budgetMax');
        } elseif ($this->has('budget') && ! $this->has('budget_max')) {
            $mergeData['budget_max'] = $this->input('budget');
        }

        // Mapping criteriaDetails / details / description -> criteria_details
        if ($this->has('criteriaDetails') && ! $this->has('criteria_details')) {
            $mergeData['criteria_details'] = $this->input('criteriaDetails');
        } elseif ($this->has('details') && ! $this->has('criteria_details')) {
            $mergeData['criteria_details'] = $this->input('details');
        } elseif ($this->has('description') && ! $this->has('criteria_details')) {
            $mergeData['criteria_details'] = $this->input('description');
        }

        if (! empty($mergeData)) {
            $this->merge($mergeData);
        }
    }

    /**
     * Règles de validation applicables à la mise à jour de la demande.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_type' => ['sometimes', 'required', 'string', 'in:parcelle,maison,chambre'],
            'transaction_type' => ['sometimes', 'required', 'string', 'in:location,vente'],
            'target_commune' => ['sometimes', 'required', 'string', 'max:255'],
            'target_arrondissement' => ['nullable', 'string', 'max:255'],
            'target_quartier' => ['nullable', 'string', 'max:255'],
            'budget_max' => ['sometimes', 'required', 'numeric', 'min:1'],
            'criteria_details' => ['nullable', 'string', 'max:3000'],
            'status' => ['sometimes', 'required', 'string', 'in:active,fulfilled,closed'],
            'is_paid' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Configuration supplémentaire du validateur pour vérifier la compatibilité type/transaction.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $demandeId = $this->route('id') ?? $this->route('demande');
            $existing = null;
            if ($demandeId) {
                $existing = Demande_client::find($demandeId);
            }

            $propertyType = $this->input('property_type', $existing?->property_type);
            $transactionType = $this->input('transaction_type', $existing?->transaction_type);

            // Règle métier : seules les maisons et chambres peuvent être louées (pas de parcelle en location)
            if ($transactionType === 'location' && $propertyType === 'parcelle') {
                $validator->errors()->add(
                    'property_type',
                    "Une parcelle ne peut pas faire l'objet d'une demande de location. Seules les maisons et chambres peuvent être louées."
                );
            }
        });
    }

    /**
     * Messages personnalisés d'erreur de validation en français.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'property_type.required' => 'Le type de bien recherché est obligatoire.',
            'property_type.string' => 'Le type de bien doit être une chaîne de caractères valide.',
            'property_type.in' => 'Le type de bien doit être soit une parcelle, soit une maison, soit une chambre.',

            'transaction_type.required' => 'Le type d\'opération (location ou vente) est obligatoire.',
            'transaction_type.string' => 'Le type d\'opération doit être une chaîne de caractères valide.',
            'transaction_type.in' => 'Le type d\'opération doit être soit "location", soit "vente".',

            'target_commune.required' => 'La commune ciblée est obligatoire.',
            'target_commune.string' => 'La commune ciblée doit être une chaîne de caractères valide.',
            'target_commune.max' => 'La commune ciblée ne doit pas dépasser 255 caractères.',

            'target_arrondissement.string' => 'L\'arrondissement ciblé doit être une chaîne de caractères valide.',
            'target_arrondissement.max' => 'L\'arrondissement ciblé ne doit pas dépasser 255 caractères.',

            'target_quartier.string' => 'Le quartier ciblé doit être une chaîne de caractères valide.',
            'target_quartier.max' => 'Le quartier ciblé ne doit pas dépasser 255 caractères.',

            'budget_max.required' => 'Le budget maximum prévu est obligatoire.',
            'budget_max.numeric' => 'Le budget maximum doit être une valeur numérique valide (en FCFA).',
            'budget_max.min' => 'Le budget maximum doit être supérieur à zéro.',

            'criteria_details.string' => 'Les critères et détails supplémentaires doivent être une chaîne de caractères valide.',
            'criteria_details.max' => 'Les critères et détails supplémentaires ne doivent pas dépasser 3000 caractères.',

            'status.in' => 'Le statut doit être l\'une des valeurs suivantes : active, fulfilled, closed.',
        ];
    }

    /**
     * Gère l'échec de validation en renvoyant une réponse JSON claire (422).
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
