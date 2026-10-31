<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class VisiteRequest extends FormRequest
{
    /**
     * Détermine si l'utilisateur est autorisé à effectuer cette requête.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prépare les données pour la validation (support camelCase et snake_case).
     */
    protected function prepareForValidation(): void
    {
        $mergeData = [];

        // Mapping propertyId / property_id
        if ($this->has('propertyId') && ! $this->has('property_id')) {
            $mergeData['property_id'] = $this->input('propertyId');
        }

        // Mapping scheduledDate / scheduled_date / date_visite
        if ($this->has('scheduledDate') && ! $this->has('scheduled_date')) {
            $mergeData['scheduled_date'] = $this->input('scheduledDate');
        } elseif ($this->has('date_visite') && ! $this->has('scheduled_date')) {
            $mergeData['scheduled_date'] = $this->input('date_visite');
        }

        // Mapping transactionId / kkiapayTransactionId / transaction_id
        if ($this->has('transactionId') && ! $this->has('kkiapay_transaction_id')) {
            $mergeData['kkiapay_transaction_id'] = $this->input('transactionId');
        } elseif ($this->has('kkiapayTransactionId') && ! $this->has('kkiapay_transaction_id')) {
            $mergeData['kkiapay_transaction_id'] = $this->input('kkiapayTransactionId');
        } elseif ($this->has('transaction_id') && ! $this->has('kkiapay_transaction_id')) {
            $mergeData['kkiapay_transaction_id'] = $this->input('transaction_id');
        }

        if (! empty($mergeData)) {
            $this->merge($mergeData);
        }
    }

    /**
     * Règles de validation pour la demande de visite physique.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'integer', 'exists:proprietes,id'],
            'scheduled_date' => ['required', 'date', 'after:now'],
            'kkiapay_transaction_id' => ['required', 'string'],
        ];
    }

    /**
     * Messages personnalisés d'erreur de validation en français.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'property_id.required' => 'L\'identifiant de la propriété à visiter est obligatoire.',
            'property_id.integer' => 'L\'identifiant de la propriété doit être un entier valide.',
            'property_id.exists' => 'La propriété sélectionnée n\'existe pas dans notre base de données.',

            'scheduled_date.required' => 'La date et l\'heure souhaitées pour la visite sont obligatoires.',
            'scheduled_date.date' => 'La date de la visite doit être au format date/heure valide.',
            'scheduled_date.after' => 'La date de la visite doit être ultérieure à la date et heure actuelles.',

            'kkiapay_transaction_id.required' => 'La référence du paiement Kkiapay (500 FCFA pour la visite) est obligatoire.',
            'kkiapay_transaction_id.string' => 'La référence de transaction Kkiapay doit être une chaîne de caractères valide.',
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
