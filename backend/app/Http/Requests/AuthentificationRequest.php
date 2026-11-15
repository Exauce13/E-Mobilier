<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class AuthentificationRequest extends FormRequest
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
        $phoneInput = $this->input('phone') ?? $this->input('telephone');

        if ($phoneInput !== null) {
            $trimmedPhone = trim((string) $phoneInput);
            $withoutSpaces = preg_replace('/\s+/', '', $trimmedPhone);

            // Vérifier que le numéro commence par 01 (avec ou sans indicatif +229 / 00229 / 229) suivi de 8 chiffres
            if (preg_match('/^(\+229|00229|229)?01[0-9]{8}$/', $withoutSpaces)) {
                $cleaned = $withoutSpaces;

                if (str_starts_with($cleaned, '00229')) {
                    $cleaned = '+229' . substr($cleaned, 5);
                } elseif (str_starts_with($cleaned, '229')) {
                    $cleaned = '+' . $cleaned;
                } elseif (!str_starts_with($cleaned, '+')) {
                    $cleaned = '+229' . $cleaned;
                }

                $this->merge([
                    'telephone' => $cleaned,
                    'phone' => $cleaned,
                ]);
            } else {
                // Conserver la valeur brute pour déclencher l'erreur regex
                $this->merge([
                    'telephone' => $trimmedPhone,
                    'phone' => $trimmedPhone,
                ]);
            }
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $identifier = trim((string) ($this->input('phone') ?? $this->input('telephone') ?? ''));

        if ($identifier !== '' && str_contains($identifier, '@')) {
            return [
                'telephone' => ['required_without:phone', 'email'],
                'phone' => ['required_without:telephone', 'email'],
                'password' => ['required', 'string'],
            ];
        }

        return [
            'telephone' => ['required_without:phone', 'string', 'regex:/^(\+229|00229|229)?01[0-9]{8}$/'],
            'phone' => ['required_without:telephone', 'string', 'regex:/^(\+229|00229|229)?01[0-9]{8}$/'],
            'password' => ['required', 'string'],
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
            'telephone.required_without' => 'Veuillez saisir votre numéro de téléphone béninois ou votre email.',
            'phone.required_without' => 'Veuillez saisir votre numéro de téléphone béninois ou votre email.',
            'telephone.email' => 'Veuillez saisir une adresse email valide.',
            'phone.email' => 'Veuillez saisir une adresse email valide.',
            'telephone.regex' => 'Le numéro de téléphone doit obligatoirement commencer par 01 et comporter 10 chiffres (ex: 0197001122).',
            'phone.regex' => 'Le numéro de téléphone doit obligatoirement commencer par 01 et comporter 10 chiffres (ex: 0197001122).',
            'password.required' => 'Veuillez entrer votre mot de passe.',
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
