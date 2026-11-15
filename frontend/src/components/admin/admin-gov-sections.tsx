import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { adminApi, cguApi } from '@/services/api';
import type {
  AdminUserItem,
  AgentKycItem,
  AuditLogItem,
  DemandeDemasquageItem,
  SystemHealthReport,
  TechNotificationLogItem,
  WebhookHealthReport,
  ZoneSummary,
} from '@/types/api';

export function DemasquagesSection() {
  const theme = useTheme();
  const { isSuperAdmin } = useAuth();
  const [queue, setQueue] = useState<DemandeDemasquageItem[]>([]);
  const [mine, setMine] = useState<DemandeDemasquageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refusMotif, setRefusMotif] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    if (isSuperAdmin) {
      const qRes = await adminApi.enAttenteDemasquage();
      if (qRes.success && qRes.data) setQueue((qRes.data as any).data || []);
    } else {
      const mRes = await adminApi.mesDemandesDemasquage();
      if (mRes.success && mRes.data) setMine((mRes.data as any).data || []);
    }
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.sectionWrap}>
      {isSuperAdmin && (
        <Pressable
          onPress={async () => {
            const res = await adminApi.revoquerTousDemasquages("Révocation d'urgence mobile");
            Alert.alert(res.success ? 'Révoqués' : 'Erreur', res.message || '');
          }}
          style={[styles.dangerBtn]}>
          <Text style={styles.dangerBtnText}>Coupe-circuit : Révoquer TOUS les démasquages actifs</Text>
        </Pressable>
      )}

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
      ) : isSuperAdmin ? (
        queue.length === 0 ? (
          <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 16 }}>
            Aucune demande de démasquage en attente.
          </Text>
        ) : (
          queue.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Demande #{item.id} ({item.type_dossier} #{item.dossier_id})
              </Text>
              <Text style={[styles.line, { color: theme.text }]}>
                Par : {item.user?.name} ({item.user?.email})
              </Text>
              <Text style={[styles.line, { color: theme.textSecondary }]}>Motif : {item.motif}</Text>
              <Text style={[styles.line, { color: theme.textSecondary }]}>{item.justification}</Text>

              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                placeholder="Motif si refus..."
                value={refusMotif}
                onChangeText={setRefusMotif}
              />

              <View style={styles.row}>
                <Pressable
                  onPress={async () => {
                    const res = await adminApi.approuverDemasquage(item.id, 120);
                    Alert.alert(res.success ? 'Approuvé (120m)' : 'Erreur', res.message || '');
                    await load();
                  }}
                  style={[styles.actBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.actBtnText}>Approuver (2h)</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    const res = await adminApi.refuserDemasquage(item.id, refusMotif || 'Justification insuffisante');
                    Alert.alert(res.success ? 'Refusé' : 'Erreur', res.message || '');
                    await load();
                  }}
                  style={[styles.actBtn, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.actBtnText}>Refuser</Text>
                </Pressable>
              </View>
            </View>
          ))
        )
      ) : (
        mine.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {item.type_dossier} #{item.dossier_id} • {item.statut.toUpperCase()}
            </Text>
            <Text style={[styles.line, { color: theme.textSecondary }]}>{item.motif}</Text>
            {item.is_currently_active && (
              <Text style={{ color: theme.primaryDark, fontWeight: '800', fontSize: 12 }}>
                Actif — {item.temps_restant_minutes} min restantes
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );
}

export function AgentsKycSection() {
  const theme = useTheme();
  const [agents, setAgents] = useState<AgentKycItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getAgents();
    if (res.success && Array.isArray(res.data)) {
      setAgents(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />;

  return (
    <View style={styles.sectionWrap}>
      {agents.map((ag) => (
        <View key={ag.id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {ag.prenom} {ag.name}
          </Text>
          <Text style={[styles.line, { color: theme.textSecondary }]}>
            {ag.email} • {ag.telephone}
          </Text>
          <Text style={[styles.line, { color: ag.is_verifed ? theme.primaryDark : '#B45309', fontWeight: '700' }]}>
            KYC : {ag.is_verifed ? 'Agrément validé' : 'En attente'} • Statut : {ag.statut}
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={async () => {
                const d = await adminApi.getAgentDossier(ag.id);
                if (d.success && (d as any).statistiques_activite) {
                  const st = (d as any).statistiques_activite;
                  Alert.alert('Dossier Agent', `Annonces: ${st.total_annonces}\nEn ligne: ${st.annonces_en_ligne}\nConclues: ${st.annonces_conclues}`);
                }
              }}
              style={[styles.actBtn, { backgroundColor: theme.navy }]}>
              <Text style={styles.actBtnText}>Dossier</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                const res = await adminApi.approuverAgent(ag.id);
                Alert.alert(res.success ? 'Approuvé' : 'Erreur', res.message || '');
                await load();
              }}
              style={[styles.actBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.actBtnText}>Approuver</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                const res = await adminApi.suspendreAgent(ag.id);
                Alert.alert(res.success ? 'Suspendu' : 'Erreur', res.message || '');
                await load();
              }}
              style={[styles.actBtn, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.actBtnText}>Suspendre</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

export function GovernanceSection() {
  const theme = useTheme();
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [zoneNom, setZoneNom] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneCommune, setZoneCommune] = useState('');
  const [zoneDept, setZoneDept] = useState('Littoral');

  const [cguVersion, setCguVersion] = useState('2.1');
  const [cguTitre, setCguTitre] = useState('Conditions Générales E-Mobilier');
  const [cguContenu, setCguContenu] = useState('');
  const [docType, setDocType] = useState<'cgu' | 'charte_non_contournement'>('cgu');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newPrenom, setNewPrenom] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'Super Admin Technique' | 'Secrétaire' | 'Responsable de zone'>('Secrétaire');
  const [newZoneId, setNewZoneId] = useState<number | null>(null);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<string>('Secrétaire');
  const [editZoneId, setEditZoneId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [zRes, uRes, aRes] = await Promise.all([
      adminApi.getZones(),
      adminApi.getUsers(),
      adminApi.getAuditLogs(),
    ]);
    if (zRes.success && Array.isArray(zRes.data)) setZones(zRes.data);
    if (uRes.success && uRes.data) setUsers((uRes.data as any).data || []);
    if (aRes.success && aRes.data) setAuditLogs((aRes.data as any).data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />;

  return (
    <View style={styles.sectionWrap}>
      {/* Zones */}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Zones géographiques ({zones.length})</Text>
        <TextInput style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]} placeholder="Nom (ex: Zone Littoral Cotonou)" value={zoneNom} onChangeText={setZoneNom} />
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Code (ZON-...)" value={zoneCode} onChangeText={setZoneCode} />
          <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Commune" value={zoneCommune} onChangeText={setZoneCommune} />
        </View>
        <Pressable
          onPress={async () => {
            const res = await adminApi.createZone({
              nom: zoneNom,
              code: zoneCode,
              commune: zoneCommune,
              departement: zoneDept,
              is_active: true,
            });
            Alert.alert(res.success ? 'Zone créée' : 'Erreur', res.message || '');
            if (res.success) {
              setZoneNom('');
              setZoneCode('');
              await load();
            }
          }}
          style={[styles.actBtn, { backgroundColor: theme.primary }]}>
          <Text style={styles.actBtnText}>Créer une zone</Text>
        </Pressable>

        {zones.map((z) => (
          <View key={z.id} style={[styles.subRow, { borderTopColor: theme.cardBorder }]}>
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700', flex: 1 }}>
              {z.code} — {z.nom} ({z.commune})
            </Text>
            <Pressable
              onPress={async () => {
                await adminApi.updateZone(z.id, { is_active: !z.is_active });
                await load();
              }}>
              <Text style={{ color: z.is_active ? theme.primary : '#EF4444', fontWeight: '800', fontSize: 12 }}>
                {z.is_active ? 'Active' : 'Inactive'}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Admin Users */}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <View style={styles.row}>
          <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]}>
            Comptes d'administration ({users.length})
          </Text>
          <Pressable
            onPress={() => setShowCreateUser((v) => !v)}
            style={[styles.smallBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.smallBtnText}>{showCreateUser ? 'Fermer' : '+ Nouveau'}</Text>
          </Pressable>
        </View>

        {showCreateUser && (
          <View style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Prénom" value={newPrenom} onChangeText={setNewPrenom} />
              <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Nom" value={newName} onChangeText={setNewName} />
            </View>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={newEmail} onChangeText={setNewEmail} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Téléphone (+229...)" keyboardType="phone-pad" value={newPhone} onChangeText={setNewPhone} />
              <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Mot de passe (8+)" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(['Secrétaire', 'Responsable de zone', 'Super Admin Technique'] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setNewRole(r)}
                  style={[styles.smallBtn, { backgroundColor: newRole === r ? theme.navy : theme.backgroundElement }]}>
                  <Text style={{ color: newRole === r ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>{r}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {zones.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Pressable
                  onPress={() => setNewZoneId(null)}
                  style={[styles.smallBtn, { backgroundColor: newZoneId === null ? theme.primary : theme.backgroundElement }]}>
                  <Text style={{ color: newZoneId === null ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>Aucune zone</Text>
                </Pressable>
                {zones.map((z) => (
                  <Pressable
                    key={z.id}
                    onPress={() => setNewZoneId(z.id)}
                    style={[styles.smallBtn, { backgroundColor: newZoneId === z.id ? theme.primary : theme.backgroundElement }]}>
                    <Text style={{ color: newZoneId === z.id ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>{z.nom}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              onPress={async () => {
                const res = await adminApi.createUser({
                  prenom: newPrenom.trim(),
                  name: newName.trim(),
                  email: newEmail.trim(),
                  telephone: newPhone.trim(),
                  password: newPassword,
                  role: newRole,
                  zone_id: newZoneId,
                });
                Alert.alert(res.success ? 'Administrateur créé' : 'Erreur', res.message || '');
                if (res.success) {
                  setNewPrenom('');
                  setNewName('');
                  setNewEmail('');
                  setNewPhone('');
                  setNewPassword('');
                  setShowCreateUser(false);
                  await load();
                }
              }}
              style={[styles.actBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.actBtnText}>Créer le compte admin</Text>
            </Pressable>
          </View>
        )}

        {users.map((u) => {
          const isEditing = editingUserId === u.id;
          return (
            <View key={u.id} style={[styles.subRow, { borderTopColor: theme.cardBorder, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
                    {u.prenom} {u.name}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {u.roles?.map((r) => r.name).join(', ')} {u.zone ? `• ${u.zone.nom}` : ''} • {u.statut}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    if (isEditing) {
                      setEditingUserId(null);
                    } else {
                      const primaryRole =
                        u.roles?.find((r) => r.name !== 'Admin')?.name || 'Secrétaire';
                      setEditRole(primaryRole);
                      setEditZoneId(u.zone_id ?? null);
                      setEditingUserId(u.id);
                    }
                  }}
                  style={{ marginRight: 10, justifyContent: 'center' }}>
                  <Text style={{ color: theme.navy, fontWeight: '800', fontSize: 12 }}>
                    {isEditing ? 'Annuler' : 'Rôle/Zone'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    const next = u.statut === 'actif' ? 'suspendu' : 'actif';
                    const res = await adminApi.updateUserStatut(u.id, { statut: next });
                    Alert.alert(res.success ? 'Mis à jour' : 'Protégé', res.message || '');
                    await load();
                  }}
                  style={{ justifyContent: 'center' }}>
                  <Text style={{ color: u.statut === 'actif' ? '#DC2626' : theme.primary, fontWeight: '800', fontSize: 12 }}>
                    {u.statut === 'actif' ? 'Suspendre' : 'Réactiver'}
                  </Text>
                </Pressable>
              </View>

              {isEditing && (
                <View style={{ gap: 6, marginTop: 6 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {(['Secrétaire', 'Responsable de zone', 'Super Admin Technique'] as const).map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => setEditRole(r)}
                        style={[styles.smallBtn, { backgroundColor: editRole === r ? theme.navy : theme.backgroundElement }]}>
                        <Text style={{ color: editRole === r ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>{r}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <Pressable
                      onPress={() => setEditZoneId(null)}
                      style={[styles.smallBtn, { backgroundColor: editZoneId === null ? theme.primary : theme.backgroundElement }]}>
                      <Text style={{ color: editZoneId === null ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>Aucune zone</Text>
                    </Pressable>
                    {zones.map((z) => (
                      <Pressable
                        key={z.id}
                        onPress={() => setEditZoneId(z.id)}
                        style={[styles.smallBtn, { backgroundColor: editZoneId === z.id ? theme.primary : theme.backgroundElement }]}>
                        <Text style={{ color: editZoneId === z.id ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>{z.nom}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable
                    onPress={async () => {
                      const res = await adminApi.updateUserRoleZone(u.id, {
                        role: editRole,
                        zone_id: editZoneId,
                      });
                      Alert.alert(res.success ? 'Affectation mise à jour' : 'Erreur', res.message || '');
                      if (res.success) {
                        setEditingUserId(null);
                        await load();
                      }
                    }}
                    style={[styles.actBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.actBtnText}>Enregistrer Rôle & Zone</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Publish CGU / Charte */}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Publier un Document Légal</Text>
        <View style={styles.row}>
          {(
            [
              { key: 'cgu', label: 'CGU Clients & Agents' },
              { key: 'charte_non_contournement', label: 'Charte Staff' },
            ] as const
          ).map((dt) => (
            <Pressable
              key={dt.key}
              onPress={() => setDocType(dt.key)}
              style={[
                styles.actBtn,
                { backgroundColor: docType === dt.key ? theme.navy : theme.backgroundElement },
              ]}>
              <Text style={{ color: docType === dt.key ? '#FFF' : theme.text, fontWeight: '800', fontSize: 12 }}>
                {dt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Titre" value={cguTitre} onChangeText={setCguTitre} />
          <TextInput style={[styles.input, { width: 80, color: theme.text, borderColor: theme.cardBorder }]} placeholder="Ver" value={cguVersion} onChangeText={setCguVersion} />
        </View>
        <TextInput style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, minHeight: 70 }]} placeholder="Contenu légal..." multiline value={cguContenu} onChangeText={setCguContenu} />
        <Pressable
          onPress={async () => {
            const res = await cguApi.publierDocument({ type: docType, titre: cguTitre, version: cguVersion, contenu: cguContenu });
            Alert.alert(res.success ? 'Publié' : 'Erreur', res.message || '');
          }}
          style={[styles.actBtn, { backgroundColor: theme.navy }]}>
          <Text style={styles.actBtnText}>
            Publier ({docType === 'cgu' ? 'CGU' : 'Charte'})
          </Text>
        </Pressable>
      </View>

      {/* Audit Logs */}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Journal d'audit récent</Text>
        {auditLogs.slice(0, 15).map((log) => (
          <View key={log.id} style={[styles.subRow, { borderTopColor: theme.cardBorder }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{log.action}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                {log.user?.email || 'Système'} • {new Date(log.created_at).toLocaleString('fr-FR')}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TechHealthSection() {
  const theme = useTheme();
  const [sys, setSys] = useState<SystemHealthReport | null>(null);
  const [wh, setWh] = useState<WebhookHealthReport | null>(null);
  const [notifLogs, setNotifLogs] = useState<TechNotificationLogItem[]>([]);
  const [alerts, setAlerts] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, wRes, nRes, aRes] = await Promise.all([
      adminApi.getSystemHealth(),
      adminApi.getWebhooksHealth(),
      adminApi.getTechNotificationLogs(),
      adminApi.getSecurityAlertes(),
    ]);
    if (sRes.success) setSys(sRes as unknown as SystemHealthReport);
    if (wRes.success) setWh(wRes as unknown as WebhookHealthReport);
    if (nRes.success && Array.isArray(nRes.data)) setNotifLogs(nRes.data);
    if (aRes.success && Array.isArray(aRes.data)) setAlerts(aRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />;

  return (
    <View style={styles.sectionWrap}>
      {sys && (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Infrastructure & Santé</Text>
          <Text style={[styles.line, { color: theme.text }]}>
            DB ({sys.infrastructure?.database?.driver}) : {sys.infrastructure?.database?.status} ({sys.infrastructure?.database?.latency_ms} ms)
          </Text>
          <Text style={[styles.line, { color: theme.text }]}>
            Cache : {sys.infrastructure?.cache?.status} • Queues : {sys.infrastructure?.queues?.pending_jobs_count} pending / {sys.infrastructure?.queues?.failed_jobs_count} failed
          </Text>
          <Text style={[styles.line, { color: theme.textSecondary }]}>
            PHP {sys.php_version} • Laravel {sys.laravel_version} • {sys.response_time_ms} ms
          </Text>
        </View>
      )}

      {wh && (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Webhooks ({wh.passerelle_active})
          </Text>
          <Text style={[styles.line, { color: theme.text }]}>
            Reçus : {wh.statistiques_techniques?.total_reçus} • Signatures valides : {wh.statistiques_techniques?.signatures_valides} • Réconciliés : {wh.statistiques_techniques?.reconciliations_reussies}
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>File Notifications & DLQ</Text>
        {notifLogs.slice(0, 10).map((n) => (
          <View key={n.id} style={[styles.subRow, { borderTopColor: theme.cardBorder }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
                [{n.canal.toUpperCase()}] {n.sujet}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                {n.statut} • {n.tentatives} essai(s)
              </Text>
            </View>
            {n.statut === 'echec' && (
              <Pressable
                onPress={async () => {
                  const res = await adminApi.relancerTechNotification(n.id);
                  Alert.alert(res.success ? 'Relancé' : 'Erreur', res.message || '');
                  await load();
                }}
                style={[styles.smallBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.smallBtnText}>Relancer</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Alertes Sécurité ({alerts.length})</Text>
        {alerts.slice(0, 10).map((al) => (
          <Text key={al.id} style={[styles.line, { color: '#B91C1C' }]}>
            • {al.action} ({new Date(al.created_at).toLocaleString('fr-FR')})
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: { gap: Spacing.two },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  line: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 13 },
  subRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1, gap: 8 },
  dangerBtn: { backgroundColor: '#991B1B', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
});
