<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdatePosteRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare the data for validation.
     * Supporte camelCase et snake_case.
     */
    protected function prepareForValidation(): void
    {
        $mergeData = [];

        if ($this->has('propertyType') && ! $this->has('type')) {
            $mergeData['type'] = $this->input('propertyType');
        }

        if ($this->has('transactionType') && ! $this->has('transaction_type')) {
            $mergeData['transaction_type'] = $this->input('transactionType');
        }

        if ($this->has('locationDetails') && ! $this->has('location_details')) {
            $mergeData['location_details'] = $this->input('locationDetails');
        }

        if ($this->has('eauCourant') && ! $this->has('eau_courant')) {
            $mergeData['eau_courant'] = $this->input('eauCourant');
        }

        if ($this->has('nombresChambres') && ! $this->has('nombres_chambres')) {
            $mergeData['nombres_chambres'] = $this->input('nombresChambres');
        }

        if ($this->has('avanceMois') && ! $this->has('avance_mois')) {
            $mergeData['avance_mois'] = $this->input('avanceMois');
        }

        if ($this->has('isNegotiable') && ! $this->has('is_negotiable')) {
            $mergeData['is_negotiable'] = $this->input('isNegotiable');
        }
        if ($this->has('is_negotiable')) {
            $mergeData['is_negotiable'] = filter_var($this->input('is_negotiable'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        }

        $type = $mergeData['type'] ?? $this->input('type');
        $transactionType = $mergeData['transaction_type'] ?? $this->input('transaction_type');

        if ($type === 'parcelle') {
            $mergeData['nombres_chambres'] = 0;
        }

        if ($transactionType === 'vente') {
            $mergeData['avance_mois'] = 0;
        }

        if (! empty($mergeData)) {
            $this->merge($mergeData);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['sometimes', 'string', 'in:parcelle,maison,chambre'],
            'transaction_type' => ['sometimes', 'string', 'in:vente,location'],
            'commune' => ['sometimes', 'string', 'max:255'],
            'arrondissement' => ['sometimes', 'string', 'max:255'],
            'quartier' => ['sometimes', 'string', 'max:255'],
            'location_details' => ['nullable', 'string', 'max:1000'],
            'accessibilite' => ['sometimes', 'string', 'max:255'],
            'eau_courant' => ['sometimes', 'string', 'max:255'],
            'surface' => ['sometimes', 'numeric', 'min:1'],
            'nombres_chambres' => ['nullable', 'integer', 'min:0'],
            'avance_mois' => ['nullable', 'integer', 'min:0'],
            'prix' => ['sometimes', 'numeric', 'min:0'],
            'is_negotiable' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'string', 'in:pending,published,sold_rented'],

            // Nouveaux documents éventuels (max 12 Mo)
            'convention_vente' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'permis_habiter' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'attestation_recasement' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'titre_foncier' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'autre_document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],

            'documents' => ['nullable', 'array'],
            'documents.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'document_types' => ['nullable', 'array'],
            'document_types.*' => ['string', 'in:convention_vente,permis_habiter,attestation_recasement,titre_foncier,autre'],

            // Nouveaux médias éventuels
            'photos' => ['nullable', 'array'],
            'photos.*' => ['file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
            'photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],

            'videos' => ['nullable', 'array'],
            'videos.*' => ['file', 'mimes:mp4,mov,avi,webm,mkv', 'max:51200'],
            'video' => ['nullable', 'file', 'mimes:mp4,mov,avi,webm,mkv', 'max:51200'],

            'medias' => ['nullable', 'array'],
            'medias.*' => ['file', 'mimes:jpg,jpeg,png,webp,mp4,mov,avi,webm,mkv', 'max:51200'],
            'media_json' => ['nullable', 'array'],
            'media_json.*' => ['file', 'mimes:jpg,jpeg,png,webp,mp4,mov,avi,webm,mkv', 'max:51200'],

            // Suppression facultative d'anciens médias ou documents
            'delete_media_ids' => ['nullable', 'array'],
            'delete_media_ids.*' => ['integer'],
            'delete_document_ids' => ['nullable', 'array'],
            'delete_document_ids.*' => ['integer'],
        ];
    }

    /**
     * Validation contextuelle avancée.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('type');
            $transactionType = $this->input('transaction_type');

            if ($transactionType === 'location' && $type === 'parcelle') {
                $validator->errors()->add(
                    'type',
                    'Une parcelle ne peut pas être mise en location. Seules les maisons et les chambres peuvent être louées.'
                );
            }
        });
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.in' => 'Le type de bien doit être "parcelle", "maison" ou "chambre".',
            'transaction_type.in' => 'Le type de transaction doit être "vente" ou "location".',
            'surface.numeric' => 'La superficie doit être une valeur numérique.',
            'surface.min' => 'La superficie doit être supérieure à 0 m².',
            'prix.numeric' => 'Le prix doit être un montant numérique valide.',
            'prix.min' => 'Le prix ne peut pas être négatif.',
            'nombres_chambres.integer' => 'Le nombre de chambres doit être un nombre entier.',
            'avance_mois.integer' => "Le nombre de mois d'avance doit être un nombre entier.",

            // Documents (max 12 Mo)
            'convention_vente.max' => 'La convention de vente ne doit pas dépasser 12 Mo.',
            'permis_habiter.max' => "Le permis d'habiter ne doit pas dépasser 12 Mo.",
            'attestation_recasement.max' => "L'attestation de recasement ne doit pas dépasser 12 Mo.",
            'titre_foncier.max' => 'Le titre foncier ne doit pas dépasser 12 Mo.',
            'documents.*.max' => 'Chaque document ne doit pas dépasser 12 Mo.',
            'documents.*.mimes' => 'Chaque document doit être au format PDF, JPG, JPEG ou PNG.',

            // Médias
            'photos.*.max' => 'Chaque photo ne doit pas dépasser 12 Mo.',
            'videos.*.max' => 'Chaque vidéo ne doit pas dépasser 50 Mo.',
            'medias.*.max' => 'Chaque média ne doit pas dépasser 50 Mo.',
        ];
    }

    /**
     * Handle a failed validation attempt.
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
