import os
import subprocess

html_content = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Spécifications Techniques Backend & Architecture E-Mobilier</title>
<style>
  @page {
    size: A4;
    margin: 18mm 14mm 18mm 14mm;
    @bottom-right {
      content: "Page " counter(page);
      font-size: 8pt;
      font-family: Arial, sans-serif;
      color: #64748b;
    }
    @bottom-left {
      content: "E-Mobilier — Spécifications Backend v2.0 | Confidentiel Interne";
      font-size: 8pt;
      font-family: Arial, sans-serif;
      color: #64748b;
    }
  }

  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    line-height: 1.45;
    font-size: 9pt;
    margin: 0;
    padding: 0;
  }

  /* Page de couverture */
  .cover-page {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 94vh;
    padding: 20px 10px;
    box-sizing: border-box;
  }
  .cover-header {
    border-bottom: 4px solid #1e3a8a;
    padding-bottom: 20px;
  }
  .brand {
    font-size: 26pt;
    font-weight: 900;
    color: #1e3a8a;
    letter-spacing: -0.5px;
    margin: 0;
  }
  .brand-sub {
    font-size: 11pt;
    font-weight: bold;
    color: #0d9488;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 5px;
  }
  .cover-body {
    margin-top: 60px;
  }
  .doc-title {
    font-size: 24pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
    margin: 0 0 15px 0;
  }
  .doc-subtitle {
    font-size: 13pt;
    color: #475569;
    line-height: 1.4;
    margin-bottom: 30px;
  }
  .badge-confidential {
    display: inline-block;
    background-color: #fee2e2;
    color: #991b1b;
    font-size: 8.5pt;
    font-weight: bold;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid #f87171;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 20px;
  }
  .cover-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 30px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 16px;
  }
  .cover-item h4 {
    margin: 0 0 4px 0;
    font-size: 8.5pt;
    color: #64748b;
    text-transform: uppercase;
  }
  .cover-item p {
    margin: 0;
    font-size: 10pt;
    font-weight: 600;
    color: #1e293b;
  }
  .cover-footer {
    border-top: 1px solid #cbd5e1;
    padding-top: 15px;
    font-size: 8pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }

  /* Structure générale */
  h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #1e3a8a;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }
  h2 {
    font-size: 12pt;
    font-weight: 700;
    color: #0f172a;
    border-left: 4px solid #0d9488;
    padding-left: 8px;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10pt;
    font-weight: 700;
    color: #1e3a8a;
    margin-top: 12px;
    margin-bottom: 4px;
    page-break-after: avoid;
  }
  p {
    margin: 0 0 8px 0;
  }
  ul, ol {
    margin: 4px 0 10px 18px;
    padding: 0;
  }
  li {
    margin-bottom: 3px;
  }

  /* Blocs d'alerte et boîtes d'informations */
  .callout {
    background-color: #f8fafc;
    border-left: 4px solid #1e3a8a;
    padding: 8px 12px;
    margin: 10px 0;
    border-radius: 0 4px 4px 0;
    font-size: 8.5pt;
  }
  .callout-warning {
    background-color: #fffbeb;
    border-left: 4px solid #d97706;
    color: #92400e;
  }
  .callout-danger {
    background-color: #fef2f2;
    border-left: 4px solid #dc2626;
    color: #991b1b;
  }
  .callout-success {
    background-color: #f0fdf4;
    border-left: 4px solid #16a34a;
    color: #166534;
  }

  /* Tableaux */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px 0;
    font-size: 8pt;
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  th {
    background-color: #1e3a8a;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 6px 7px;
    border: 1px solid #1e3a8a;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  td {
    padding: 5px 7px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }
  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  /* Badges pour endpoints et permissions */
  .badge {
    display: inline-block;
    padding: 1.5px 5px;
    border-radius: 3px;
    font-size: 7pt;
    font-weight: 700;
    font-family: monospace;
    text-align: center;
  }
  .badge-get { background-color: #0284c7; color: white; }
  .badge-post { background-color: #16a34a; color: white; }
  .badge-patch { background-color: #d97706; color: white; }
  .badge-delete { background-color: #dc2626; color: white; }

  .badge-role {
    background-color: #e2e8f0;
    color: #334155;
    font-size: 6.8pt;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 2px;
    display: inline-block;
    margin: 1px;
  }
  .badge-justin { background-color: #fef3c7; color: #92400e; border: 1px solid #f59e0b; font-weight: bold; }
  .badge-tech { background-color: #e0f2fe; color: #0369a1; border: 1px solid #38bdf8; }
  .badge-secr { background-color: #f3e8ff; color: #6b21a8; border: 1px solid #c084fc; }
  .badge-zone { background-color: #dcfce7; color: #15803d; border: 1px solid #4ade80; }

  code {
    font-family: Consolas, Monaco, monospace;
    font-size: 7.5pt;
    background-color: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }

  .page-break {
    page-break-before: always;
  }

  .box-notions {
    background-color: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 8px 12px;
    margin: 6px 0 10px 0;
  }
  .box-notions h4 {
    margin: 0 0 4px 0;
    font-size: 8pt;
    color: #0f172a;
    text-transform: uppercase;
  }

</style>
</head>
<body>

<!-- PAGE DE COUVERTURE -->
<div class="cover-page">
  <div class="cover-header">
    <div class="brand">E-MOBILIER</div>
    <div class="brand-sub">Plateforme Immobilière & d'Hébergements — République du Bénin</div>
  </div>

  <div class="cover-body">
    <div class="badge-confidential">Document d'Ingénierie & Spécifications Confidentiel</div>
    <h1 class="doc-title">Spécifications Techniques Backend & Architecture de Sécurité</h1>
    <div class="doc-subtitle">
      Plan Directeur Exhaustif : Rôles & Permissions (RBAC/ABAC), Cloisonnement Financier Zero-Trust, 
      Dispositif Anti-Contournement, Moteur Multi-Canal & Couverture Intégrale des Opérations Métier.
    </div>

    <div class="cover-grid">
      <div class="cover-item">
        <h4>Commanditaire & Décisionnaire Légal</h4>
        <p>MAGNIDE Justin<br><span style="font-size: 8.5pt; font-weight: normal; color: #64748b;">Super Administrateur Principal (Propriétaire)</span></p>
      </div>
      <div class="cover-item">
        <h4>Responsable Architecture & Technique</h4>
        <p>Jean-Paul GNIKPO<br><span style="font-size: 8.5pt; font-weight: normal; color: #64748b;">Super Administrateur Technique (Lead Backend)</span></p>
      </div>
      <div class="cover-item">
        <h4>Version & Statut Documentaire</h4>
        <p>Version 2.0 (Consolidée)<br><span style="font-size: 8.5pt; font-weight: normal; color: #64748b;">5 Phases Fondations + 5 Briques Opérationnelles</span></p>
      </div>
      <div class="cover-item">
        <h4>Périmètre d'Audit Spécialisé</h4>
        <p>Préparation Pentest<br><span style="font-size: 8.5pt; font-weight: normal; color: #64748b;">Référentiel de conformité pour l'auditrice en sécurité</span></p>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <span>E-Mobilier — Architecture Logicielle & Spécifications REST API</span>
    <span>Date d'édition : Novembre 2026</span>
  </div>
</div>

<!-- INTRODUCTION & PRINCIPES DIRECTEURS -->
<h1>1. Principes Directeurs d'Architecture & Sécurité</h1>

<p>
  Le présent document formalise les spécifications techniques et fonctionnelles exhaustives du backend de la plateforme <strong>E-Mobilier</strong>. 
  Il répond aux conclusions du compte-rendu de direction entre M. Justin MAGNIDE et M. Jean-Paul GNIKPO, en couvrant à la fois les impératifs de 
  sécurité (ségrégation des pouvoirs, protection de la trésorerie, étanchéité des données clients) et les réalités opérationnelles quotidiennes 
  (conduite des visites, modération du catalogue, traitement des recherches, agrément des agents).
</p>

<div class="callout callout-warning">
  <strong>Règle Fondatrice d'Étanchéité :</strong> Les interfaces visuelles et navigateurs sont considérés comme non fiables par défaut. 
  Aucune règle de sécurité, de masquage de coordonnées ou de limitation financière ne doit dépendre du frontend. Toutes les contraintes 
  sont rigoureusement appliquées et verrouillées côté serveur d'API (routes, contrôleurs, requêtes SQL et sérialiseurs JSON).
</div>

<h3>Les Cinq Piliers d'Architecture Backend :</h3>
<ol>
  <li><strong>Ségrégation Stricte des Fonctions (Segregation of Duties) :</strong> Découpage strict des rôles empêchant toute concentration de pouvoirs. Le volet financier et la trésorerie sont l'apanage exclusif du Propriétaire légal. L'administration technique gère le système sans aucune visibilité sur les finances.</li>
  <li><strong>Cloisonnement Financier Zero-Trust :</strong> Isolation des tables financières, vérification double (rôle + identifiant propriétaire figé), et exécution des retraits (Payouts) exclusivement vers le compte de l'entreprise après authentification renforcée (OTP).</li>
  <li><strong>Dispositif Anti-Contournement Hermétique :</strong> Les profils opérationnels (Secrétaire, Responsables de zone) traitent les dossiers sans jamais voir les téléphones, e-mails ni noms commerciaux des demandeurs, qui sont supprimés de la charge utile JSON à la source.</li>
  <li><strong>Cloisonnement Territorial Automatique (ABAC par Zone) :</strong> Les Responsables de zone sont bornés à leur secteur géographique via une injection de portée globale (Global Scope) au niveau du moteur de requêtes.</li>
  <li><strong>Résilience & Asynchronisme :</strong> Découplage complet des flux critiques (paiement, génération PDF, SMS, WhatsApp) via des files d'attente à priorités avec politique de réessai automatique (Exponential Backoff) et repli multi-canal.</li>
</ol>

<!-- MATRICE RBAC -->
<h1>2. Matrice Complète des Rôles & Permissions (RBAC / ABAC)</h1>

<p>
  Le système structure quatre profils d'administration interne distincts, venant encadrer les rôles publics (<code>Client</code>, <code>Agent mobilier</code>).
</p>

<table>
  <thead>
    <tr>
      <th style="width: 28%;">Domaine Fonctionnel / Action Backend</th>
      <th style="width: 18%;">Super Admin Principal<br><span style="font-weight:normal;">(MAGNIDE Justin)</span></th>
      <th style="width: 18%;">Super Admin Technique<br><span style="font-weight:normal;">(Jean-Paul GNIKPO)</span></th>
      <th style="width: 18%;">Secrétaire<br><span style="font-weight:normal;">(Admin Secondaire)</span></th>
      <th style="width: 18%;">Responsable de Zone<br><span style="font-weight:normal;">(Admin Secondaire)</span></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Catalogue :</strong> Création & édition d'annonces</td>
      <td><span class="badge-role badge-justin">Total</span></td>
      <td><span class="badge-role badge-tech">Total</span></td>
      <td><span class="badge-role badge-secr">Total</span></td>
      <td><span class="badge-role badge-zone">Sa Zone Uniquement</span></td>
    </tr>
    <tr>
      <td><strong>Catalogue :</strong> Modération & mise en ligne (Validation/Rejet)</td>
      <td><span class="badge-role badge-justin">Validation Finale</span></td>
      <td><span class="badge-role badge-tech">Support Tech</span></td>
      <td><span class="badge-role badge-secr">Validation Opérationnelle</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span> (Soumission seule)</td>
    </tr>
    <tr>
      <td><strong>Catalogue :</strong> Titres fonciers & documents légaux</td>
      <td><span class="badge-role badge-justin">Accès Total</span></td>
      <td><span class="badge-role badge-tech">Maintenance Fichiers</span></td>
      <td><span class="badge-role badge-secr">Lecture Streamée (Contrôle)</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span></td>
    </tr>
    <tr>
      <td><strong>Visites :</strong> Consultation des plannings et dossiers</td>
      <td><span class="badge-role badge-justin">Total (Contacts clairs)</span></td>
      <td><span class="badge-role badge-tech">Total (Contacts clairs)</span></td>
      <td><span class="badge-role badge-secr">Total (Contacts masqués)</span></td>
      <td><span class="badge-role badge-zone">Sa Zone (Contacts masqués)</span></td>
    </tr>
    <tr>
      <td><strong>Visites :</strong> Planification, compte-rendu terrain & clôture</td>
      <td><span class="badge-role badge-justin">Arbitrage Final</span></td>
      <td><span class="badge-role badge-tech">Audit Logs</span></td>
      <td><span class="badge-role badge-secr">Affectation / Coordination</span></td>
      <td><span class="badge-role badge-zone">Exécution Terrain & Saisie</span></td>
    </tr>
    <tr>
      <td><strong>Anti-Contournement :</strong> Coordonnées & noms demandeurs</td>
      <td><span class="badge-role badge-justin">En Clair Natif</span></td>
      <td><span class="badge-role badge-tech">En Clair Natif</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Masqué par Défaut</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Masqué par Défaut</span></td>
    </tr>
    <tr>
      <td><strong>Anti-Contournement :</strong> Demande d'accès temporaire (TTL)</td>
      <td><em>Non concerné</em></td>
      <td><em>Non concerné</em></td>
      <td><span class="badge-role badge-secr">Peut Demander</span></td>
      <td><span class="badge-role badge-zone">Peut Demander (Sa Zone)</span></td>
    </tr>
    <tr>
      <td><strong>Anti-Contournement :</strong> Approbation / Révocation de démasquage</td>
      <td><span class="badge-role badge-justin">Approbation / Révocation</span></td>
      <td><span class="badge-role badge-tech">Approbation / Révocation</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span></td>
    </tr>
    <tr>
      <td><strong>Finance :</strong> Soldes, Grand Livre, CA, transactions</td>
      <td><span class="badge-role badge-justin" style="background:#bbf7d0; color:#14532d; border-color:#22c55e;">MONOPOLE EXCLUSIF</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">INTERDIT STRICT (403)</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">INTERDIT STRICT (403)</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">INTERDIT STRICT (403)</span></td>
    </tr>
    <tr>
      <td><strong>Finance :</strong> Retraits (Payouts) vers compte entreprise</td>
      <td><span class="badge-role badge-justin" style="background:#bbf7d0; color:#14532d; border-color:#22c55e;">EXCLUSIF (Validation OTP)</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">INTERDIT STRICT (403)</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">INTERDIT STRICT (403)</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">INTERDIT STRICT (403)</span></td>
    </tr>
    <tr>
      <td><strong>Partenaires :</strong> Agrément KYC des Agents Mobiliers</td>
      <td><span class="badge-role badge-justin">Arbitrage</span></td>
      <td><span class="badge-role badge-tech">Support Système</span></td>
      <td><span class="badge-role badge-secr">Instruction & Vérification</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span></td>
    </tr>
    <tr>
      <td><strong>Système :</strong> Infrastructure, Queues, Health Check, Logs</td>
      <td><span class="badge-role badge-justin">Vue Globale</span></td>
      <td><span class="badge-role badge-tech">Administration Complète</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span></td>
      <td><span style="color:#dc2626; font-weight:bold;">Interdit</span></td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- SECTION 3 : LES 5 PHASES INITIALES DU BACKEND -->
<h1>3. Spécifications Détaillées des 5 Phases Initiales (Fondations, Sécurité & Finance)</h1>

<!-- PHASE 1 -->
<h2>PHASE 1 : Fondations RBAC, Gouvernance des Comptes, Cloisonnement & Conformité Légale</h2>

<p>Cette phase remplace le rôle générique actuel par une structure de gouvernance hermétique, empêche l'auto-élévation de privilèges et pose le cadre juridique obligatoire.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>ABAC + RBAC Hybride :</strong> Attribution d'un rôle d'administration combiné à un identifiant contextuel territorial (<code>zone_id</code>) évalué à chaque requête.</li>
    <li><strong>Root Owner Binding & Anti-Privilege Escalation :</strong> Liaison immuable du compte de MAGNIDE Justin à une variable système non modifiable via l'API. L'API d'administration interdit au Super Admin Technique de s'attribuer le rôle principal ou une permission financière.</li>
    <li><strong>Append-Only Audit Logging :</strong> Table d'audit protégée contre toute modification/suppression SQL, consignant chaque opération sensible avec empreinte de session.</li>
    <li><strong>Log Scrubber / Sanitizer :</strong> Intercepteur dans le canal de logs serveur qui masque automatiquement les clés sensibles (<code>montant</code>, <code>solde</code>, <code>secret_key</code>, <code>otp</code>) pour que la maintenance technique n'expose aucune donnée financière.</li>
    <li><strong>Preuve d'Acceptation Numérique (CGU & Charte) :</strong> Stockage immuable de l'empreinte de la version du document légal signée par l'agent ou le client avec horodatage certifié.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/zones</code></td>
      <td>Tous les Administrateurs</td>
      <td>Retourne le référentiel des zones géographiques actives (communes, départements, secteurs).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/zones</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Crée une nouvelle zone géographique avec code cadastral et découpage administratif.</td>
    </tr>
    <tr>
      <td><span class="badge badge-patch">PATCH</span></td>
      <td><code>/api/admin/zones/{id}</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Modifie les limites géographiques ou active/désactive une zone.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/utilisateurs</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Liste les comptes d'administration avec leurs rôles, statuts et zones de rattachement.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/utilisateurs</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Crée un compte administrateur secondaire ou technique. <strong>Rejet 403 strict</strong> si tentative de créer un compte avec rôle Principal.</td>
    </tr>
    <tr>
      <td><span class="badge badge-patch">PATCH</span></td>
      <td><code>/api/admin/utilisateurs/{id}/role-zone</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Modifie l'affectation de rôle ou de zone. <strong>Rejet 403 + Alerte de sécurité</strong> si le compte cible est celui de MAGNIDE Justin.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/utilisateurs/{id}/statut</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Suspend ou réactive un compte. Révoque instantanément l'intégralité des jetons Sanctum actifs du compte ciblé.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/cgu/courante</code></td>
      <td>Public / Authentifié</td>
      <td>Délivre la dernière version en vigueur des CGU avec identifiant de version et empreinte hash.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/cgu</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Publie une nouvelle mouture des CGU ou de la Charte de Non-Contournement.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/charte/signer</code></td>
      <td>Secrétaire, Responsable de zone</td>
      <td>Consigne la signature numérique de la Charte de Non-Contournement. Conditionne l'accès aux routes d'administration.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/audit-logs</code></td>
      <td>Super Admins (Vue technique purgée pour Tech)</td>
      <td>Consultation du journal d'audit immuable avec filtrage automatique des métadonnées financières pour le Super Admin Tech.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/tech/system-health</code></td>
      <td>Super Admin Tech, Super Admin Principal</td>
      <td>Rapport d'état sur l'infrastructure (charge CPU, connectivité BDD, latence cache, files d'attente). Zéro donnée financière.</td>
    </tr>
  </tbody>
</table>

<!-- PHASE 2 -->
<h2>PHASE 2 : Dispositif Anti-Contournement, Masquage Dynamique & Workflow de Démasquage</h2>

<p>Cette phase garantit que les coordonnées clients ne quittent jamais le serveur pour les administrateurs secondaires, tout en fournissant une procédure d'exception bornée dans le temps.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Sérialisation Conditionnelle (Context-Aware API Resources) :</strong> Remplacement systématique à la sérialisation des téléphones, e-mails et raisons sociales par <code>"MASQUÉ"</code> pour la Secrétaire et les Responsables de zone.</li>
    <li><strong>Global Query Scope (Filtrage Territorial) :</strong> Injection systématique de la contrainte <code>WHERE zone_id = user.zone_id</code> pour le Responsable de zone sur toutes les requêtes de biens, demandes et visites.</li>
    <li><strong>Protection Anti-IDOR (Insecure Direct Object Reference) :</strong> Blocage déterministe de toute consultation d'un dossier dont la zone ne correspond pas à l'agent connecté.</li>
    <li><strong>Time-Bound Access Grant (TTL) :</strong> Autorisation temporaire d'accès à durée de vie paramétrable (ex. 120 minutes) devenant caduque au millième de seconde sans nécessiter de cron de nettoyage.</li>
    <li><strong>Read-Access Auditing & Anti-Scraping Throttling :</strong> Journalisation de chaque lecture de coordonnée en clair et limitation stricte du nombre de requêtes par minute.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/demandes-clients</code></td>
      <td>Super Admins (Clair), Secrétaire (Masqué), Resp. Zone (Zone + Masqué)</td>
      <td>Liste paginée des demandes de recherche. Les numéros de téléphone et e-mails sont purgés du flux JSON pour les profils secondaires.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/demandes-clients/{id}</code></td>
      <td>Super Admins (Clair), Secrétaire (Masqué), Resp. Zone (Zone + Masqué)</td>
      <td>Fiche détaillée de la demande client. Masquage automatique des coordonnées du demandeur et statut de paiement sans montant.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/visites</code></td>
      <td>Super Admins (Clair), Secrétaire (Masqué), Resp. Zone (Zone + Masqué)</td>
      <td>Liste des visites de parcelles/biens. Filtrage automatique par zone pour le Responsable de zone et occultation des coordonnées client.</td>
    </tr>
    <tr>
      <td><span class="badge badge-patch">PATCH</span></td>
      <td><code>/api/admin/visites/{id}/statut</code></td>
      <td>Tous les Admins (Resp. Zone limité à sa zone)</td>
      <td>Mise à jour opérationnelle du statut de la visite (<code>Programmée</code>, <code>Effectuée</code>, <code>Reportée</code>, <code>Clôturée</code>).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/visites/{id}/assigner-zone</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Assigne une visite à un Responsable de zone spécifique selon le secteur géographique du bien.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demasquages/demander</code></td>
      <td>Secrétaire, Responsable de zone</td>
      <td>Initie une demande formelle de démasquage en spécifiant le dossier cible, le motif prédéfini et une justification circonstanciée.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/demasquages/mes-demandes</code></td>
      <td>Secrétaire, Responsable de zone</td>
      <td>Consulte l'historique et l'état d'instruction de ses propres requêtes de démasquage.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/demasquages/en-attente</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>File d'attente d'arbitrage des demandes de démasquage soumises par les équipes secondaires.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demasquages/{id}/approuver</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Approuve la demande en fixant la durée de validité en minutes (calcul du timestamp <code>expires_at</code>).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demasquages/{id}/refuser</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Rejette la demande d'accès avec motif d'opposition consigné dans l'audit.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demasquages/{id}/revoquer</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Révoque immédiatement une autorisation en cours avant son terme naturel.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/dossiers/{type}/{id}/coordonnees</code></td>
      <td>Secrétaire & Resp. Zone (avec TTL valide), Super Admins</td>
      <td><strong>Point critique :</strong> Vérifie la validité temporelle de l'approbation (<code>now < expires_at</code>), journalise l'accès et délivre les coordonnées pour ce dossier unitaire.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- PHASE 3 -->
<h2>PHASE 3 : Isolation Financière Zero-Trust, Intégration KKiaPay/FedaPay & Coffre-Fort des Retraits</h2>

<p>Cette phase sanctuarise le volet financier sous l'autorité exclusive de MAGNIDE Justin, fiabilise les encaissements via webhooks réconciliés et sécurise les décaissements par validation OTP.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Financial Vault Middleware (Subject Pinning) :</strong> Intercepteur rejetant avec code 403 toute requête financière n'émanant pas de l'identifiant strict de MAGNIDE Justin.</li>
    <li><strong>Server-Side Price Authority :</strong> Le client ne transmet aucun montant ; le backend détermine le prix officiel depuis la BDD (50 FCFA déblocage, 500 FCFA visite, loyer hébergement).</li>
    <li><strong>HMAC Signature Verification & Idempotence :</strong> Validation de la signature cryptographique du webhook et verrouillage pessimiste SQL (<code>SELECT ... FOR UPDATE</code>) pour bloquer les doublons.</li>
    <li><strong>Réconciliation Active Serveur-à-Serveur :</strong> Interrogation systématique de l'API de l'agrégateur pour valider le statut <code>SUCCESS</code>, la devise <code>XOF</code> et le montant exact au centime près.</li>
    <li><strong>Grand Livre en Partie Double (Immutable Ledger) :</strong> Le solde résulte de la somme arithmétique d'écritures immuables de crédit (encaissements nets) et de débit (retraits validés).</li>
    <li><strong>Payout avec Liste Blanche & Dynamic Linking OTP :</strong> Destination de virement figée côté serveur (compte entreprise Justin). Code OTP à 6 chiffres lié cryptographiquement au montant, valable 3 minutes.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/paiements/initier</code></td>
      <td>Client, Agent mobilier</td>
      <td>Génère une intention de paiement (contrôle l'acceptation des CGU, fixe le tarif officiel côté serveur et crée la référence interne).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/kkiapay/webhook</code></td>
      <td>Public (Signé HMAC Agrégateur)</td>
      <td>Vérifie la signature HMAC, applique le verrou d'idempotence, réconcilie avec l'API KKiaPay et met à jour le dossier et le Grand Livre.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/kkiapay/verify</code></td>
      <td>Client, Agent mobilier</td>
      <td>Déclenche la réconciliation serveur-à-serveur idempotente suite au retour du widget de paiement côté client.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/paiements/{ref}/recu</code></td>
      <td>Client Propriétaire, Justin MAGNIDE</td>
      <td>Génère et délivre le reçu officiel au format PDF avec signature d'intégrité.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/finance/tableau-de-bord</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Solde disponible, solde en compensation, chiffre d'affaires cumulé et ventilation. <strong>Rejet 403 + Alerte</strong> pour tout autre profil.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/finance/transactions</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Grand Livre comptable complet des flux monétaires (montants bruts, commissions prélevées, montants nets crédités).</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/finance/transactions/export</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Export certifié des écritures comptables sous formats CSV et PDF.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/finance/webhooks</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Journal exhaustif des webhooks financiers reçus avec charges utiles intégrales et diagnostics de réconciliation.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/finance/retraits</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Historique des ordres de virement vers le compte d'entreprise et état de compensation.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/finance/retraits/initier</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Vérifie le solde disponible, crée un ordre de virement vers le compte en liste blanche (état <code>EN_ATTENTE_OTP</code>) et expédie l'OTP.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/finance/retraits/{id}/confirmer-otp</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Contrôle l'OTP, exécute l'ordre de décaissement auprès de l'agrégateur et passe le virement en statut <code>EXÉCUTÉ</code>.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/finance/retraits/{id}/annuler</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Annule une demande de retrait non encore validée par OTP et libère la réserve de solde.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/tech/webhooks/health</code></td>
      <td>Super Admin Tech, Super Admin Principal</td>
      <td>Moniteur technique des webhooks : horodatage, code statut HTTP, validité signature, latence réseau. <strong>Zéro montant, zéro solde.</strong></td>
    </tr>
  </tbody>
</table>

<!-- PHASE 4 -->
<h2>PHASE 4 : Moteur de Notifications Multi-Canal Asynchrone & Résilience</h2>

<p>Cette phase assure la distribution temps réel des confirmations de paiement et des alertes de retrait sur WhatsApp, SMS, E-mail et Push, avec un filtrage étanche des contenus selon les profils.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Domain Events & AfterCommit Dispatching :</strong> Émission des événements de notification uniquement après validation définitive (commit SQL) de la transaction financière.</li>
    <li><strong>Architecture à Trois Paliers de Files d'Attente :</strong>
      <ul>
        <li><code>critique-securite</code> (Priorité 1) : Codes OTP et alertes financières de Justin (latence cible &lt; 3s).</li>
        <li><code>notifications-paiement</code> (Priorité 2) : Confirmations WhatsApp/SMS clients et alertes administrateurs.</li>
        <li><code>documents-emails</code> (Priorité 3) : Reçus PDF comptables et courriels récapitulatifs.</li>
      </ul>
    </li>
    <li><strong>Modèles de Messages Cloisonnés :</strong>
      <ul>
        <li><em>Justin MAGNIDE :</em> Montant net, solde disponible, référence et coordonnées client complètes.</li>
        <li><em>Client :</em> Code de réservation, montant acquitté et reçu téléchargeable.</li>
        <li><em>Admins Secondaires :</em> Changement d'état opérationnel (<code>Payé / Validé</code>) <strong>sans montant ni coordonnées client</strong>.</li>
      </ul>
    </li>
    <li><strong>Exponential Backoff & Repli WhatsApp → SMS :</strong> Reprise échelonnée sur incident (0s, 15s, 60s, 5m, 15m) et bascule automatique sur SMS transactionnel dès le 2ᵉ échec WhatsApp.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/user/device-token</code></td>
      <td>Tous les Utilisateurs Authentifiés</td>
      <td>Enregistre ou actualise le jeton Push (Web/Mobile) rattaché au rôle et à la zone de l'utilisateur.</td>
    </tr>
    <tr>
      <td><span class="badge badge-delete">DELETE</span></td>
      <td><code>/api/user/device-token</code></td>
      <td>Tous les Utilisateurs Authentifiés</td>
      <td>Supprime le jeton de notification Push lors de la déconnexion de l'appareil.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/notifications</code></td>
      <td>Tous les Utilisateurs Authentifiés</td>
      <td>Retourne le fil interne des alertes (filtré hermétiquement : montants inclus pour Justin, statuts seuls pour les secondaires).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/notifications/{id}/lire</code></td>
      <td>Tous les Utilisateurs Authentifiés</td>
      <td>Marque une notification interne comme lue.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/finance/notifications/audit</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Journal exhaustif des notifications financières expédiées (WhatsApp, SMS, Email, Push) avec statuts de réception et montants.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/tech/notifications/logs</code></td>
      <td>Super Admin Tech, Super Admin Principal</td>
      <td>Journal technique des canaux d'envoi (taux de succès, délais de livraison, erreurs réseau). Contenu financier purgé.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/tech/notifications/{id}/relancer</code></td>
      <td>Super Admin Tech, Super Admin Principal</td>
      <td>Réinjecte dans la file d'attente une notification en échec définitif (Dead Letter Queue) sans exposer son contenu monétaire.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- PHASE 5 -->
<h2>PHASE 5 : Durcissement Backend, Scellement Cryptographique & Préparation à l'Audit</h2>

<p>Cette phase verrouille l'intégrité de la base de données contre les altérations manuelles directes et met à disposition des coupe-circuits d'urgence.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Application-Layer Intrusion Detection (Tripwire) :</strong> Toute requête non autorisée vers les endpoints <code>/api/finance/*</code> ou tentative de modification du compte de Justin déclenche instantanément une alerte critique prioritaire via WhatsApp.</li>
    <li><strong>Scellement Cryptographique du Grand Livre (HMAC Hash Chaining) :</strong> Chaque écriture financière intègre une signature calculée à partir de ses données, de la signature précédente et d'une clé secrète dédiée. Toute modification directe en base rompt la chaîne et bloque les retraits.</li>
    <li><strong>Coupe-Circuit Applicatif (Kill-Switch) :</strong> Drapeau atomique permettant à MAGNIDE Justin de suspendre instantanément tout décaissement ou de révoquer l'ensemble des démasquages en cours en un clic.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/finance/securite/verifier-integrite</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Parcourt l'ensemble de la chaîne cryptographique du Grand Livre et certifie l'absence de falsification en base de données.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/finance/securite/geler-retraits</code></td>
      <td><strong>MAGNIDE Justin UNIQUEMENT</strong></td>
      <td>Coupe-circuit immédiat suspendant tous les ordres de décaissement (Kill-Switch).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/securite/revoquer-tous-demasquages</code></td>
      <td>Super Admin Principal, Super Admin Tech</td>
      <td>Révocation d'urgence immédiate de toutes les autorisations de démasquage actives sur l'ensemble des administrateurs secondaires.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/securite/alertes</code></td>
      <td>Justin (Intégral), Tech (Hors son compte)</td>
      <td>Consulte le journal des alertes d'intrusion (violations RBAC, tentatives d'escalade, abus de quotas anti-scraping).</td>
    </tr>
  </tbody>
</table>

<!-- CAHIER DES CHARGES AUDITRICE -->
<h3>Cahier des Charges pour l'Étudiante Spécialisée en Sécurité (Surface d'Attaque Backend)</h3>

<table>
  <thead>
    <tr>
      <th style="width: 12%;">Code Test</th>
      <th style="width: 28%;">Surface d'Attaque Ciblée</th>
      <th style="width: 35%;">Scénario de Test à Exécuter par l'Auditrice</th>
      <th style="width: 25%;">Résultat Attendu (Critère de Succès)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>SEC-01</strong></td>
      <td>Étanchéité Financière vs Admin Tech</td>
      <td>Tenter d'appeler les routes <code>/api/finance/*</code> avec le token du Super Admin Technique.</td>
      <td>Rejet 403 systématique + Notification d'alerte immédiate sur le WhatsApp de Justin.</td>
    </tr>
    <tr>
      <td><strong>SEC-02</strong></td>
      <td>Escalade de Privilèges</td>
      <td>Depuis le compte Admin Tech, tenter d'injecter le rôle Principal ou de modifier le compte de Justin.</td>
      <td>Blocage applicatif au niveau contrôleur et middleware, journalisation dans l'audit de sécurité.</td>
    </tr>
    <tr>
      <td><strong>SEC-03</strong></td>
      <td>Exposition de Données (JSON Leaks)</td>
      <td>Inspecter le payload brut des réponses de listes et détails avec un profil Secrétaire ou Responsable de zone.</td>
      <td>Absence totale des téléphones réels, e-mails et raisons sociales dans la charge utile JSON.</td>
    </tr>
    <tr>
      <td><strong>SEC-04</strong></td>
      <td>Contournement Territorial (IDOR)</td>
      <td>Avec le token du Resp. Zone A, requêter directement l'identifiant d'un bien ou d'une visite de la Zone B.</td>
      <td>Rejet immédiat (403 ou 404), aucune fuite d'information sur l'existence de la ressource.</td>
    </tr>
    <tr>
      <td><strong>SEC-05</strong></td>
      <td>Expiration TTL Démasquage</td>
      <td>Interroger l'endpoint des coordonnées 1 seconde après la fin de la période d'approbation (<code>expires_at</code>).</td>
      <td>Rejet 403 immédiat sans action administrative manuelle préalable.</td>
    </tr>
    <tr>
      <td><strong>SEC-06</strong></td>
      <td>Falsification de Webhooks</td>
      <td>Envoyer de faux payloads POST sur le webhook KKiaPay (mauvaise signature HMAC, rejeu ou montant altéré).</td>
      <td>Rejet des signatures erronées, blocage des doublons (idempotence) et échec de la réconciliation.</td>
    </tr>
    <tr>
      <td><strong>SEC-07</strong></td>
      <td>Sécurité Retraits & Brute-Force OTP</td>
      <td>Tenter d'injecter un compte tiers ou de brute-forcer le code OTP à 6 chiffres.</td>
      <td>Ignorance des coordonnées tierces (liste blanche active) et verrouillage strict après 3 tentatives.</td>
    </tr>
    <tr>
      <td><strong>SEC-08</strong></td>
      <td>Fuite de Données dans les Logs</td>
      <td>Déclencher des erreurs de paiement et vérifier les logs consultables par le Super Admin Technique.</td>
      <td>Confirmation que montants, soldes et tokens sensibles sont caviardés en <code>[CONFIDENTIEL_FINANCE]</code>.</td>
    </tr>
    <tr>
      <td><strong>SEC-09</strong></td>
      <td>Validité Légale (CGU)</td>
      <td>Tenter d'initier un paiement ou une visite sans le paramètre formel d'acceptation des CGU.</td>
      <td>Rejet 422 de validation de formulaire avant toute communication avec l'agrégateur.</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- SECTION 4 : LES 5 BRIQUES OPÉRATIONNELLES COMPLÉMENTAIRES -->
<h1>4. Spécifications des 5 Briques Opérationnelles Complémentaires (Cœur Métier Quotidien)</h1>

<p>
  Les cinq briques suivantes complètent les fondations de sécurité en outillant la <strong>Secrétaire</strong>, les <strong>Responsables de zone</strong> 
  et <strong>Justin MAGNIDE</strong> pour le traitement opérationnel complet du cycle de vie immobilier.
</p>

<!-- BRIQUE A -->
<h2>BRIQUE A : Modération du Catalogue & Audit des Titres Fonciers</h2>

<p>Cette brique gère le workflow de contrôle qualité et légal des annonces soumises par les agents partenaires ou propriétaires avant diffusion publique.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Machine à États des Annonces :</strong> Cycle de vie strict du modèle <code>Proprietes</code> : <code>pending_payment</code> → <code>pending</code> (soumis) → <code>published</code> (validé) ou <code>rejected</code> (rejeté avec motif) → <code>sold_rented</code> (conclu) → <code>archived</code>.</li>
    <li><strong>Protection des Pièces Juridiques Foncières (Proprietes_document) :</strong> Les titres fonciers et attestations de recasement ne sont jamais stockés dans un répertoire public. Ils sont consultables uniquement via des flux streamés sécurisés réservés aux Super Admins et à la Secrétaire.</li>
    <li><strong>Retrait Atomique du Catalogue Public :</strong> Dès le passage à <code>sold_rented</code>, l'annonce est instantanément exclue du fil public (<code>filActualite</code>) tout en préservant l'intégrité de l'historique comptable et opérationnel.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/proprietes/en-attente</code></td>
      <td>Super Admins, Secrétaire, Resp. Zone (Zone)</td>
      <td>Liste les biens soumis en attente de modération (avec filtrage automatique par zone pour le Responsable de zone).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/proprietes/{id}/valider</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Approuve la publication de l'annonce, bascule son état à <code>published</code> et notifie l'agent dépositaire.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/proprietes/{id}/rejeter</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Rejette l'annonce avec motif obligatoire consigné en base et envoyé par notification à l'agent créateur.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/proprietes/{id}/marquer-conclu</code></td>
      <td>Super Admins, Secrétaire, Resp. Zone (Zone)</td>
      <td>Déclare le bien vendu ou loué (<code>sold_rented</code>) et le retire du fil d'actualité public.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/proprietes/{id}/documents</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Génère des URLs de consultation temporaires sécurisées pour examiner les titres fonciers sans permettre le téléchargement libre non tracé.</td>
    </tr>
  </tbody>
</table>

<!-- BRIQUE B -->
<h2>BRIQUE B : Cycle Opérationnel des Visites Terrain & Comptes-Rendus (Post-Paiement 500 FCFA)</h2>

<p>Cette brique organise le relais entre la validation financière d'une visite par KKiaPay et sa prise en charge concrète par les agents de terrain.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Routage Territorial Automatique :</strong> Dès confirmation du paiement de 500 FCFA, la visite est pré-affectée à la zone géographique du bien concerné.</li>
    <li><strong>Cycle de Clôture Opérationnelle :</strong> La visite traverse les états : <code>PAYÉE_À_PLANIFIER</code> → <code>PLANIFIÉE</code> → <code>EFFECTUÉE</code> → <code>CLÔTURÉE</code> (avec verdict : <em>Intérêt d'achat confirmé</em>, <em>Contre-proposition</em>, <em>Sans suite</em>, <em>Client absent</em>).</li>
    <li><strong>Escalade Commerciale Majeure :</strong> En cas d'intention d'achat formelle constatée sur le terrain, le dossier est escaladé avec alerte prioritaire directe vers MAGNIDE Justin pour engagement des négociations contractuelles.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/visites/{id}/planifier</code></td>
      <td>Secrétaire, Resp. Zone (Zone)</td>
      <td>Enregistre la date, l'heure et les consignes d'itinéraire de la visite physique, et expédie la convocation au client.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/visites/{id}/compte-rendu</code></td>
      <td>Resp. Zone (Zone), Secrétaire, Super Admins</td>
      <td>Saisit le rapport circonstancié de la visite terrain (remarques du client, points bloquants, validation de l'état du bien).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/visites/{id}/cloturer</code></td>
      <td>Resp. Zone (Zone), Secrétaire, Super Admins</td>
      <td>Clôture le dossier de visite avec motif d'issue normé (<code>Succès / Offre en cours</code>, <code>Sans suite</code>, <code>Client absent</code>).</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/visites/{id}/escalader-offre</code></td>
      <td>Resp. Zone (Zone), Secrétaire</td>
      <td>Bascule le dossier en <code>NÉGOCIATION_HAUTE</code> et notifie immédiatement Justin MAGNIDE pour suivi commercial direct.</td>
    </tr>
  </tbody>
</table>

<!-- BRIQUE C -->
<h2>BRIQUE C : Gestion des Demandes de Recherche & Moteur de Rapprochement (Matching)</h2>

<p>Cette brique outille les équipes opérationnelles pour convertir les demandes personnalisées des clients en transactions concrètes.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Prise en Charge Nominale :</strong> Attribution formelle d'une demande de recherche à un gestionnaire afin d'éviter les doubles traitements ou les abandons de dossiers.</li>
    <li><strong>Moteur de Rapprochement Automatique (Matching Engine) :</strong> Requête SQL multicritères croisant les paramètres de la demande (type de bien, surface min/max, budget plafond, commune, quartier) avec les biens disponibles dans le catalogue.</li>
    <li><strong>Soumission de Proposition Sécurisée :</strong> Possibilité de rattacher un ou plusieurs biens à la demande du client pour déclencher l'envoi d'une fiche de proposition par notification, sans divulgation des contacts du propriétaire.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demandes-clients/{id}/prendre-en-charge</code></td>
      <td>Secrétaire, Resp. Zone (Zone)</td>
      <td>Assigne la demande à l'administrateur connecté et fait évoluer son statut à <code>en_traitement</code>.</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/demandes-clients/{id}/matching-biens</code></td>
      <td>Secrétaire, Resp. Zone (Zone), Super Admins</td>
      <td>Exécute le matching multicritères entre la demande et les annonces actives du catalogue et calcule un indice de pertinence.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demandes-clients/{id}/associer-bien</code></td>
      <td>Secrétaire, Resp. Zone (Zone)</td>
      <td>Relie un bien du catalogue au dossier client et expédie une notification de suggestion au demandeur.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/demandes-clients/{id}/cloturer</code></td>
      <td>Secrétaire, Resp. Zone (Zone), Super Admins</td>
      <td>Clôture la recherche (<code>satisfaite</code>, <code>abandonnee_client</code>, <code>delai_depasse</code>).</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<!-- BRIQUE D -->
<h2>BRIQUE D : Agrément, Contrôle & KYC des Agents Mobiliers</h2>

<p>Cette brique régule les partenaires externes de la plateforme en soumettant leurs privilèges de publication à un agrément formel préalable.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Statut d'Agrément Professionnel :</strong> Le champ <code>is_verifed</code> du modèle <code>User</code> conditionne le droit de visibilité publique des annonces déposées.</li>
    <li><strong>Dossier de Conformité KYC :</strong> Dépôt et contrôle des pièces administratives de l'agent (Registre de Commerce IFU, pièce d'identité certifiée, mandat d'exercice).</li>
    <li><strong>Révocation & Gel en Cascade :</strong> La suspension d'un compte agent indélicat entraîne automatiquement le déréférencement atomique de toutes ses annonces en ligne pour protéger la réputation d'E-Mobilier.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/agents-mobiliers</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Liste l'annuaire des agents mobiliers partenaires avec filtres par statut de vérification KYC (<code>en_attente</code>, <code>verifie</code>, <code>suspendu</code>).</td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/agents-mobiliers/{id}/dossier</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Consulte le dossier d'agrément (pièces d'identité, justificatifs d'activité) et l'historique de publication de l'agent.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/agents-mobiliers/{id}/approuver</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Valide l'agrément de l'agent (<code>is_verifed = true</code>), ouvrant le droit de diffusion de ses annonces validées.</td>
    </tr>
    <tr>
      <td><span class="badge badge-post">POST</span></td>
      <td><code>/api/admin/agents-mobiliers/{id}/suspendre</code></td>
      <td>Super Admins, Secrétaire</td>
      <td>Révoque l'agrément de l'agent et bascule immédiatement toutes ses annonces actives à l'état <code>suspendues</code>.</td>
    </tr>
  </tbody>
</table>

<!-- BRIQUE E -->
<h2>BRIQUE E : Tableaux de Bord de Performance Opérationnelle (Non-Financiers)</h2>

<p>Cette brique dote les équipes de bordereaux d'activité et d'indicateurs de performance clés (KPIs) opérationnels sans enfreindre le cloisonnement financier.</p>

<div class="box-notions">
  <h4>Notions Indispensables d'Implémentation Backend :</h4>
  <ul>
    <li><strong>Ségrégation Stricte des Métriques :</strong> Les requêtes agrégées de cette brique calculent des volumes, des ratios et des délais temporels en excluant rigoureusement tout champ monétaire (chiffre d'affaires, montants de commissions).</li>
    <li><strong>Agrégations Pré-calculées en Cache :</strong> Calcul périodique des statistiques d'activité par zone géographique pour garantir des temps de réponse instantanés sur les tableaux de bord.</li>
  </ul>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 10%;">Méthode</th>
      <th style="width: 32%;">Endpoint REST URI</th>
      <th style="width: 25%;">Rôles Autorisés</th>
      <th style="width: 33%;">Comportement Backend & Règles de Sécurité</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/metriques/operations-globales</code></td>
      <td>Super Admin Principal, Secrétaire</td>
      <td>Synthèse opérationnelle : volume de visites du mois, délai moyen de prise en charge, taux de transformation des recherches. <strong>Zéro FCFA.</strong></td>
    </tr>
    <tr>
      <td><span class="badge badge-get">GET</span></td>
      <td><code>/api/admin/metriques/zone-performance</code></td>
      <td>Resp. Zone (sa zone), Secrétaire, Super Admins</td>
      <td>Métriques sectorielles : taux de complétion des visites terrain, volume d'annonces actives versus vendues sur le secteur.</td>
    </tr>
  </tbody>
</table>

<!-- SECTION 5 : FEUILLE DE ROUTE D'IMPLÉMENTATION -->
<h1>5. Feuille de Route Consolidée & Séquencement de Développement</h1>

<p>
  Le tableau ci-dessous structure l'ensemble des 10 chantiers (5 Phases Fondations + 5 Briques Métier) par ordre de dépendance technique, 
  avec l'estimation des livrables et des jalons de validation.
</p>

<table>
  <thead>
    <tr>
      <th style="width: 8%;">Jalon</th>
      <th style="width: 32%;">Chantier & Intitulé</th>
      <th style="width: 35%;">Livrables Clés & Travaux Backend</th>
      <th style="width: 25%;">Critère d'Acceptation & Recette</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Semaine 1</strong></td>
      <td><strong>Phase 1 :</strong> RBAC, Gouvernance, Sanctuarisation & CGU</td>
      <td>Refonte 4 rôles, modèle de zones, protection compte Justin, Log Scrubber, signature Charte.</td>
      <td>L'Admin Tech ne peut altérer le compte de Justin ; les logs techniques sont purgés.</td>
    </tr>
    <tr>
      <td><strong>Semaine 2</strong></td>
      <td><strong>Phase 2 :</strong> Anti-Contournement & Démasquage TTL</td>
      <td>Sérialiseurs avec masquage dynamique, scopes par zone, moteur de démasquage temporaire (TTL).</td>
      <td>Le flux JSON ne contient aucun contact client pour les secondaires ; expiration stricte du TTL.</td>
    </tr>
    <tr>
      <td><strong>Semaine 3</strong></td>
      <td><strong>Phase 3 :</strong> Isolation Financière & KKiaPay</td>
      <td>Financial Vault Middleware, webhook idempotent réconcilié, Grand Livre, module de Payout OTP.</td>
      <td>Justin est le seul à accéder aux routes financières ; retrait impossible sans OTP valide.</td>
    </tr>
    <tr>
      <td><strong>Semaine 4</strong></td>
      <td><strong>Phase 4 :</strong> Notifications Multi-Canal Asynchrones</td>
      <td>3 files d'attente de priorités, connecteurs WhatsApp/SMS/Email/Push, repli automatique, audit trail.</td>
      <td>Messages différenciés par profil ; bascule immédiate sur SMS si l'API WhatsApp échoue.</td>
    </tr>
    <tr>
      <td><strong>Semaine 5</strong></td>
      <td><strong>Briques A & B :</strong> Modération Biens & Visites Terrain</td>
      <td>Machine à états du catalogue, sécurité des titres fonciers, planning et rapports post-visite terrain.</td>
      <td>Toute visite payée est traçable jusqu'au compte-rendu terrain ; documents fonciers protégés.</td>
    </tr>
    <tr>
      <td><strong>Semaine 6</strong></td>
      <td><strong>Briques C, D & E :</strong> Matching, KYC Agents & KPIs</td>
      <td>Moteur de croisement des recherches, agrément KYC des agents partenaires, tableaux de bord de vélocité.</td>
      <td>Suspension atomique des annonces en cas d'agent révoqué ; KPIs opérationnels sans fuite financière.</td>
    </tr>
    <tr>
      <td><strong>Semaine 7</strong></td>
      <td><strong>Phase 5 :</strong> Durcissement & Audit de Sécurité</td>
      <td>Intégrité Grand Livre (HMAC Hash Chaining), Tripwire IDS, Kill-Switch, campagne de Pentest de l'auditrice.</td>
      <td>Validation formelle des 9 scénarios de test d'intrusion (SEC-01 à SEC-09) avec 100% de conformité.</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-success" style="margin-top: 20px;">
  <strong>Conclusion Architecturale :</strong> Ce document d'ingénierie clôture de manière définitive et exhaustive l'ensemble des besoins fonctionnels, 
  légaux, de sécurité et d'exploitation métier pour tous les acteurs internes de la plateforme <strong>E-Mobilier</strong>. 
  La base de code backend est désormais prête à être alignée point par point selon cette cartographie.
</div>

</body>
</html>
"""

temp_html = "/opt/lampp/htdocs/E-Mobilier/SPECIFICATIONS_BACKEND_TEMP.html"
output_pdf = "/opt/lampp/htdocs/E-Mobilier/SPECIFICATIONS_BACKEND_E_MOBILIER.pdf"

with open(temp_html, "w", encoding="utf-8") as f:
    f.write(html_content)

print("HTML file written successfully.")

cmd = [
    "google-chrome",
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={output_pdf}",
    temp_html
]

res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
print("Return code:", res.returncode)
print("Stdout:", res.stdout)
print("Stderr:", res.stderr)

if os.path.exists(output_pdf):
    print("PDF successfully generated. File size:", os.path.getsize(output_pdf), "bytes.")
else:
    print("Error: PDF not found.")

