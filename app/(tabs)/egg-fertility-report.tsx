import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { ReportsCardTheme, ReportsPageTheme } from "@/constants/reports-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { fetchFarmEggBatches } from "@/utils/supabase-egg-batches";
import {
    fetchEggFertilityReportSnapshot,
    type EggFertilityReportSnapshot,
    type ReportDonutSlice,
    type ReportOverview,
} from "@/utils/supabase-reports";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

type PeriodOption = "7 Days" | "30 Days" | "12 Months";
type ScopeOption = {
  key: string;
  label: string;
  colorHex?: string;
  colorName?: string;
  originBatchNo?: string;
};

const PERIOD_OPTIONS: PeriodOption[] = ["7 Days", "30 Days", "12 Months"];

const EMPTY_REPORT: EggFertilityReportSnapshot = {
  title: "Egg Fertility Rate Overview",
  totalOutcomes: 0,
  totalEggs: 0,
  fertileCount: 0,
  unhatchedCount: 0,
  damagedCount: 0,
  fertilityRate: 0,
  productionRate: 0,
  slices: [
    { label: "fertile", count: 0, color: "#323330", displayPercent: "0%" },
    { label: "unhatched", count: 0, color: "#438b7b", displayPercent: "0%" },
    { label: "damaged", count: 0, color: "#9cd5c9", displayPercent: "0%" },
  ],
  analyticsText: "No egg fertility data is available yet.",
};

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function mapPeriodToOverview(period: PeriodOption): ReportOverview {
  if (period === "30 Days") return "Monthly";
  if (period === "12 Months") return "Annually";
  return "Weekly";
}

