<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class PropertyInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->has('propertyId') && ! $this->has('property_id')) {
            $merge['property_id'] = $this->input('propertyId');
        }
        if ($this->has('scheduledDate') && ! $this->has('scheduled_date')) {
            $merge['scheduled_date'] = $this->input('scheduledDate');
        }
        if ($this->has('meetingMode') && ! $this->has('meeting_mode')) {
            $merge['meeting_mode'] = $this->input('meetingMode');
        }
        if ($this->has('phone') && ! $this->has('telephone')) {
            $merge['telephone'] = $this->input('phone');
        }

        $phoneInput = $merge['telephone'] ?? $this->input('telephone');
        if ($phoneInput !== null) {
            $cleaned = preg_replace('/\s+/', '', trim((string) $phoneInput));
            if (preg_match('/^(\+229|00229|229)?01[0-9]{8}$/', $cleaned)) {
                if (str_starts_with($cleaned, '00229')) {
                    $cleaned = '+229' . substr($cleaned, 5);
                } elseif (str_starts_with($cleaned, '229')) {
                    $cleaned = '+' . $cleaned;
                } elseif (! str_starts_with($cleaned, '+')) {
                    $cleaned = '+229' . $cleaned;
                }
            }
            $merge['telephone'] = $cleaned;
        }

        foreach (['commune', 'quartier', 'sujet'] as $field) {
            if ($this->has($field) && is_string($this->input($field))) {
                $val = trim($this->input($field));
                $merge[$field] = $val === '' ? null : $val;
            }
        }

        if (! empty($merge)) {
            $this->merge($merge);
        }
    }

    public function rules(): array
    {
        $type = $this->input('type', 'contact');

        return [
            'property_id' => ['nullable', 'integer', 'exists:proprietes,id'],
            'type' => ['required', 'string', 'in:demande_visite,rendez_vous,contact,formulaire_client'],
            'nom' => ['required', 'string', 'min:2', 'max:120'],
            'prenom' => ['required', 'string', 'min:2', 'max:120'],
            'telephone' => ['required', 'string', 'min:8', 'max:30', 'regex:/^(\+?[0-9]{8,15})$/'],
            'email' => ['required', 'string', 'email', 'max:180'],
            'scheduled_date' => [
                in_array($type, ['demande_visite', 'rendez_vous'], true) ? 'required' : 'nullable',
                'date',
                'after:now',
            ],
            'meeting_mode' => ['nullable', 'string', 'in:sur_place,appel,agence'],
            'sujet' => ['nullable', 'string', 'max:180'],
            'commune' => [
                $type === 'formulaire_client' ? 'required' : 'nullable',
                'string',
                'min:2',
                'max:120',
            ],
            'quartier' => ['nullable', 'string', 'max:120'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'message' => ['nullable', 'string', 'max:3000'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'Le type de demande est obligatoire.',
            'type.in' => 'Le type de demande sélectionné est invalide.',
            'nom.required' => 'Le nom est obligatoire.',
            'nom.min' => 'Le nom doit contenir au moins 2 caractères.',
            'prenom.required' => 'Le prénom est obligatoire.',
            'prenom.min' => 'Le prénom doit contenir au moins 2 caractères.',
            'telephone.required' => 'Le numéro de téléphone est obligatoire.',
            'telephone.regex' => 'Veuillez saisir un numéro de téléphone valide (ex: 0197001122 ou +2290197001122).',
            'email.required' => "L'adresse e-mail est obligatoire.",
            'email.email' => "Veuillez saisir une adresse e-mail valide.",
            'scheduled_date.required' => 'La date et l\'heure souhaitées sont obligatoires.',
            'scheduled_date.date' => 'Veuillez saisir une date valide.',
            'scheduled_date.after' => 'La date choisie doit être ultérieure à maintenant.',
            'property_id.exists' => 'Le bien immobilier sélectionné est introuvable.',
            'commune.required' => 'La commune est obligatoire.',
            'commune.min' => 'Veuillez saisir un nom de commune d\'au moins 2 caractères.',
            'budget.numeric' => 'Le budget doit être un montant numérique valide.',
        ];
    }

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
