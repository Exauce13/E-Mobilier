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
            $cleaned = preg_replace('/[^\d+]/', '', trim((string) $phoneInput));

            if (str_starts_with($cleaned, '00229')) {
                $cleaned = '+229' . substr($cleaned, 5);
            } elseif (str_starts_with($cleaned, '229')) {
                $cleaned = '+' . $cleaned;
            } elseif (!str_starts_with($cleaned, '+') && strlen($cleaned) >= 8) {
                $cleaned = '+229' . $cleaned;
            }

            $this->merge([
                'telephone' => $cleaned,
                'phone' => $cleaned,
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
            'telephone' => ['required_without:phone', 'string'],
            'phone' => ['required_without:telephone', 'string'],
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
            'telephone.required_without' => 'Veuillez saisir votre numéro de téléphone béninois.',
            'phone.required_without' => 'Veuillez saisir votre numéro de téléphone béninois.',
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
