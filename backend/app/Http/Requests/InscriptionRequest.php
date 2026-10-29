<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class InscriptionRequest extends FormRequest
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
     */
    protected function prepareForValidation(): void
    {
        // Support either 'phone' (used in frontend) or 'telephone' (used in database)
        $phoneInput = $this->input('phone') ?? $this->input('telephone');

        if ($phoneInput !== null) {
            $cleaned = preg_replace('/[^\d+]/', '', trim((string) $phoneInput));

            if (str_starts_with($cleaned, '00229')) {
                $cleaned = '+229' . substr($cleaned, 5);
            } elseif (str_starts_with($cleaned, '229')) {
                $cleaned = '+' . $cleaned;
            } elseif (!str_starts_with($cleaned, '+') && strlen($cleaned) >= 8) {
                // If it's a Benin number without country code
                $cleaned = '+229' . $cleaned;
            }

            $this->merge([
                'telephone' => $cleaned,
                'phone' => $cleaned,
            ]);
        }

        // Support either 'fullName' (used in frontend) or 'name'/'prenom'
        if ($this->has('fullName') && !$this->has('name')) {
            $fullName = trim((string) $this->input('fullName'));
            $parts = explode(' ', $fullName, 2);

            $this->merge([
                'prenom' => $parts[0] ?? '',
                'name' => $parts[1] ?? $parts[0] ?? '',
            ]);
        } elseif ($this->has('name') && !$this->has('prenom')) {
            $this->merge([
                'prenom' => $this->input('name'),
            ]);
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
            'fullName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'name' => ['required_without:fullName', 'string', 'max:255'],
            'prenom' => ['nullable', 'string', 'max:255'],
            'telephone' => ['required', 'string', 'max:30', 'unique:users,telephone'],
            'phone' => ['sometimes', 'string', 'max:30'],
            'email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => [
                'nullable',
                'string',
                'in:client_proprietaire,agent_immobilier,Client,Propritaires,Agent mobilier,Admin',
            ],
            'acceptedTerms' => ['nullable', 'boolean'],
            'accepted_terms' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'fullName.required_without' => 'Veuillez renseigner votre nom complet.',
            'name.required_without' => 'Veuillez renseigner votre nom.',
            'telephone.required' => 'Veuillez saisir votre numéro de téléphone (MTN ou Moov).',
            'telephone.unique' => 'Ce numéro de téléphone est déjà associé à un compte.',
            'email.email' => 'Veuillez renseigner une adresse email valide.',
            'email.unique' => 'Cette adresse email est déjà associée à un compte.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.min' => 'Le mot de passe doit comporter au moins 6 caractères.',
            'role.in' => 'Le type de compte sélectionné est invalide.',
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
