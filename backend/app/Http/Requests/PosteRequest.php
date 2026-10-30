<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class PosteRequest extends FormRequest
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
     * Supporte les champs envoyés en camelCase (frontend React Native / Web) ou snake_case.
     */
    protected function prepareForValidation(): void
    {
        $mergeData = [];

        // Mapping propertyType -> type
        if ($this->has('propertyType') && ! $this->has('type')) {
            $mergeData['type'] = $this->input('propertyType');
        }

        // Mapping transactionType -> transaction_type
        if ($this->has('transactionType') && ! $this->has('transaction_type')) {
            $mergeData['transaction_type'] = $this->input('transactionType');
        }

        // Mapping locationDetails -> location_details
        if ($this->has('locationDetails') && ! $this->has('location_details')) {
            $mergeData['location_details'] = $this->input('locationDetails');
        }

        // Mapping eauCourant -> eau_courant
        if ($this->has('eauCourant') && ! $this->has('eau_courant')) {
            $mergeData['eau_courant'] = $this->input('eauCourant');
        }

        // Mapping nombresChambres -> nombres_chambres
        if ($this->has('nombresChambres') && ! $this->has('nombres_chambres')) {
            $mergeData['nombres_chambres'] = $this->input('nombresChambres');
        }

        // Mapping avanceMois -> avance_mois
        if ($this->has('avanceMois') && ! $this->has('avance_mois')) {
            $mergeData['avance_mois'] = $this->input('avanceMois');
        }

        // Mapping isNegotiable -> is_negotiable et cast en booléen
        if ($this->has('isNegotiable') && ! $this->has('is_negotiable')) {
            $mergeData['is_negotiable'] = $this->input('isNegotiable');
        }
        if ($this->has('is_negotiable')) {
            $mergeData['is_negotiable'] = filter_var($this->input('is_negotiable'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        }

        // Valeurs par défaut selon le type et le type de transaction
        $type = $mergeData['type'] ?? $this->input('type');
        $transactionType = $mergeData['transaction_type'] ?? $this->input('transaction_type');

        if ($type === 'parcelle' && ! $this->has('nombres_chambres') && ! isset($mergeData['nombres_chambres'])) {
            $mergeData['nombres_chambres'] = 0;
        }

        if ($transactionType === 'vente' && ! $this->has('avance_mois') && ! isset($mergeData['avance_mois'])) {
            $mergeData['avance_mois'] = 0;
        }

        // Mapping kkiapay_transaction_id / transactionId
        if ($this->has('transactionId') && ! $this->has('kkiapay_transaction_id')) {
            $mergeData['kkiapay_transaction_id'] = $this->input('transactionId');
        } elseif ($this->has('transaction_id') && ! $this->has('kkiapay_transaction_id')) {
            $mergeData['kkiapay_transaction_id'] = $this->input('transaction_id');
        } elseif ($this->has('transaction_reference') && ! $this->has('kkiapay_transaction_id')) {
            $mergeData['kkiapay_transaction_id'] = $this->input('transaction_reference');
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
            // Identifiant de transaction Kkiapay
            'kkiapay_transaction_id' => ['nullable', 'string', 'max:255'],
            'transaction_reference' => ['nullable', 'string', 'max:255'],

            // Informations générales du bien
            'type' => ['required', 'string', 'in:parcelle,maison,chambre'],
            'transaction_type' => ['required', 'string', 'in:vente,location'],
            'commune' => ['required', 'string', 'max:255'],
            'arrondissement' => ['required', 'string', 'max:255'],
            'quartier' => ['required', 'string', 'max:255'],
            'location_details' => ['nullable', 'string', 'max:1000'],
            'accessibilite' => ['required', 'string', 'max:255'],
            'eau_courant' => ['required', 'string', 'max:255'],
            'surface' => ['required', 'numeric', 'min:1'],
            'nombres_chambres' => ['nullable', 'integer', 'min:0'],
            'avance_mois' => ['nullable', 'integer', 'min:0'],
            'prix' => ['required', 'numeric', 'min:0'],
            'is_negotiable' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:5000'],

            // Documents spécifiques (max 12 Mo = 12288 Ko)
            'convention_vente' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'permis_habiter' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'attestation_recasement' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'titre_foncier' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'autre_document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],

            // Tableau de documents générique optionnel (max 12 Mo par document)
            'documents' => ['nullable', 'array'],
            'documents.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:12288'],
            'document_types' => ['nullable', 'array'],
            'document_types.*' => ['string', 'in:convention_vente,permis_habiter,attestation_recasement,titre_foncier,autre'],

            // Photos (max 12 Mo par photo)
            'photos' => ['nullable', 'array'],
            'photos.*' => ['file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
            'photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288'],

            // Vidéos (max 50 Mo par vidéo)
            'videos' => ['nullable', 'array'],
            'videos.*' => ['file', 'mimes:mp4,mov,avi,webm,mkv', 'max:51200'],
            'video' => ['nullable', 'file', 'mimes:mp4,mov,avi,webm,mkv', 'max:51200'],

            // Tableau mixte de médias (photos et/ou vidéos, ex: media, medias ou media_json)
            'medias' => ['nullable', 'array'],
            'medias.*' => ['file', 'mimes:jpg,jpeg,png,webp,mp4,mov,avi,webm,mkv', 'max:51200'],
            'media_json' => ['nullable', 'array'],
            'media_json.*' => ['file', 'mimes:jpg,jpeg,png,webp,mp4,mov,avi,webm,mkv', 'max:51200'],
        ];
    }

    /**
     * Validation contextuelle avancée :
     * 1. Seules les maisons et chambres peuvent être louées (une parcelle ne se loue pas).
     * 2. Pour la location, les documents ne sont pas nécessaires.
     * 3. Pour la vente de maison ou de parcelle, au moins un document justificatif (max 12 Mo) est obligatoire.
     * 4. En cas de location, l'avance sur loyer (avance_mois) est requise. En vente, elle est fixée à 0.
     * 5. Obligation d'avoir au moins un média (photo et/ou vidéo).
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('type');
            $transactionType = $this->input('transaction_type');

            // 1. Règle : Seules les maisons et chambres peuvent être louées
            if ($transactionType === 'location' && $type === 'parcelle') {
                $validator->errors()->add(
                    'type',
                    'Une parcelle ne peut pas être mise en location. Seules les maisons et les chambres peuvent être louées.'
                );
            }

            // 2. Règle : Documents obligatoires UNIQUEMENT pour la vente de maison ou parcelle (non requis pour la location)
            if ($transactionType === 'vente' && in_array($type, ['parcelle', 'maison'])) {
                $hasDocument = $this->hasFile('convention_vente')
                    || $this->hasFile('permis_habiter')
                    || $this->hasFile('attestation_recasement')
                    || $this->hasFile('titre_foncier')
                    || $this->hasFile('autre_document')
                    || ($this->hasFile('documents') && count((array) $this->file('documents')) > 0);

                if (! $hasDocument) {
                    $validator->errors()->add(
                        'documents',
                        "Pour la vente d'une maison ou d'une parcelle, au moins un document justificatif (titre foncier, convention de vente, permis d'habiter ou attestation de recasement de 12 Mo au plus) est obligatoire."
                    );
                }
            }

            // 3. Règle : Avance de loyer obligatoire en location
            if ($transactionType === 'location' && (! $this->has('avance_mois') || $this->input('avance_mois') === null)) {
                $validator->errors()->add(
                    'avance_mois',
                    "Le nombre de mois d'avance est obligatoire pour une mise en location."
                );
            }

            // 4. Exigence de médias (au moins une photo et/ou une vidéo)
            $hasMedia = $this->hasFile('photos')
                || $this->hasFile('photo')
                || $this->hasFile('videos')
                || $this->hasFile('video')
                || $this->hasFile('medias')
                || $this->hasFile('media_json');

            if (! $hasMedia) {
                $validator->errors()->add(
                    'medias',
                    'Veuillez ajouter au moins une photo ou une vidéo pour illustrer votre bien.'
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
            // Informations générales
            'type.required' => 'Le type de bien est obligatoire (parcelle, maison ou chambre).',
            'type.in' => 'Le type de bien doit être "parcelle", "maison" ou "chambre".',
            'transaction_type.required' => 'Le type de transaction est obligatoire (vente ou location).',
            'transaction_type.in' => 'Le type de transaction doit être "vente" ou "location".',
            'commune.required' => 'La commune est obligatoire.',
            'arrondissement.required' => "L'arrondissement est obligatoire.",
            'quartier.required' => 'Le quartier est obligatoire.',
            'accessibilite.required' => "L'accessibilité est obligatoire (ex: Pavé, Goudronné, Terre battue).",
            'eau_courant.required' => "L'accès à l'eau courante / électricité est obligatoire.",
            'surface.required' => 'La superficie est obligatoire.',
            'surface.numeric' => 'La superficie doit être une valeur numérique.',
            'surface.min' => 'La superficie doit être supérieure à 0 m².',
            'prix.required' => 'Le prix est obligatoire.',
            'prix.numeric' => 'Le prix doit être un montant numérique valide.',
            'prix.min' => 'Le prix ne peut pas être négatif.',
            'nombres_chambres.integer' => 'Le nombre de chambres doit être un nombre entier.',
            'avance_mois.integer' => "Le nombre de mois d'avance doit être un nombre entier.",

            // Documents (max 12 Mo)
            'convention_vente.file' => 'La convention de vente doit être un fichier valide.',
            'convention_vente.mimes' => 'La convention de vente doit être un document au format PDF, JPG, JPEG ou PNG.',
            'convention_vente.max' => 'La convention de vente ne doit pas dépasser 12 Mo.',

            'permis_habiter.file' => "Le permis d'habiter doit être un fichier valide.",
            'permis_habiter.mimes' => "Le permis d'habiter doit être un document au format PDF, JPG, JPEG ou PNG.",
            'permis_habiter.max' => "Le permis d'habiter ne doit pas dépasser 12 Mo.",

            'attestation_recasement.file' => "L'attestation de recasement doit être un fichier valide.",
            'attestation_recasement.mimes' => "L'attestation de recasement doit être un document au format PDF, JPG, JPEG ou PNG.",
            'attestation_recasement.max' => "L'attestation de recasement ne doit pas dépasser 12 Mo.",

            'titre_foncier.file' => 'Le titre foncier doit être un fichier valide.',
            'titre_foncier.mimes' => 'Le titre foncier doit être un document au format PDF, JPG, JPEG ou PNG.',
            'titre_foncier.max' => 'Le titre foncier ne doit pas dépasser 12 Mo.',

            'autre_document.file' => 'Le document complémentaire doit être un fichier valide.',
            'autre_document.mimes' => 'Le document complémentaire doit être un document au format PDF, JPG, JPEG ou PNG.',
            'autre_document.max' => 'Le document complémentaire ne doit pas dépasser 12 Mo.',

            'documents.*.file' => 'Chaque document doit être un fichier valide.',
            'documents.*.mimes' => 'Chaque document doit être au format PDF, JPG, JPEG ou PNG.',
            'documents.*.max' => 'Chaque document ne doit pas dépasser 12 Mo.',

            // Médias (photos & vidéos)
            'photos.*.file' => 'Chaque photo doit être un fichier image valide.',
            'photos.*.mimes' => 'Les photos doivent être au format JPG, JPEG, PNG ou WEBP.',
            'photos.*.max' => 'Chaque photo ne doit pas dépasser 12 Mo.',

            'videos.*.file' => 'Chaque vidéo doit être un fichier vidéo valide.',
            'videos.*.mimes' => 'Les vidéos doivent être au format MP4, MOV, AVI, WEBM ou MKV.',
            'videos.*.max' => 'Chaque vidéo ne doit pas dépasser 50 Mo.',

            'medias.*.file' => 'Chaque média doit être un fichier valide.',
            'medias.*.mimes' => 'Les fichiers médias doivent être des images (JPG, PNG, WEBP) ou des vidéos (MP4, MOV, AVI, WEBM, MKV).',
            'medias.*.max' => 'Chaque fichier média ne doit pas dépasser 50 Mo.',

            'media_json.*.file' => 'Chaque média doit être un fichier valide.',
            'media_json.*.mimes' => 'Les fichiers médias doivent être des images (JPG, PNG, WEBP) ou des vidéos (MP4, MOV, AVI, WEBM, MKV).',
            'media_json.*.max' => 'Chaque fichier média ne doit pas dépasser 50 Mo.',
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
