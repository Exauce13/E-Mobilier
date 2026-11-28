import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import type {
  SuperAdminActivityPoint,
  SuperAdminDistributionSlice,
  SuperAdminZonePerfRow,
} from '@/types/api';

const CHART_COLORS = {
  inscriptions: '#008751',
  publications: '#2563EB',
  demandes: '#D97706',
  grid: '#E2E8F0',
  label: '#64748B',
  text: '#0F172A',
  border: '#E2E8F0',
  softBg: '#F8FAFC',
} as const;

/* ============================================================================
 * 1. GRAPHIQUE LINÉAIRE MULTI-SÉRIES : ÉVOLUTION DES ACTIVITÉS
 * ========================================================================== */
export function ActivityLineChart({
  data,
  compact = false,
}: {
  data: SuperAdminActivityPoint[];
  compact?: boolean;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState({
    inscriptions: true,
    publications: true,
    demandes: true,
  });

  const toggleSeries = (key: 'inscriptions' | 'publications' | 'demandes') => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.inscriptions && !next.publications && !next.demandes) {
        return prev;
      }
      return next;
    });
  };

  const chartWidth = Math.max(compact ? 460 : 540, data.length * 64);
  const chartHeight = 220;
  const pad = { top: 20, right: 20, bottom: 32, left: 36 };
  const plotW = chartWidth - pad.left - pad.right;
  const plotH = chartHeight - pad.top - pad.bottom;

  const maxVal = useMemo(() => {
    let m = 0;
    for (const pt of data) {
      if (visibleSeries.inscriptions) m = Math.max(m, pt.inscriptions);
      if (visibleSeries.publications) m = Math.max(m, pt.publications);
      if (visibleSeries.demandes) m = Math.max(m, pt.demandes);
    }
    return Math.max(4, Math.ceil(m * 1.2));
  }, [data, visibleSeries]);

  const yTicks = [0, Math.round(maxVal / 3), Math.round((maxVal * 2) / 3), maxVal];

  const getX = (idx: number) =>
    data.length <= 1 ? pad.left + plotW / 2 : pad.left + (idx / (data.length - 1)) * plotW;
  const getY = (val: number) => pad.top + plotH - (val / maxVal) * plotH;

  const buildPath = (key: 'inscriptions' | 'publications' | 'demandes') => {
    if (data.length === 0) return '';
    return data
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(pt[key]).toFixed(1)}`)
      .join(' ');
  };

  const buildAreaPath = (key: 'inscriptions' | 'publications' | 'demandes') => {
    if (data.length === 0) return '';
    const line = buildPath(key);
    const lastX = getX(data.length - 1).toFixed(1);
    const firstX = getX(0).toFixed(1);
    const baseY = (pad.top + plotH).toFixed(1);
    return `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  };

  const hasAnyData = data.some(
    (d) => d.inscriptions > 0 || d.publications > 0 || d.demandes > 0
  );

  const activePoint =
    selectedIdx !== null && data[selectedIdx]
      ? data[selectedIdx]
      : data.length > 0
      ? data[data.length - 1]
      : null;

  return (
    <View style={{ gap: 12 }}>
      {/* Interactive Series Legend */}
      <View style={styles.legendRow}>
        {(
          [
            { key: 'inscriptions', label: 'Inscriptions', color: CHART_COLORS.inscriptions },
            { key: 'publications', label: 'Publications', color: CHART_COLORS.publications },
            { key: 'demandes', label: 'Demandes', color: CHART_COLORS.demandes },
          ] as const
        ).map((s) => {
          const active = visibleSeries[s.key];
          return (
            <Pressable
              key={s.key}
              onPress={() => toggleSeries(s.key)}
              style={[
                styles.legendChip,
                {
                  borderColor: active ? s.color : CHART_COLORS.border,
                  backgroundColor: active ? `${s.color}12` : '#FFFFFF',
                  opacity: active ? 1 : 0.55,
                },
              ]}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: active ? CHART_COLORS.text : CHART_COLORS.label }]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}

        {activePoint && (
          <View style={styles.activePointPill}>
            <Text style={styles.activePointLabel}>{activePoint.label} :</Text>
            <Text style={[styles.activePointVal, { color: CHART_COLORS.inscriptions }]}>
              {activePoint.inscriptions} inscr.
            </Text>
            <Text style={styles.activePointSep}>•</Text>
            <Text style={[styles.activePointVal, { color: CHART_COLORS.publications }]}>
              {activePoint.publications} publ.
            </Text>
            <Text style={styles.activePointSep}>•</Text>
            <Text style={[styles.activePointVal, { color: CHART_COLORS.demandes }]}>
              {activePoint.demandes} dem.
            </Text>
          </View>
        )}
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyChartBox}>
          <Text style={styles.emptyChartText}>Aucune donnée chronologique disponible sur cette période.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: chartWidth }}>
            <Svg width={chartWidth} height={chartHeight}>
              <Defs>
                <LinearGradient id="gradInscr" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={CHART_COLORS.inscriptions} stopOpacity="0.22" />
                  <Stop offset="100%" stopColor={CHART_COLORS.inscriptions} stopOpacity="0.01" />
                </LinearGradient>
                <LinearGradient id="gradPubl" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={CHART_COLORS.publications} stopOpacity="0.16" />
                  <Stop offset="100%" stopColor={CHART_COLORS.publications} stopOpacity="0.01" />
                </LinearGradient>
              </Defs>

              {/* Horizontal Gridlines & Y Labels */}
              {yTicks.map((tick, idx) => {
                const y = getY(tick);
                return (
                  <React.Fragment key={`y-${idx}`}>
                    <Line
                      x1={pad.left}
                      y1={y}
                      x2={chartWidth - pad.right}
                      y2={y}
                      stroke={CHART_COLORS.grid}
                      strokeWidth={1}
                      strokeDasharray={idx === 0 ? undefined : '4,4'}
                    />
                    <SvgText
                      x={pad.left - 8}
                      y={y + 4}
                      fontSize="10"
                      fill={CHART_COLORS.label}
                      textAnchor="end">
                      {tick}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Soft Areas */}
              {visibleSeries.inscriptions && data.length > 1 && (
                <Path d={buildAreaPath('inscriptions')} fill="url(#gradInscr)" />
              )}
              {visibleSeries.publications && data.length > 1 && (
                <Path d={buildAreaPath('publications')} fill="url(#gradPubl)" />
              )}

              {/* Lines */}
              {visibleSeries.inscriptions && (
                <Path
                  d={buildPath('inscriptions')}
                  fill="none"
                  stroke={CHART_COLORS.inscriptions}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {visibleSeries.publications && (
                <Path
                  d={buildPath('publications')}
                  fill="none"
                  stroke={CHART_COLORS.publications}
                  strokeWidth={2.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {visibleSeries.demandes && (
                <Path
                  d={buildPath('demandes')}
                  fill="none"
                  stroke={CHART_COLORS.demandes}
                  strokeWidth={2.3}
                  strokeDasharray="5,3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points + X Labels */}
              {data.map((pt, i) => {
                const cx = getX(i);
                const isSelected = selectedIdx === i;
                return (
                  <React.Fragment key={`pt-${i}`}>
                    {isSelected && (
                      <Line
                        x1={cx}
                        y1={pad.top}
                        x2={cx}
                        y2={pad.top + plotH}
                        stroke="#94A3B8"
                        strokeWidth={1}
                        strokeDasharray="3,3"
                      />
                    )}
                    {visibleSeries.inscriptions && (
                      <Circle
                        cx={cx}
                        cy={getY(pt.inscriptions)}
                        r={isSelected ? 5 : 3.5}
                        fill="#FFFFFF"
                        stroke={CHART_COLORS.inscriptions}
                        strokeWidth={2.2}
                      />
                    )}
                    {visibleSeries.publications && (
                      <Circle
                        cx={cx}
                        cy={getY(pt.publications)}
                        r={isSelected ? 5 : 3.5}
                        fill="#FFFFFF"
                        stroke={CHART_COLORS.publications}
                        strokeWidth={2.2}
                      />
                    )}
                    {visibleSeries.demandes && (
                      <Circle
                        cx={cx}
                        cy={getY(pt.demandes)}
                        r={isSelected ? 5 : 3.5}
                        fill="#FFFFFF"
                        stroke={CHART_COLORS.demandes}
                        strokeWidth={2.2}
                      />
                    )}
                    <SvgText
                      x={cx}
                      y={chartHeight - 10}
                      fontSize="10"
                      fontWeight={isSelected ? '700' : '500'}
                      fill={isSelected ? CHART_COLORS.text : CHART_COLORS.label}
                      textAnchor="middle">
                      {pt.label}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Clickable interval selectors for inspecting exact point counts */}
            <View style={styles.bucketSelectorRow}>
              {data.map((pt, i) => {
                const active = selectedIdx === i;
                return (
                  <Pressable
                    key={`sel-${i}`}
                    onPress={() => setSelectedIdx(active ? null : i)}
                    style={[styles.bucketPill, active && styles.bucketPillActive]}>
                    <Text style={[styles.bucketPillText, active && styles.bucketPillTextActive]}>
                      {pt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {!hasAnyData && data.length > 0 && (
        <Text style={styles.zeroHint}>
          Aucune nouvelle inscription, publication ou demande enregistrée sur cet intervalle.
        </Text>
      )}
    </View>
  );
}

/* ============================================================================
 * 2. GRAPHIQUE EN ANNEAU (DONUT) : RÉPARTITION PAR STATUT
 * ========================================================================== */
export function DonutChart({
  slices,
  centerLabel,
  size = 156,
  strokeWidth = 22,
}: {
  slices: SuperAdminDistributionSlice[];
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
}) {
  const total = slices.reduce((acc, s) => acc + s.count, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <View style={styles.donutWrap}>
      <View style={[styles.donutSvgBox, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EEF2F6"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            slices.map((slice) => {
              if (slice.count <= 0) return null;
              const fraction = slice.count / total;
              const segLen = fraction * circumference;
              const dashArray = `${segLen} ${circumference - segLen}`;
              const dashOffset = circumference * 0.25 - cumulativeOffset;
              cumulativeOffset += segLen;
              return (
                <Circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                />
              );
            })}
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutTotal}>{total}</Text>
          <Text style={styles.donutCenterLabel}>{centerLabel}</Text>
        </View>
      </View>

      <View style={styles.donutLegend}>
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <View key={s.key} style={styles.donutLegendRow}>
              <View style={styles.donutLegendLeft}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.donutLegendLabel} numberOfLines={1}>
                  {s.label}
                </Text>
              </View>
              <View style={styles.donutLegendRight}>
                <Text style={styles.donutLegendCount}>{s.count}</Text>
                <Text style={styles.donutLegendPct}>{pct}%</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ============================================================================
 * 3. PERFORMANCE GÉOGRAPHIQUE PAR ZONE (BARRES COMPARATIVES RÉELLES)
 * ========================================================================== */
export function ZonePerformancePanel({
  zones,
  isMobile = false,
}: {
  zones: SuperAdminZonePerfRow[];
  isMobile?: boolean;
}) {
  const maxVolume = useMemo(() => {
    let m = 1;
    for (const z of zones) {
      const total = z.visites_total + z.biens_actifs + z.demandes_total;
      if (total > m) m = total;
    }
    return m;
  }, [zones]);

  if (zones.length === 0) {
    return (
      <View style={styles.emptyChartBox}>
        <Text style={styles.emptyChartText}>
          Aucune zone géographique active configurée dans la base de données.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Legend for comparative bars */}
      <View style={styles.legendRow}>
        <View style={styles.miniLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#008751' }]} />
          <Text style={styles.miniLegendText}>Biens actifs</Text>
        </View>
        <View style={styles.miniLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
          <Text style={styles.miniLegendText}>Visites</Text>
        </View>
        <View style={styles.miniLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
          <Text style={styles.miniLegendText}>Demandes</Text>
        </View>
      </View>

      {zones.map((z) => {
        const biensPct = Math.round((z.biens_actifs / maxVolume) * 100);
        const visitesPct = Math.round((z.visites_total / maxVolume) * 100);
        const demandesPct = Math.round((z.demandes_total / maxVolume) * 100);
        const rateColor =
          z.taux_realisation_pct >= 70
            ? '#008751'
            : z.taux_realisation_pct >= 35
            ? '#D97706'
            : '#64748B';

        return (
          <View key={z.id} style={styles.zoneRowCard}>
            <View style={styles.zoneTopRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.zoneName} numberOfLines={1}>
                    {z.nom}
                  </Text>
                  <View style={styles.zoneCodePill}>
                    <Text style={styles.zoneCodeText}>{z.code}</Text>
                  </View>
                </View>
                <Text style={styles.zoneSub}>
                  {z.commune}
                  {z.departement ? ` • ${z.departement}` : ''}
                </Text>
              </View>

              <View style={styles.zoneRateBox}>
                <Text style={[styles.zoneRateValue, { color: rateColor }]}>
                  {z.taux_realisation_pct}%
                </Text>
                <Text style={styles.zoneRateLabel}>Réalisation</Text>
              </View>
            </View>

            {/* Real Proportional Stacked Volume Bar */}
            <View style={styles.stackedTrack}>
              {biensPct > 0 && (
                <View style={[styles.stackedSeg, { width: `${biensPct}%`, backgroundColor: '#008751' }]} />
              )}
              {visitesPct > 0 && (
                <View style={[styles.stackedSeg, { width: `${visitesPct}%`, backgroundColor: '#2563EB' }]} />
              )}
              {demandesPct > 0 && (
                <View style={[styles.stackedSeg, { width: `${demandesPct}%`, backgroundColor: '#D97706' }]} />
              )}
            </View>

            {/* Real KPI Breakdown per Zone */}
            <View style={[styles.zoneMetricsGrid, isMobile && { gap: 6 }]}>
              <View style={styles.zoneMetricPill}>
                <Text style={styles.zoneMetricLabel}>Visites</Text>
                <Text style={styles.zoneMetricVal}>
                  {z.visites_effectuees}/{z.visites_total}
                </Text>
              </View>
              <View style={styles.zoneMetricPill}>
                <Text style={styles.zoneMetricLabel}>Biens actifs</Text>
                <Text style={[styles.zoneMetricVal, { color: '#008751' }]}>{z.biens_actifs}</Text>
              </View>
              <View style={styles.zoneMetricPill}>
                <Text style={styles.zoneMetricLabel}>Demandes</Text>
                <Text style={[styles.zoneMetricVal, { color: '#D97706' }]}>{z.demandes_total}</Text>
              </View>
              <View style={styles.zoneMetricPill}>
                <Text style={styles.zoneMetricLabel}>Dossiers traités</Text>
                <Text style={[styles.zoneMetricVal, { color: '#2563EB' }]}>{z.dossiers_traites}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activePointPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginLeft: 'auto',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activePointLabel: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  activePointVal: { fontSize: 11, fontWeight: '800' },
  activePointSep: { fontSize: 11, color: '#CBD5E1' },
  bucketSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  bucketPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  bucketPillActive: {
    backgroundColor: '#008751',
  },
  bucketPillText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  bucketPillTextActive: { color: '#FFFFFF' },
  zeroHint: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  emptyChartBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyChartText: { fontSize: 12, color: '#64748B', textAlign: 'center' },

  donutWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  donutSvgBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  donutCenterLabel: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  donutLegend: { flex: 1, minWidth: 160, gap: 8 },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  donutLegendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  donutLegendLabel: { fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 },
  donutLegendRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  donutLegendCount: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  donutLegendPct: { fontSize: 11, fontWeight: '700', color: '#64748B', minWidth: 32, textAlign: 'right' },

  miniLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniLegendText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  zoneRowCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 13,
    gap: 10,
  },
  zoneTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  zoneName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  zoneCodePill: {
    backgroundColor: '#EBF7F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  zoneCodeText: { fontSize: 10, fontWeight: '800', color: '#008751' },
  zoneSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  zoneRateBox: { alignItems: 'flex-end' },
  zoneRateValue: { fontSize: 16, fontWeight: '900' },
  zoneRateLabel: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  stackedTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stackedSeg: { height: '100%' },
  zoneMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneMetricPill: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
  },
  zoneMetricLabel: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  zoneMetricVal: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
});
