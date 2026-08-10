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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  farmName: string;
}) {
  const rows = input.report.slices
    .map((slice) => {
      const percentVal =
        input.report.totalOutcomes > 0
          ? Math.round((slice.count / input.report.totalOutcomes) * 100)
          : 0;
      return `
        <tr>
            <td style="font-weight: 700;">
              <span class="swatch-dot" style="background:${escapeHtml(slice.color)}"></span>
              ${escapeHtml(slice.label.toUpperCase())}
            </td>
            <td style="font-weight: 700; text-align: right;">${slice.count.toLocaleString()}</td>
            <td style="text-align: right; font-weight: 600; color: #317667;">${escapeHtml(slice.displayPercent)}</td>
            <td>
              <div class="table-progress-track">
                <div class="table-progress-fill" style="width: ${percentVal}%; background: ${escapeHtml(slice.color)};"></div>
              </div>
            </td>
        </tr>`;
    })
    .join("");

  const donutSvg = `
    <svg width="200" height="200" viewBox="0 0 220 220" role="img" aria-label="Egg fertility donut chart">
      <circle cx="110" cy="110" r="78" fill="none" stroke="#e8f3ee" stroke-width="26"></circle>
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
          return `<circle cx="110" cy="110" r="78" fill="none" stroke="${escapeHtml(slice.color)}" stroke-width="26" stroke-dasharray="${strokeLength.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 110 110)"></circle>`;
        })
        .join("")}
      <circle cx="110" cy="110" r="52" fill="white"></circle>
      <text x="110" y="104" text-anchor="middle" font-size="28" font-weight="800" fill="#203029">${input.report.totalOutcomes.toLocaleString()}</text>
      <text x="110" y="128" text-anchor="middle" font-size="12" font-weight="600" fill="#688078">Outcomes</text>
    </svg>`;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Egg Fertility Report - ${escapeHtml(input.scopeLabel)}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
              color: #203029;
              background: #f4faf7;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          body { padding: 16px; }
          .sheet {
              min-height: 1080px;
              width: 100%;
              background: #ffffff;
              border: 1px solid #dcebe5;
              border-radius: 16px;
              padding: 24px;
              display: flex;
              flex-direction: column;
              gap: 14px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          }
          .page-top-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #317667;
              padding-bottom: 12px;
          }
          .brand-title {
              font-size: 26px;
              font-weight: 800;
              color: #317667;
              margin: 0;
              letter-spacing: -0.5px;
          }
          .brand-sub {
              font-size: 11px;
              color: #688078;
              margin: 2px 0 0;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
          }
          .page-badge {
              background: rgba(49, 118, 103, 0.1);
              border: 1px solid rgba(49, 118, 103, 0.2);
              color: #317667;
              padding: 6px 14px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
          }
          .meta-strip {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              background: #f4faf7;
              border: 1px solid #e0efe9;
              border-radius: 10px;
              padding: 10px 14px;
          }
          .meta-item {
              font-size: 11px;
              color: #49635a;
          }
          .meta-lbl {
              font-weight: 700;
              color: #688078;
              margin-right: 4px;
          }
          .meta-val {
              font-weight: 700;
              color: #203029;
          }
          .category-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 4px;
          }
          .category-title {
              font-size: 20px;
              font-weight: 800;
              color: #203029;
              margin: 0;
          }
          .category-tag {
              font-size: 11px;
              font-weight: 700;
              color: #688078;
              text-transform: uppercase;
              letter-spacing: 0.5px;
          }
          .kpi-banner {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
          }
          .kpi-box {
              background: #f9fcfb;
              border: 1px solid #dcebe5;
              border-radius: 12px;
              padding: 12px;
          }
          .kpi-title {
              font-size: 10px;
              font-weight: 700;
              color: #688078;
              letter-spacing: 0.5px;
          }
          .kpi-value {
              font-size: 22px;
              font-weight: 800;
              color: #203029;
              margin: 4px 0 2px;
          }
          .kpi-sub {
              font-size: 10px;
              color: #317667;
              font-weight: 600;
          }
          .section-card {
              background: #ffffff;
              border: 1px solid #e2efe9;
              border-radius: 14px;
              padding: 16px;
          }
          .chart-flex-layout {
              display: flex;
              gap: 20px;
              align-items: center;
          }
          .chart-visual-box {
              display: flex;
              justify-content: center;
              align-items: center;
              min-width: 210px;
          }
          .chart-details-box {
              flex: 1;
          }
          .details-heading {
              font-size: 13px;
              font-weight: 700;
              color: #203029;
              margin-bottom: 8px;
          }
          .data-table {
              width: 100%;
              border-collapse: collapse;
          }
          .data-table th, .data-table td {
              padding: 8px 10px;
              font-size: 12px;
              border-bottom: 1px solid #eef5f2;
          }
          .data-table th {
              background: #f4faf7;
              color: #587068;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
              text-align: left;
          }
          .swatch-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              display: inline-block;
              margin-right: 6px;
          }
          .table-progress-track {
              height: 6px;
              background: #eef5f2;
              border-radius: 3px;
              overflow: hidden;
              width: 100%;
          }
          .table-progress-fill {
              height: 100%;
              border-radius: 3px;
          }
          .insight-box {
              background: rgba(49, 118, 103, 0.06);
              border: 1px solid rgba(49, 118, 103, 0.18);
              border-radius: 12px;
              padding: 14px;
              margin-top: auto;
          }
          .insight-title {
              font-size: 12px;
              font-weight: 700;
              color: #317667;
              margin-bottom: 4px;
          }
          .insight-text {
              font-size: 11px;
              line-height: 1.5;
              color: #203029;
          }
          .page-footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-top: 1px solid #e8f3ee;
              padding-top: 10px;
              margin-top: 8px;
              font-size: 10px;
              color: #688078;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="page-top-header">
            <div class="brand-group">
                <h1 class="brand-title">ChickInteL</h1>
                <p class="brand-sub">Egg Fertility Intelligence Report</p>
            </div>
            <div class="page-badge">
              Egg Fertility Analytics
            </div>
          </div>

          <div class="meta-strip">
              <div class="meta-item"><span class="meta-lbl">FARM:</span> <span class="meta-val">${escapeHtml(input.farmName)}</span></div>
              <div class="meta-item"><span class="meta-lbl">SCOPE:</span> <span class="meta-val">${escapeHtml(input.scopeLabel)}</span></div>
              <div class="meta-item"><span class="meta-lbl">PERIOD:</span> <span class="meta-val">${escapeHtml(input.period)}</span></div>
              <div class="meta-item"><span class="meta-lbl">DATE:</span> <span class="meta-val">${escapeHtml(input.generatedDate)}</span></div>
              <div class="meta-item"><span class="meta-lbl">PREPARED BY:</span> <span class="meta-val">${escapeHtml(input.generatedBy)}</span></div>
          </div>

          <div class="category-header">
            <h2 class="category-title">Fertility Rate Performance</h2>
            <div class="category-tag">ChickInteL Analytics</div>
          </div>

          <div class="kpi-banner">
            <div class="kpi-box">
              <div class="kpi-title">FERTILITY RATE</div>
              <div class="kpi-value" style="color: #317667;">${input.report.fertilityRate}%</div>
              <div class="kpi-sub">Fertile Egg Ratio</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">HATCH / PRODUCTION RATE</div>
              <div class="kpi-value">${input.report.productionRate}%</div>
              <div class="kpi-sub">Hatched Outcomes</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">RECORDED EGGS</div>
              <div class="kpi-value">${input.report.totalEggs.toLocaleString()}</div>
              <div class="kpi-sub">Total Batch Quantity</div>
            </div>
          </div>

          <div class="section-card">
            <div class="chart-flex-layout">
              <div class="chart-visual-box">
                ${donutSvg}
              </div>
              <div class="chart-details-box">
                <div class="details-heading">Outcome Share Breakdown</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Outcome Category</th>
                            <th style="text-align: right;">Count</th>
                            <th style="text-align: right;">Percentage</th>
                            <th style="width: 35%;">Ratio Bar</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="insight-box">
            <div class="insight-title">💡 Operational Takeaway & Fertility Analysis</div>
            <div class="insight-text">${escapeHtml(input.report.analyticsText)}</div>
          </div>

          <div class="page-footer">
            <span>Official ChickInteL Egg Fertility Document</span>
            <span>Generated on ${escapeHtml(input.generatedDate)} ${escapeHtml(input.generatedTime)}</span>
            <span>ChickInteL System</span>
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
  const size = 150;
  const strokeWidth = 26;
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
                  strokeLinecap="butt"
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.donutCenterWrap}>
          <Text style={styles.donutCenterValue}>{total.toLocaleString()}</Text>
          <Text style={styles.donutCenterLabel}>Outcomes</Text>
        </View>
      </View>

      <View style={styles.breakdownList}>
        {slices.map((slice) => {
          const percentVal = total > 0 ? Math.round((slice.count / total) * 100) : 0;
          return (
            <View key={slice.label} style={styles.breakdownRowContainer}>
              <View style={styles.breakdownRowHeader}>
                <View style={styles.breakdownLabelGroup}>
                  <View
                    style={[
                      styles.breakdownDot,
                      { backgroundColor: slice.color },
                    ]}
                  />
                  <Text style={styles.breakdownLabelText}>{slice.label}</Text>
                </View>
                <Text style={styles.breakdownValueText}>
                  {slice.count.toLocaleString()} ({slice.displayPercent})
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${percentVal}%`,
                      backgroundColor: slice.color,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
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
    weekday: "short",
    year: "numeric",
    month: "short",
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
      farmName: activeFarm?.name || "ChickInteL Farm",
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <BackgroundGradient
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      />

      {/* Pinned Top Header & Controls */}
      <View style={styles.fixedHeader}>
        {/* Header */}
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
              <Text style={styles.headerSubtitle} numberOfLines={1}>{scopeLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.printButton}
            onPress={handlePrint}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="printer-outline"
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>

        {/* Batch Scope Selector Card */}
        <Pressable
          onPress={() => setScopeModalVisible(true)}
          style={styles.scopeDropdown}
        >
          <Text style={styles.scopeDropdownLabel}>Filter Batch Scope:</Text>
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

        {/* Timeframe Filter Segment */}
        <View style={styles.periodBarContainer}>
          <Text style={styles.periodLabel}>Period:</Text>
          <View style={styles.periodSegmented}>
            {PERIOD_OPTIONS.map((entry) => (
              <TouchableOpacity
                key={entry}
                onPress={() => setPeriod(entry)}
                style={[
                  styles.periodItem,
                  period === entry ? styles.periodItemActive : null,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.periodText,
                    period === entry ? styles.periodTextActive : null,
                  ]}
                >
                  {entry}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 10, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {loading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={ChickIntelPalette.green1} />
            <Text style={styles.statusText}>Updating fertility metrics...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* At-a-Glance KPI Cards Row */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconWrap}>
              <MaterialCommunityIcons
                name="heart-pulse"
                size={16}
                color={ChickIntelPalette.green1}
              />
            </View>
            <Text style={styles.kpiLabel}>Fertility Rate</Text>
            <Text style={[styles.kpiValue, { color: ChickIntelPalette.green1 }]}>
              {report.fertilityRate}%
            </Text>
            <Text style={styles.kpiSubtext}>Fertile Egg Ratio</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiIconWrap}>
              <MaterialCommunityIcons
                name="egg-outline"
                size={16}
                color={ChickIntelPalette.green1}
              />
            </View>
            <Text style={styles.kpiLabel}>Hatch Rate</Text>
            <Text style={styles.kpiValue}>{report.productionRate}%</Text>
            <Text style={styles.kpiSubtext}>Hatched Outcomes</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiIconWrap}>
              <MaterialCommunityIcons
                name="egg-outline"
                size={16}
                color={ChickIntelPalette.green1}
              />
            </View>
            <Text style={styles.kpiLabel}>Total Eggs</Text>
            <Text style={styles.kpiValue}>
              {report.totalEggs.toLocaleString()}
            </Text>
            <Text style={styles.kpiSubtext}>Batch Quantity</Text>
          </View>
        </View>

        {/* Donut & Breakdown Card */}
        <BlurCard
          style={[styles.glassCard, isDark && styles.glassCardDark]}
          borderRadius={20}
          intensity={18}
          transparent
        >
          <View
            style={[
              styles.cardSurface,
              { backgroundColor: "transparent", borderColor: glassBorder },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBadge}>
                <MaterialCommunityIcons
                  name="chart-donut"
                  size={18}
                  color={ChickIntelPalette.green1}
                />
              </View>
              <Text style={styles.cardTitle}>{report.title}</Text>
            </View>

            <View style={styles.chartWrapper}>
              <DonutChart slices={report.slices} total={report.totalOutcomes} />
            </View>

            <View style={styles.insightCard}>
              <View style={styles.insightHeaderRow}>
                <View style={styles.insightIconBadge}>
                  <MaterialCommunityIcons
                    name="lightbulb-on-outline"
                    size={16}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <Text style={styles.insightTitle}>Fertility Operational Insight</Text>
              </View>
              <Text style={styles.insightBodyText}>{report.analyticsText}</Text>
            </View>
          </View>
        </BlurCard>
      </ScrollView>

      {/* Scope Selection Modal */}
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
                          numberOfLines={1}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ReportsPageTheme.screenBackground,
  },
  fixedHeader: {
    paddingHorizontal: ReportsPageTheme.contentPaddingHorizontal,
    gap: 10,
    paddingBottom: 6,
  },
  content: {
    paddingHorizontal: ReportsPageTheme.contentPaddingHorizontal,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(4),
    marginTop: verticalScale(6),
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  backButton: {
    width: scale(36),
    height: verticalScale(36),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  screenTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray2,
  },
  printButton: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
  },
  scopeDropdown: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    gap: 6,
    shadowColor: "#317667",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  scopeDropdownLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: ChickIntelPalette.gray2,
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
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  scopeDropdownPill: {
    width: scale(36),
    height: verticalScale(14),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(51, 51, 51, 0.12)",
  },
  periodBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 14,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    gap: 8,
  },
  periodLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  periodSegmented: {
    flexDirection: "row",
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  periodItem: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(6),
    borderRadius: 8,
  },
  periodItemActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  periodText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  periodTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: moderateScale(8),
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
    paddingHorizontal: moderateScale(8),
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 16,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
    shadowColor: "#317667",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 2,
  },
  kpiIconWrap: {
    width: scale(28),
    height: verticalScale(28),
    borderRadius: 8,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.gray2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  kpiSubtext: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.green1,
    fontWeight: "600",
  },

  // Card & Donut Chart
  glassCard: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    shadowColor: "#317667",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: scale(0), height: verticalScale(6) },
    elevation: 4,
  },
  glassCardDark: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cardSurface: {
    borderRadius: ReportsPageTheme.cardInnerRadius,
    padding: ReportsPageTheme.cardInnerPadding,
    borderWidth: 1,
    overflow: "hidden",
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardIconBadge: {
    width: scale(34),
    height: verticalScale(34),
    borderRadius: 10,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    flex: 1,
  },
  chartWrapper: {
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(14),
    borderRadius: 16,
    backgroundColor: "rgba(244, 248, 247, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.1)",
  },
  donutContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  donutSvgWrap: {
    width: 150,
    height: 150,
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
    fontFamily: ChickFont.display,
    fontWeight: "800",
    fontSize: responsiveFontSize(22),
    color: ChickIntelPalette.gray1,
  },
  donutCenterLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.gray2,
  },
  breakdownList: {
    width: "100%",
    gap: 10,
  },
  breakdownRowContainer: {
    gap: 4,
  },
  breakdownRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    textTransform: "capitalize",
  },
  breakdownValueText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  progressTrack: {
    height: 6,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Smart Insights Card
  insightCard: {
    backgroundColor: "rgba(49, 118, 103, 0.07)",
    borderRadius: 14,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
    gap: 6,
  },
  insightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightIconBadge: {
    width: scale(22),
    height: verticalScale(22),
    borderRadius: 6,
    backgroundColor: "rgba(49, 118, 103, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  insightBodyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    color: ChickIntelPalette.gray1,
  },

  // Scope Modal
  scopeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
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
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
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
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  scopeOptionTextSelected: {
    color: ChickIntelPalette.green1,
    fontWeight: "700",
  },
  scopeOptionPill: {
    width: scale(36),
    height: verticalScale(14),
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