function mapOverviewToPeriod(overview?: string): PeriodOption {
  if (overview === "Monthly") return "30 Days";
  if (overview === "Annually") return "12 Months";
  return "7 Days";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPrintableHtml(input: {
  report: EggFertilityReportSnapshot;
  scopeLabel: string;
  generatedBy: string;
  generatedDate: string;
  generatedTime: string;
  period: PeriodOption;
}) {
  const rows = input.report.slices
    .map(
      (slice) => `
                <tr>
                    <td>${escapeHtml(slice.label)}</td>
                    <td>${slice.count}</td>
                    <td>${escapeHtml(slice.displayPercent)}</td>
                </tr>`,
    )
    .join("");

  const donutSegments = input.report.slices
    .map((slice) => {
      return `<div class="legend-row"><span class="swatch" style="background:${escapeHtml(slice.color)}"></span><span>${escapeHtml(slice.label)} ${escapeHtml(slice.displayPercent)}</span></div>`;
    })
    .join("");

  const total = input.report.totalOutcomes;
  const donutSvg = `
        <svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Egg fertility donut chart">
          <circle cx="110" cy="110" r="78" fill="none" stroke="#e7f1eb" stroke-width="28"></circle>
          ${input.report.slices
            .map((slice, index) => {
              const percent =
                input.report.totalOutcomes > 0
                  ? (slice.count / input.report.totalOutcomes) * 100
                  : 0;
              const circumference = 2 * Math.PI * 78;
              const strokeLength = (percent / 100) * circumference;
              const offset =
                index === 0
                  ? 0
                  : input.report.slices
                      .slice(0, index)
                      .reduce(
                        (sum, current) =>
                          sum +
                          (input.report.totalOutcomes > 0
                            ? (current.count / input.report.totalOutcomes) * 100
                            : 0),
                        0,
                      );
              const dashOffset = circumference - (offset / 100) * circumference;
              return `<circle cx="110" cy="110" r="78" fill="none" stroke="${escapeHtml(slice.color)}" stroke-width="28" stroke-linecap="round" stroke-dasharray="${strokeLength.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 110 110)"></circle>`;
            })
            .join("")}
          <circle cx="110" cy="110" r="50" fill="white"></circle>
          <text x="110" y="102" text-anchor="middle" font-size="28" font-weight="700" fill="#203029">${total}</text>
          <text x="110" y="132" text-anchor="middle" font-size="12" fill="#688078">Outcomes</text>
        </svg>`;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 22px; font-family: Arial, sans-serif; background: #f4faf7; color: #203029; }
          .sheet { min-height: calc(100vh - 44px); border: 1px solid #dcebe5; border-radius: 20px; padding: 24px; background: linear-gradient(180deg, #fcfffd 0%, #eef7f2 100%); }
          .row { display: flex; gap: 12px; flex-wrap: wrap; }
          .between { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
          .card { background: rgba(255,255,255,0.86); border: 1px solid #dbe9e4; border-radius: 16px; padding: 14px 16px; flex: 1; min-width: 180px; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #688078; margin-bottom: 6px; }
          .value { font-size: 16px; font-weight: 700; }
          .kpi { font-size: 26px; font-weight: 700; }
          .title { font-size: 28px; font-weight: 700; margin: 0 0 6px; }
          .subtitle { font-size: 13px; color: #4f645c; margin: 0; }
          .section { margin-top: 18px; background: rgba(255,255,255,0.86); border: 1px solid #dbe9e4; border-radius: 16px; padding: 14px 16px; }
          .section-title { font-size: 18px; font-weight: 700; margin: 0 0 10px; }
          .chart-shell { display: flex; gap: 18px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
          .legend { display: flex; flex-direction: column; gap: 8px; min-width: 180px; }
          .legend-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #466058; text-transform: capitalize; }
          .swatch { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e4efea; font-size: 13px; }
          th { font-size: 12px; color: #587068; text-transform: uppercase; letter-spacing: .04em; }
          .analytics { margin-top: 10px; font-size: 13px; line-height: 1.5; color: #466058; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="between">
            <div>
              <h1 class="title">Egg Fertility Report</h1>
              <p class="subtitle">Analytics for ${escapeHtml(input.scopeLabel)}</p>
            </div>
            <div class="card">
              <div class="label">Generated By</div>
              <div class="value">${escapeHtml(input.generatedBy)}</div>
            </div>
          </div>
          <div class="row" style="margin-top: 14px;">
            <div class="card"><div class="label">Period</div><div class="value">${escapeHtml(input.period)}</div></div>
            <div class="card"><div class="label">Date</div><div class="value">${escapeHtml(input.generatedDate)}</div></div>
            <div class="card"><div class="label">Time</div><div class="value">${escapeHtml(input.generatedTime)}</div></div>
          </div>
          <div class="row" style="margin-top: 14px;">
            <div class="card"><div class="label">Fertility Rate</div><div class="kpi">${input.report.fertilityRate}%</div></div>
            <div class="card"><div class="label">Production Rate</div><div class="kpi">${input.report.productionRate}%</div></div>
            <div class="card"><div class="label">Recorded Eggs</div><div class="kpi">${input.report.totalEggs}</div></div>
          </div>
          <div class="section">
            <h2 class="section-title">${escapeHtml(input.report.title)}</h2>
            <div class="chart-shell">
              <div>${donutSvg}</div>
              <div class="legend">${donutSegments}</div>
            </div>
            <table>
              <thead><tr><th>Category</th><th>Count</th><th>Percent</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="analytics">${escapeHtml(input.report.analyticsText)}</div>
          </div>
        </div>
      </body>
    </html>`;
}

function DonutChart({
  slices,
  total,
}: {
  slices: ReportDonutSlice[];
  total: number;
}) {
  const size = 140;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffsetPercent = 0;

  return (
    <View style={styles.donutContainer}>
      <View style={styles.donutSvgWrap}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            {slices.map((slice) => {
              const percent = total > 0 ? (slice.count / total) * 100 : 0;
              const strokeDashoffset =
                circumference - (percent / 100) * circumference;
              const rotationOffset = (currentOffsetPercent / 100) * 360;

              currentOffsetPercent += percent;

              return (
                <Circle
                  key={slice.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  rotation={rotationOffset}
                  origin={`${center}, ${center}`}
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.donutCenterWrap}>
          <Text style={styles.donutCenterValue}>{total}</Text>
          <Text style={styles.donutCenterLabel}>Outcomes</Text>
        </View>
      </View>
      <View style={styles.donutSummaryRow}>
        {slices.map((slice) => (
          <View key={slice.label} style={styles.donutSummaryChip}>
            <View
              style={[
                styles.donutSummarySwatch,
                { backgroundColor: slice.color },
              ]}
            />
            <Text style={styles.donutSummaryText}>
              {slice.label} {slice.displayPercent}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EggFertilityReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFarm, profile } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const params = useLocalSearchParams<{
    color?: string;
    colorHex?: string;
    overview?: string;
  }>();

  const initialScopeLabel =
    normalizeParam(params.color) || "Overall Egg Fertility Rate";
  const initialScopeHex = normalizeParam(params.colorHex) || undefined;
  const [period, setPeriod] = useState<PeriodOption>(
    mapOverviewToPeriod(normalizeParam(params.overview)),
  );
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([
    {
      key: "overall",
      label: "Overall Egg Fertility Rate",
    },
  ]);
  const [selectedScopeKey, setSelectedScopeKey] = useState("overall");
  const [scopeModalVisible, setScopeModalVisible] = useState(false);
  const [report, setReport] =
    useState<EggFertilityReportSnapshot>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatedBy = profile?.display_name || profile?.email || "Farm User";
  const generatedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const generatedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date());

  useEffect(() => {
    if (!activeFarm?.id) {
      setScopeOptions([
        {
          key: "overall",
          label: "Overall Egg Fertility Rate",
        },
      ]);
      setSelectedScopeKey("overall");
      return;
    }

    let cancelled = false;

    fetchFarmEggBatches(activeFarm.id)
      .then((rows) => {
        if (cancelled) return;

        const seen = new Map<string, ScopeOption>();
        rows.forEach((row) => {
          const colorName = (row.colorName ?? "").trim();
          const originBatchNo = (row.origin ?? "").trim();
          const label = [
            colorName || "Unspecified color",
            originBatchNo
              ? `Batch C${originBatchNo.replace(/\D/g, "").padStart(3, "0")}`
              : "Unknown chicken batch",
          ].join(" • ");
          if (!colorName && !originBatchNo) return;

          const key = `${colorName}|${originBatchNo}`.toLowerCase();
          if (!seen.has(key)) {
            seen.set(key, {
              key,
              label,
              colorName,
              originBatchNo,
              colorHex: row.colorHex ?? ChickIntelPalette.gray2,
            });
          }
        });

        const nextOptions: ScopeOption[] = [
          {
            key: "overall",
            label: "Overall Egg Fertility Rate",
          },
          ...Array.from(seen.values()).sort((left, right) =>
            left.label.localeCompare(right.label),
          ),
        ];

        setScopeOptions(nextOptions);

        if (
          initialScopeLabel &&
          initialScopeLabel !== "Overall Egg Fertility Rate"
        ) {
          const match = nextOptions.find(
            (option) =>
              option.colorName?.toLowerCase() ===
              initialScopeLabel.toLowerCase(),
          );
          if (match) {
            setSelectedScopeKey(match.key);
            return;
          }
        }

        setSelectedScopeKey("overall");
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load egg batch scopes.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeFarm?.id, initialScopeLabel]);

  const selectedScope = useMemo(
    () =>
      scopeOptions.find((option) => option.key === selectedScopeKey) ?? {
        key: "overall",
        label: "Overall Egg Fertility Rate",
        colorHex: initialScopeHex,
      },
    [initialScopeHex, scopeOptions, selectedScopeKey],
  );

  const scopeLabel = selectedScope.label;
  const scopeHex = selectedScope.colorHex || ChickIntelPalette.green1;

  useEffect(() => {
    if (!activeFarm?.id) {
      setReport(EMPTY_REPORT);
      return;
    }

    let cancelled = false;
    const farmId = activeFarm.id;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const nextReport = await fetchEggFertilityReportSnapshot({
          farmId,
          overview: mapPeriodToOverview(period),
          scope:
            selectedScope.key === "overall"
              ? undefined
              : {
                  colorName: selectedScope.colorName,
                  originBatchNo: selectedScope.originBatchNo,
                },
        });

        if (!cancelled) {
          setReport(nextReport);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load egg fertility report.",
          );
          setReport(EMPTY_REPORT);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeFarm?.id, period, selectedScope]);

  async function handlePrint() {
    const html = buildPrintableHtml({
      report,
      scopeLabel,
      generatedBy,
      generatedDate,
      generatedTime,
      period,
    });

    await Print.printAsync({
      html,
      orientation: "portrait",
    });
  }

  const glassBorder = isDark
    ? "rgba(255, 255, 255, 0.2)"
    : "rgba(255, 255, 255, 0.6)";

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={20}
                color={ChickIntelPalette.gray1}
              />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.screenTitle}>Egg Fertility Report</Text>
              <Text style={styles.headerSubtitle}>{scopeLabel}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={handlePrint}>
              <MaterialCommunityIcons
                name="printer-outline"
                size={22}
                color={ChickIntelPalette.gray1}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => setScopeModalVisible(true)}
          style={styles.scopeDropdown}
        >
          <Text style={styles.scopeDropdownLabel}>Batch Scope</Text>
          <View style={styles.scopeDropdownValueRow}>
            {selectedScope.key === "overall" ? (
              <Text style={styles.scopeDropdownValueText}>
                Overall Egg Fertility Rate
              </Text>
            ) : (
              <View style={styles.scopeDropdownSelected}>
                <View
                  style={[
                    styles.scopeDropdownPill,
                    { backgroundColor: scopeHex },
                  ]}
                />
                <Text style={styles.scopeDropdownValueText} numberOfLines={1}>
                  {selectedScope.label}
                </Text>
              </View>
            )}
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={ChickIntelPalette.gray1}
            />
          </View>
        </Pressable>

        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => setPeriod(entry)}
              style={[
                styles.periodChip,
                period === entry ? styles.periodChipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.periodChipText,
                  period === entry ? styles.periodChipTextActive : null,
                ]}
              >
                {entry}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={ChickIntelPalette.green1} />
            <Text style={styles.statusText}>Loading analytics...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <BlurCard
          style={styles.glassCard}
          borderRadius={10}
          intensity={16}
          transparent
        >
          <View
            style={[
              styles.cardSurface,
              { backgroundColor: "transparent", borderColor: glassBorder },
            ]}
          >
            <Text style={styles.cardTitle}>{report.title}</Text>

            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Fertility Rate</Text>
                <Text style={styles.kpiValue}>{report.fertilityRate}%</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Production Rate</Text>
                <Text style={styles.kpiValue}>{report.productionRate}%</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Recorded Eggs</Text>
                <Text style={styles.kpiValue}>{report.totalEggs}</Text>
              </View>
            </View>

            <View style={styles.chartWrapper}>
              <DonutChart slices={report.slices} total={report.totalOutcomes} />
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightTitle}>Insights</Text>
              <Text style={styles.analyticsText}>{report.analyticsText}</Text>
            </View>
          </View>
        </BlurCard>
      </ScrollView>

      <Modal
        visible={scopeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScopeModalVisible(false)}
      >
        <Pressable
          style={styles.scopeModalBackdrop}
          onPress={() => setScopeModalVisible(false)}
        >
          <Pressable
            style={styles.scopeModalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.scopeModalTitle}>Select Egg Batch Scope</Text>
            <ScrollView
              style={styles.scopeModalList}
              showsVerticalScrollIndicator={false}
            >
              {scopeOptions.map((option) => {
                const isSelected = option.key === selectedScopeKey;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setSelectedScopeKey(option.key);
                      setScopeModalVisible(false);
                    }}
                    style={[
                      styles.scopeOptionRow,
                      isSelected ? styles.scopeOptionRowSelected : null,
                    ]}
                  >
                    {option.key === "overall" ? (
                      <Text
                        style={[
                          styles.scopeOptionText,
                          isSelected ? styles.scopeOptionTextSelected : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    ) : (
                      <View style={styles.scopeOptionContent}>
                        <View
                          style={[
                            styles.scopeOptionPill,
                            {
                              backgroundColor:
                                option.colorHex ?? ChickIntelPalette.gray2,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.scopeOptionText,
                            isSelected ? styles.scopeOptionTextSelected : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </View>
                    )}
                    {isSelected ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={ChickIntelPalette.green1}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ReportsPageTheme.screenBackground,
  },
  content: {
    paddingHorizontal: ReportsPageTheme.contentPaddingHorizontal,
    gap: ReportsPageTheme.contentGap,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: ReportsPageTheme.headerPaddingHorizontal,
    marginTop: ReportsPageTheme.headerTopMargin,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },
  backButton: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.light1,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    ...ReportsPageTheme.screenTitle,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scopeChip: {
    width: scale(28),
    height: verticalScale(10),
    borderRadius: 999,
  },
  headerSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: "#5b746b",
  },
  scopeDropdown: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.26)",
    backgroundColor: "rgba(202, 227, 221, 0.28)",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
    gap: 8,
  },
  scopeDropdownLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    letterSpacing: 0.65,
    textTransform: "uppercase",
    color: "rgba(51, 51, 51, 0.56)",
  },
  scopeDropdownValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  scopeDropdownSelected: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scopeDropdownValueText: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  scopeDropdownPill: {
    width: scale(56),
    height: verticalScale(14),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(51, 51, 51, 0.08)",
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    paddingHorizontal: moderateScale(4),
  },
  periodChip: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(8),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.12)",
  },
  periodChipActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  periodChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  periodChipTextActive: {
    color: "#FFF",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: moderateScale(12),
  },
  statusText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
  },
  errorText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: "#A64040",
    paddingHorizontal: moderateScale(12),
  },
  glassCard: {
    overflow: "hidden",
  },
  cardSurface: {
    borderRadius: ReportsPageTheme.cardInnerRadius,
    padding: ReportsPageTheme.cardInnerPadding,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: scale(100),
    borderRadius: 14,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
    backgroundColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.12)",
  },
  kpiLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#678077",
    letterSpacing: 0.4,
  },
  kpiValue: {
    marginTop: 8,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  chartWrapper: {
    alignItems: "center",
    marginTop: ReportsPageTheme.chartTopMargin,
    minHeight: ReportsPageTheme.chartHeight,
    justifyContent: "center",
  },
  donutContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 14,
  },
  donutSvgWrap: {
    width: ReportsCardTheme.donutSize,
    height: ReportsCardTheme.donutSize,
    position: "relative",
  },
  donutCenterWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  donutCenterValue: {
    fontFamily: ReportsCardTheme.centerValueFontFamily,
    fontWeight: ReportsCardTheme.centerValueFontWeight,
    fontSize: ReportsCardTheme.centerValueFontSize,
    color: ReportsCardTheme.centerValueColor,
  },
  donutCenterLabel: {
    fontFamily: ReportsCardTheme.centerLabelFontFamily,
    fontSize: ReportsCardTheme.centerLabelFontSize,
    color: ReportsCardTheme.centerLabelColor,
  },
  donutSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    maxWidth: scale(280),
  },
  donutSummaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.12)",
  },
  donutSummarySwatch: {
    width: scale(10),
    height: verticalScale(10),
    borderRadius: 999,
  },
  donutSummaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    textTransform: "capitalize",
  },
  insightBlock: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    paddingTop: 12,
  },
  insightTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    marginBottom: 6,
  },
  analyticsText: {
    fontFamily: ReportsCardTheme.footerTextFontFamily,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    color: ReportsPageTheme.analyticsTextColor,
  },
  scopeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 44, 39, 0.34)",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  scopeModalCard: {
    backgroundColor: "#F8FCFA",
    borderRadius: 18,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: scale(0), height: verticalScale(10) },
    elevation: 6,
  },
  scopeModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "600",
    color: "rgba(51, 51, 51, 0.62)",
    marginBottom: 10,
  },
  scopeModalList: {
    maxHeight: 360,
  },
  scopeOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: verticalScale(48),
    paddingHorizontal: moderateScale(12),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.54)",
    marginBottom: 6,
  },
  scopeOptionRowSelected: {
    backgroundColor: "rgba(202, 227, 221, 0.82)",
    borderColor: "rgba(49,118,103,0.18)",
  },
  scopeOptionText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  scopeOptionTextSelected: {
    color: ChickIntelPalette.green1,
  },
  scopeOptionPill: {
    width: scale(72),
    height: verticalScale(16),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(51, 51, 51, 0.08)",
  },
  scopeOptionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
