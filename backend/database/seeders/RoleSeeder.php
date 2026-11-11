<?php

namespace Database\Seeders;

use App\Models\DocumentLegal;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Initialisation des Rôles
        $roles = [
            'Super Admin Principal',
            'Super Admin Technique',
            'Secrétaire',
            'Responsable de zone',
            'Agent mobilier',
            'Client',
            'Admin', // Legacy
        ];

        foreach ($roles as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'sanctum']);
        }

        // 2. Initialisation des Zones géographiques pilotes au Bénin
        $zonesPilotes = [
            [
                'code' => 'ZON-LIT-COT-01',
                'nom' => 'Cotonou Métropole (Zone 1 - Résidentielle)',
                'departement' => 'Littoral',
                'commune' => 'Cotonou',
                'arrondissements' => ['Haie Vive', 'Cocotiers', 'Cadjehoun', 'Patte d\'Oie', 'Gbégamey'],
                'description' => 'Secteur résidentiel haut standing et diplomatique.',
                'is_active' => true,
            ],
            [
                'code' => 'ZON-LIT-COT-02',
                'nom' => 'Cotonou Est & Commercial (Zone 2)',
                'departement' => 'Littoral',
                'commune' => 'Cotonou',
                'arrondissements' => ['Akpakpa', 'Dantokpa', 'St Michel', 'Maromaro'],
                'description' => 'Secteur commercial dense et quartiers d\'affaires.',
                'is_active' => true,
            ],
            [
                'code' => 'ZON-ATL-CAL-01',
                'nom' => 'Abomey-Calavi Centre & Arconville',
                'departement' => 'Atlantique',
                'commune' => 'Abomey-Calavi',
                'arrondissements' => ['Calavi Centre', 'Godomey', 'Arconville', 'Tankpè'],
                'description' => 'Grande zone d\'expansion urbaine et logements étudiants/résidentiels.',
                'is_active' => true,
            ],
            [
                'code' => 'ZON-ATL-OUI-01',
                'nom' => 'Ouidah & Zone Côtière',
                'departement' => 'Atlantique',
                'commune' => 'Ouidah',
                'arrondissements' => ['Ouidah Centre', 'Djègbadji', 'Pahou'],
                'description' => 'Secteur touristique balnéaire, parcelles et villas de vacances.',
                'is_active' => true,
            ],
            [
                'code' => 'ZON-OUE-POR-01',
                'nom' => 'Porto-Novo Capitale',
                'departement' => 'Ouémé',
                'commune' => 'Porto-Novo',
                'arrondissements' => ['Attakè', 'Djassin', 'Oganla', 'Ouando'],
                'description' => 'Capitale administrative et parcelles d\'habitation.',
                'is_active' => true,
            ],
        ];

        foreach ($zonesPilotes as $dataZone) {
            Zone::firstOrCreate(['code' => $dataZone['code']], $dataZone);
        }

        // 3. Initialisation du Super Administrateur Principal (MAGNIDE Justin)
        $ownerEmail = config('emobilier.super_admin_principal_email', 'justin.magnide@e-mobilier.bj');
        $justin = User::firstOrCreate(
            ['email' => $ownerEmail],
            [
                'name' => 'MAGNIDE',
                'prenom' => 'Justin',
                'telephone' => '+229 97 00 00 01',
                'password' => Hash::make('JustinOwner@2026!'),
                'is_verifed' => true,
                'statut' => 'actif',
            ]
        );
        $justin->syncRoles(['Super Admin Principal', 'Admin']);

        // 4. Initialisation / Attribution du Super Administrateur Technique (Jean-Paul GNIKPO)
        $techUser = User::where('email', 'jeanpaul@gmail.com')
            ->orWhere('email', 'jeanpaulgnikpo@gmail.com')
            ->first();

        if ($techUser) {
            $techUser->syncRoles(['Super Admin Technique', 'Admin']);
            $techUser->update(['statut' => 'actif']);
        }

        // 5. Initialisation des Documents Légaux v1.0 (CGU & Charte de Non-Contournement)
        $cguContent = "# CONDITIONS GÉNÉRALES D'UTILISATION (CGU) - E-MOBILIER\nVersion : 1.0 (Novembre 2026)\n1. OBJET DE LA PLATEFORME : E-Mobilier fournit des services d'intermédiation immobilière, de consultation de parcelles et de réservation d'hébergements en République du Bénin.\n2. SERVICES PAYANTS : La consultation détaillée des coordonnées réelles (50 FCFA) et les visites guidées physiques (500 FCFA) font l'objet d'un paiement préalable non remboursable.\n3. CONFORMITÉ LÉGALE : Tout utilisateur s'engage à respecter les lois foncières béninoises en vigueur.";

        DocumentLegal::firstOrCreate(
            ['type' => 'cgu', 'version' => 'v1.0'],
            [
                'titre' => 'Conditions Générales d\'Utilisation E-Mobilier',
                'contenu' => $cguContent,
                'hash_contenu' => hash('sha256', $cguContent),
                'is_active' => true,
                'published_at' => now(),
            ]
        );

        $charteContent = "# CHARTE DE CONFIDENTIALITÉ ET DE NON-CONTOURNEMENT - E-MOBILIER\nVersion : 1.0 (Novembre 2026)\nApplicable à : Tout administrateur secondaire (Secrétaire, Responsable de zone), stagiaire ou agent opérationnel.\n1. CONFIDENTIALITÉ STRICTE : Les coordonnées et l'identité des clients constituent des secrets d'affaires exclusifs d'E-Mobilier.\n2. INTERDICTION FORMELLE DE CONTOURNEMENT : Il est formellement interdit de contacter directement un client en dehors des canaux agréés ou de divulguer son numéro à un tiers sans autorisation préalable expresse.\n3. SANCTIONS : Tout contournement avéré entraîne la révocation immédiate du compte et des poursuites judiciaires.";

        DocumentLegal::firstOrCreate(
            ['type' => 'charte_non_contournement', 'version' => 'v1.0'],
            [
                'titre' => 'Charte de Confidentialité et de Non-Contournement Interne',
                'contenu' => $charteContent,
                'hash_contenu' => hash('sha256', $charteContent),
                'is_active' => true,
                'published_at' => now(),
            ]
        );
    }
}
