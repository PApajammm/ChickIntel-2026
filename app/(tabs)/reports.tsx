import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import {
    ChickSelectionModal,
    ChickSelectRow,
} from "@/components/ui/chick-form";
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
import {
    fetchFarmReportSnapshot,
    type FarmReportSnapshot,
    type ReportDonutSlice,
    type ReportOverview,
    type ReportProductionType,
    type ReportSupplyType,
} from "@/utils/supabase-reports";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

const OVERVIEW_OPTIONS: ReportOverview[] = ["Weekly", "Monthly", "Annually"];
const TYPE_OPTIONS: ReportProductionType[] = ["Eggs", "Chickens"];
const SUPPLY_OPTIONS: ReportSupplyType[] = ["Vitamins & Meds", "Feeds"];
const PRINT_SCOPES = ["Egg & Chicken", "Vitamins & Meds", "Feeds"] as const;

type PrintScopeOption = (typeof PRINT_SCOPES)[number];

const PAGE_SIZE_CONFIG: Record<
  string,
  { width: number; height: number; printLabel: string }
> = {
  A4: { width: 1240, height: 1754, printLabel: "A4 portrait" },
  Letter: { width: 1275, height: 1650, printLabel: "Letter portrait" },
  Legal: { width: 1275, height: 2100, printLabel: "Legal portrait" },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function donutSvgFor(snapshot: FarmReportSnapshot["production"]) {
  const segments = snapshot.slices
    .map((slice, index) => {
      const percent =
        snapshot.total > 0 ? (slice.count / snapshot.total) * 100 : 0;
      const circumference = 2 * Math.PI * 78;
      const strokeLength = (percent / 100) * circumference;
      const previousPercent = snapshot.slices
        .slice(0, index)
        .reduce(
          (sum, current) =>
            sum +
            (snapshot.total > 0 ? (current.count / snapshot.total) * 100 : 0),
          0,
        );
      const dashOffset =
        circumference - (previousPercent / 100) * circumference;
      return `<circle cx="110" cy="110" r="78" fill="none" stroke="${escapeHtml(slice.color)}" stroke-width="28" stroke-linecap="round" stroke-dasharray="${strokeLength.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 110 110)"></circle>`;
    })
    .join("");

  return `
        <svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Production donut chart">
            <circle cx="110" cy="110" r="78" fill="none" stroke="#e7f1eb" stroke-width="28"></circle>
            ${segments}
            <circle cx="110" cy="110" r="50" fill="white"></circle>
            <text x="110" y="102" text-anchor="middle" font-size="28" font-weight="700" fill="#203029">${snapshot.total}</text>
            <text x="110" y="132" text-anchor="middle" font-size="12" fill="#688078">Total</text>
        </svg>`;
}

function legendFor(snapshot: FarmReportSnapshot["production"]) {
  return snapshot.slices
    .map((slice) => {
      return `<div class="legend-row"><span class="swatch" style="background:${escapeHtml(slice.color)}"></span><span>${escapeHtml(slice.label)} ${escapeHtml(slice.displayPercent)}</span></div>`;
    })
    .join("");
}

function rowsFor(snapshot: FarmReportSnapshot["production"]) {
  return snapshot.slices
    .map(
      (slice) => `
                <tr>
                    <td>${escapeHtml(slice.label)}</td>
                    <td>${slice.count}</td>
                    <td>${escapeHtml(slice.displayPercent)}</td>
                </tr>`,
    )
    .join("");
}

function renderProductionSection(snapshot: FarmReportSnapshot["production"]) {
  return `
                <div class="section">
                    <h2 class="section-title">${escapeHtml(snapshot.title)}</h2>
                    <div class="chart-shell">
                        <div>${donutSvgFor(snapshot)}</div>
                        <div class="legend">${legendFor(snapshot)}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Count</th>
                                <th>Percent</th>
                            </tr>
                        </thead>
                        <tbody>${rowsFor(snapshot)}</tbody>
                    </table>
                    <div class="analytics">${escapeHtml(snapshot.analyticsText)}</div>
                </div>`;
}

function barChartHtmlFor(supply: FarmReportSnapshot["supply"]) {
  if (!supply.bars.length) {
    return `<div class="analytics">No supply bar chart data available.</div>`;
  }

  const maxY = supply.maxY || 10;
  const axisValues = [maxY, Math.round(maxY / 2), 0];

  const barsHtml = supply.bars
    .map((bar) => {
      const heightPercent =
        maxY > 0 ? Math.min((bar.value / maxY) * 100, 100) : 0;
      const barColor = bar.highlight ? "#203029" : "#317667";
      return `
        <div class="bar-col">
          <div class="bar-val">${bar.value}</div>
          <div class="bar-track">
            <div class="bar-fill" style="height: ${heightPercent.toFixed(1)}%; background: ${barColor};"></div>
          </div>
          <div class="bar-label">${escapeHtml(bar.label)}</div>
        </div>`;
    })
    .join("");

  return `
    <div class="bar-chart-container">
      <div class="grid-lines-bg">
        ${axisValues
          .map(
            (v) =>
              `<div class="grid-row"><span>${v}</span><div class="line"></div></div>`,
          )
          .join("")}
      </div>
      <div class="bars-flex">
        ${barsHtml}
      </div>
    </div>`;
}

function renderSupplySection(supply: FarmReportSnapshot["supply"]) {
  const supplyRows =
    supply.bars.length > 0
      ? supply.bars
          .map(
            (bar) => `
                <tr>
                    <td>${escapeHtml(bar.label)}</td>
                    <td>${bar.value}</td>
                    <td>${bar.highlight ? "Highlighted Usage" : "Normal"}</td>
                </tr>`,
          )
          .join("")
      : `<tr><td colspan="3">No supply data available.</td></tr>`;

  return `
    <div class="section">
        <h2 class="section-title">${escapeHtml(supply.title)}</h2>
        ${barChartHtmlFor(supply)}
        <table>
            <thead>
                <tr>
                    <th>Item / Period</th>
                    <th>Quantity / Usage</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>${supplyRows}</tbody>
        </table>
        <div class="analytics">${escapeHtml(supply.analyticsText)}</div>
    </div>`;
}

function buildPrintableHtml({
  farmName,
  generatedBy,
  generatedDate,
  generatedTime,
  overview,
  productionType,
  supplyType,
  report,
  pageSize,
  printScope,
  secondaryProductionReport,
}: {
  farmName: string;
  generatedBy: string;
  generatedDate: string;
  generatedTime: string;
  overview: ReportOverview;
  productionType: ReportProductionType;
  supplyType: ReportSupplyType;
  report: FarmReportSnapshot;
  pageSize: string;
  printScope: PrintScopeOption;
  secondaryProductionReport?: FarmReportSnapshot;
}) {
  const renderCategorySheet = (
    sectionHtml: string,
    prodTypeLabel: string,
    suppTypeLabel: string,
    pageIndex: number,
    totalPages: number,
    isLastPage: boolean,
  ) => `
      <div class="sheet ${isLastPage ? "" : "page-break"}">
          <div class="header">
              <div>
                  <h1 class="title">ChickInteL Report</h1>
                  <p class="subtitle">Printable farm report sized for ${escapeHtml(pageSize)}</p>
              </div>
              <div class="meta-card">
                  <div class="meta-label">Generated By</div>
                  <div class="meta-value">${escapeHtml(generatedBy)}</div>
              </div>
          </div>
          <div class="meta-grid">
              <div class="meta-card"><div class="meta-label">Farm</div><div class="meta-value">${escapeHtml(farmName)}</div></div>
              <div class="meta-card"><div class="meta-label">Date</div><div class="meta-value">${escapeHtml(generatedDate)}</div></div>
              <div class="meta-card"><div class="meta-label">Time</div><div class="meta-value">${escapeHtml(generatedTime)}</div></div>
              <div class="meta-card"><div class="meta-label">Overview</div><div class="meta-value">${escapeHtml(overview)}</div></div>
              <div class="meta-card"><div class="meta-label">Production</div><div class="meta-value">${escapeHtml(prodTypeLabel)}</div></div>
              <div class="meta-card"><div class="meta-label">Supply</div><div class="meta-value">${escapeHtml(suppTypeLabel)}</div></div>
          </div>
          ${sectionHtml}
          <div class="footer">Generated from ChickInteL report data. Page ${pageIndex} of ${totalPages}</div>
      </div>`;

  let sheetsHtml = "";

  if (printScope === "Egg & Chicken" && secondaryProductionReport) {
    const eggSectionHtml = renderProductionSection(report.production);
    const chickenSectionHtml = renderProductionSection(
      secondaryProductionReport.production,
    );

    sheetsHtml = `
      ${renderCategorySheet(eggSectionHtml, "Eggs", supplyType, 1, 2, false)}
      ${renderCategorySheet(chickenSectionHtml, "Chickens", supplyType, 2, 2, true)}
    `;
  } else if (printScope === "Egg & Chicken") {
    const eggSectionHtml = renderProductionSection(report.production);
    sheetsHtml = renderCategorySheet(
      eggSectionHtml,
      productionType,
      supplyType,
      1,
      1,
      true,
    );
  } else {
    const supplySectionHtml = renderSupplySection(report.supply);
    sheetsHtml = renderCategorySheet(
      supplySectionHtml,
      productionType,
      printScope,
      1,
      1,
      true,
    );
  }

  return `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <style>
                @page {
                    size: ${PAGE_SIZE_CONFIG[pageSize]?.printLabel || "A4 portrait"};
                    margin: 0;
                }
                * { box-sizing: border-box; }
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    font-family: Arial, sans-serif;
                    color: #203029;
                    background: #f4faf7;
                }
                body {
                    padding: 22px;
                }
                .page-break {
                    page-break-after: always;
                    break-after: page;
                }
                .sheet {
                    min-height: calc(100vh - 44px);
                    width: 100%;
                    background: linear-gradient(180deg, #fcfffd 0%, #eef7f2 100%);
                    border: 1px solid #dcebe5;
                    border-radius: 20px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                }
                .title {
                    font-size: 28px;
                    font-weight: 700;
                    margin: 0 0 6px;
                }
                .subtitle {
                    font-size: 13px;
                    color: #4f645c;
                    margin: 0;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                }
                .meta-card, .section {
                    background: rgba(255,255,255,0.86);
                    border: 1px solid #dbe9e4;
                    border-radius: 16px;
                    padding: 14px 16px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .bar-chart-container {
                    position: relative;
                    height: 160px;
                    margin: 14px 0;
                    padding-left: 28px;
                }
                .grid-lines-bg {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 22px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .grid-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    color: #688078;
                }
                .grid-row .line {
                    flex: 1;
                    height: 1px;
                    background: #e4efea;
                }
                .bars-flex {
                    position: relative;
                    z-index: 2;
                    height: 100%;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-around;
                    padding-left: 8px;
                    padding-bottom: 22px;
                }
                .bar-col {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                    justify-content: flex-end;
                    flex: 1;
                    max-width: 48px;
                }
                .bar-val {
                    font-size: 10px;
                    font-weight: 700;
                    color: #317667;
                    margin-bottom: 4px;
                }
                .bar-track {
                    width: 100%;
                    max-width: 24px;
                    height: 100%;
                    display: flex;
                    align-items: flex-end;
                    background: rgba(49, 118, 103, 0.08);
                    border-radius: 4px 4px 0 0;
                }
                .bar-fill {
                    width: 100%;
                    border-radius: 4px 4px 0 0;
                }
                .bar-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #203029;
                    margin-top: 6px;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    overflow: hidden;
                    max-width: 100%;
                }
                .meta-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                    color: #688078;
                    margin-bottom: 6px;
                }
                .meta-value {
                    font-size: 16px;
                    font-weight: 700;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0 0 10px;
                }
                .chart-shell {
                    display: flex;
                    gap: 18px;
                    align-items: center;
                    justify-content: center;
                    flex-wrap: wrap;
                    margin: 12px 0 10px;
                }
                .legend {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    min-width: 180px;
                }
                .legend-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: #466058;
                    text-transform: capitalize;
                }
                .swatch {
                    width: 10px;
                    height: 10px;
                    border-radius: 999px;
                    display: inline-block;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    text-align: left;
                    padding: 10px 8px;
                    border-bottom: 1px solid #e4efea;
                    font-size: 13px;
                }
                th {
                    font-size: 12px;
                    color: #587068;
                    text-transform: uppercase;
                    letter-spacing: .04em;
                }
                .analytics {
                    margin-top: 10px;
                    font-size: 13px;
                    line-height: 1.5;
                    color: #466058;
                }
                .footer {
                    margin-top: auto;
                    padding-top: 8px;
                    font-size: 12px;
                    color: #5e746c;
                }
            </style>
        </head>
        <body>
            ${sheetsHtml}
        </body>
    </html>`;
}

const EMPTY_REPORT: FarmReportSnapshot = {
  production: {
    title: "Production Overview",
    total: 0,
    slices: [
      { label: "hatched", count: 0, displayPercent: "0%", color: "#323330" },
      { label: "unhatched", count: 0, displayPercent: "0%", color: "#438b7b" },
      { label: "damaged", count: 0, displayPercent: "0%", color: "#9cd5c9" },
    ],
    analyticsText: "No report data is available yet.",
  },
  supply: {
    title: "Supply Activity",
    bars: [],
    maxY: 10,
    analyticsText: "No supply data is available yet.",
  },
};

function ReportDropdown({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <ChickSelectRow
      label={label.replace(":", "")}
      value={value}
      onPress={onOpen}
      style={{ marginBottom: 8 }}
      rowStyle={styles.compactDropdownRow}
      labelStyle={styles.compactDropdownLabel}
    />
  );
}

function PrintModal({
  visible,
  onClose,
  selectedPrintScope,
  onSelectPrintScope,
  onPrintReport,
  printingReport,
}: {
  visible: boolean;
  onClose: () => void;
  selectedPrintScope: PrintScopeOption;
  onSelectPrintScope: (scope: PrintScopeOption) => void;
  onPrintReport: () => void;
  printingReport: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.printModalRoot}>
        <Pressable
          style={styles.printModalScrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss print dialog"
        />
        <View style={styles.printModalCenter} pointerEvents="box-none">
          <View style={styles.printModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Print Report</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={ChickIntelPalette.gray1}
                />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>What to print</Text>
            <View style={styles.chipRow}>
              {PRINT_SCOPES.map((entry) => (
                <TouchableOpacity
                  key={entry}
                  style={[
                    styles.chip,
                    entry === selectedPrintScope && styles.chipSelected,
                  ]}
                  onPress={() => onSelectPrintScope(entry)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      entry === selectedPrintScope && styles.chipTextSelected,
                    ]}
                  >
                    {entry}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.printBtn}
              onPress={onPrintReport}
              disabled={printingReport}
            >
              <MaterialCommunityIcons
                name="printer-outline"
                size={20}
                color="#FFF"
              />
              <Text style={styles.printBtnText}>
                {printingReport ? "Opening print dialog..." : "Print"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={onClose}
            >
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
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
                  strokeLinecap="butt"
                />
              );
            })}
          </G>
        </Svg>

        <View style={styles.donutCenterWrap}>
          <View style={styles.donutCenterValueWrap}>
            <Text style={styles.donutCenterValue}>{total}</Text>
          </View>
          <Text style={styles.donutCenterLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.donutSummaryRow}>
        {slices.map((slice) => (
          <View key={`${slice.label}-summary`} style={styles.donutSummaryChip}>
            <View
              style={[
                styles.donutSummarySwatch,
                { backgroundColor: slice.color },
              ]}
            />
            <Text style={styles.donutSummaryText}>
              {slice.label}: {slice.displayPercent}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.donutLegend}>
        {slices.map((slice) => (
          <View key={`${slice.label}-legend`} style={styles.donutLegendRow}>
            <View style={styles.donutLegendLeft}>
              <View
                style={[
                  styles.donutLegendSwatch,
                  { backgroundColor: slice.color },
                ]}
              />
              <Text style={styles.donutLegendLabel}>{slice.label}</Text>
            </View>
            <Text style={styles.donutLegendValue}>
              {slice.count} ({slice.displayPercent})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
function ConsumptionBarChart({
  bars,
  maxY,
}: {
  bars: FarmReportSnapshot["supply"]["bars"];
  maxY: number;
}) {
  const graphHeight = 140;
  const axisValues = [maxY, Math.round(maxY / 2), 0];
  const barWidth = bars.length > 10 ? 18 : bars.length > 7 ? 20 : 24;

  return (
    <View style={styles.barGraphContainer}>
      <View style={styles.gridLinesWrap}>
        {axisValues.map((value) => (
          <View key={value} style={styles.gridLineRow}>
            <Text style={styles.yAxisText}>{value}</Text>
            <View style={styles.gridLine} />
          </View>
        ))}
      </View>

      <View style={styles.barsWrap}>
        {bars.map((item) => {
          const barHeight =
            maxY > 0
              ? Math.min((item.value / maxY) * graphHeight, graphHeight)
              : 0;

          return (
            <View
              key={item.key}
              style={[styles.barCol, { width: barWidth + 8 }]}
            >
              <View
                style={[
                  styles.barFill,
                  { height: barHeight, width: barWidth },
                  item.highlight ? styles.barFillHighlight : null,
                ]}
              />
              <Text style={styles.xAxisText}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { activeFarm, profile } = useAuth();
  const isDark = colorScheme === "dark";
  const activeFarmId = activeFarm?.id;

  const [overview, setOverview] = useState<ReportOverview>("Weekly");
  const [prodType, setProdType] = useState<ReportProductionType>("Eggs");
  const [supplyType, setSupplyType] =
    useState<ReportSupplyType>("Vitamins & Meds");
  const [report, setReport] = useState<FarmReportSnapshot>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectionModal, setSelectionModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    value: string;
    setter: (value: string) => void;
  }>({
    visible: false,
    title: "",
    options: [],
    value: "",
    setter: () => {},
  });
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printScope, setPrintScope] =
    useState<PrintScopeOption>("Egg & Chicken");
  const [printingReport, setPrintingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  async function handlePrintReport() {
    setSaveError(null);
    setSaveMessage(null);
    setPrintingReport(true);

    try {
      let printableReport = report;
      let secondaryProductionReport: FarmReportSnapshot | undefined;

      if (printScope === "Egg & Chicken" && activeFarm?.id) {
        const [eggReport, chickenReport] = await Promise.all([
          fetchFarmReportSnapshot({
            farmId: activeFarm.id,
            overview,
            productionType: "Eggs",
            supplyType,
          }),
          fetchFarmReportSnapshot({
            farmId: activeFarm.id,
            overview,
            productionType: "Chickens",
            supplyType,
          }),
        ]);

        printableReport = eggReport;
        secondaryProductionReport = chickenReport;
      }

      const html = buildPrintableHtml({
        farmName: activeFarm?.name || "No active farm",
        generatedBy,
        generatedDate,
        generatedTime,
        overview,
        productionType: prodType,
        supplyType,
        report: printableReport,
        pageSize: "A4",
        printScope,
        secondaryProductionReport,
      });

      await Print.printAsync({
        html,
        orientation: "portrait",
      });

      setSaveMessage(``);
      setPrintModalVisible(false);
    } catch (printError) {
      setSaveError(
        printError instanceof Error
          ? printError.message
          : "Unable to print report.",
      );
    } finally {
      setPrintingReport(false);
    }
  }

  useEffect(() => {
    if (!activeFarmId) {
      setReport(EMPTY_REPORT);
      return;
    }

    const farmId = activeFarmId;

    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError(null);

      try {
        const nextReport = await fetchFarmReportSnapshot({
          farmId,
          overview,
          productionType: prodType,
          supplyType,
        });

        if (!cancelled) {
          setReport(nextReport);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load report data.",
          );
          setReport(EMPTY_REPORT);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [activeFarmId, overview, prodType, supplyType]);

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

      <View style={styles.viewShot}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 120,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Reports</Text>
            <Pressable
              style={styles.printButton}
              onPress={() => setPrintModalVisible(true)}
            >
              <MaterialCommunityIcons
                name="printer-outline"
                size={24}
                color={ChickIntelPalette.gray1}
              />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={ChickIntelPalette.green1} />
              <Text style={styles.statusText}>Loading report data...</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          {saveMessage ? (
            <Text style={styles.successText}>{saveMessage}</Text>
          ) : null}

          <BlurCard
            style={[styles.heroCard, isDark && styles.heroCardDark]}
            borderRadius={20}
            intensity={18}
            transparent
          >
            <View style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroTitleWrap}>
                  <View style={styles.heroIconBadge}>
                    <MaterialCommunityIcons
                      name="chart-box-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                  <View style={styles.heroCopy}>
                    <Text style={styles.heroEyebrow}>
                      Farm performance snapshot
                    </Text>
                    <Text style={styles.heroTitle}>Your reports, elevated</Text>
                  </View>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{overview}</Text>
                </View>
              </View>

              <View style={styles.heroMetaGrid}>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>Farm</Text>
                  <Text style={styles.heroMetaValue}>
                    {activeFarm?.name || "No active farm"}
                  </Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>Generated</Text>
                  <Text style={styles.heroMetaValue}>{generatedDate}</Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>By</Text>
                  <Text style={styles.heroMetaValue}>{generatedBy}</Text>
                </View>
              </View>
            </View>
          </BlurCard>

          <BlurCard
            style={[styles.reportCard, isDark && styles.reportCardDark]}
            borderRadius={18}
            intensity={16}
            transparent
          >
            <View
              style={[
                styles.cardSurface,
                {
                  backgroundColor: "transparent",
                  borderColor: glassBorder,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWrap}>
                  <View style={styles.cardIconBadge}>
                    <MaterialCommunityIcons
                      name="egg-outline"
                      size={16}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                  <Text style={styles.cardTitle}>
                    {report.production.title}
                  </Text>
                </View>
                <View style={styles.cardHeaderPill}>
                  <Text style={styles.cardHeaderPillText}>{prodType}</Text>
                </View>
              </View>
              <ReportDropdown
                label="Overview:"
                value={overview}
                onOpen={() =>
                  setSelectionModal({
                    visible: true,
                    title: "Select Overview",
                    options: OVERVIEW_OPTIONS,
                    value: overview,
                    setter: (value) => setOverview(value as ReportOverview),
                  })
                }
              />
              <ReportDropdown
                label="Type:"
                value={prodType}
                onOpen={() =>
                  setSelectionModal({
                    visible: true,
                    title: "Select Type",
                    options: TYPE_OPTIONS,
                    value: prodType,
                    setter: (value) =>
                      setProdType(value as ReportProductionType),
                  })
                }
              />

              <View style={styles.chartWrapper}>
                <DonutChart
                  slices={report.production.slices}
                  total={report.production.total}
                />
              </View>

              <Text style={styles.analyticsText}>
                {report.production.analyticsText}
              </Text>
            </View>
          </BlurCard>

          <BlurCard
            style={[styles.reportCard, isDark && styles.reportCardDark]}
            borderRadius={18}
            intensity={16}
            transparent
          >
            <View
              style={[
                styles.cardSurface,
                {
                  backgroundColor: "transparent",
                  borderColor: glassBorder,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWrap}>
                  <View style={styles.cardIconBadge}>
                    <MaterialCommunityIcons
                      name="truck-delivery-outline"
                      size={16}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                  <Text style={styles.cardTitle}>{report.supply.title}</Text>
                </View>
                <View style={styles.cardHeaderPill}>
                  <Text style={styles.cardHeaderPillText}>{supplyType}</Text>
                </View>
              </View>
              <ReportDropdown
                label="Overview:"
                value={overview}
                onOpen={() =>
                  setSelectionModal({
                    visible: true,
                    title: "Select Overview",
                    options: OVERVIEW_OPTIONS,
                    value: overview,
                    setter: (value) => setOverview(value as ReportOverview),
                  })
                }
              />
              <ReportDropdown
                label="Supply:"
                value={supplyType}
                onOpen={() =>
                  setSelectionModal({
                    visible: true,
                    title: "Select Supply",
                    options: SUPPLY_OPTIONS,
                    value: supplyType,
                    setter: (value) => setSupplyType(value as ReportSupplyType),
                  })
                }
              />

              <View style={styles.barChartWrapper}>
                <ConsumptionBarChart
                  bars={report.supply.bars}
                  maxY={report.supply.maxY}
                />
              </View>

              <Text style={styles.analyticsText}>
                {report.supply.analyticsText}
              </Text>
            </View>
          </BlurCard>

          <View style={styles.footerContainer}>
            <Text style={styles.footerLabel}>Report Generation Details</Text>
            <Text style={styles.footerText}>Generated by: {generatedBy}</Text>
            <Text style={styles.footerText}>Date: {generatedDate}</Text>
            <Text style={styles.footerText}>Time: {generatedTime}</Text>
            <Text style={styles.footerText}>
              Location: {activeFarm?.name || "No active farm"}
            </Text>
          </View>
        </ScrollView>
      </View>

      <ChickSelectionModal
        visible={selectionModal.visible}
        title={selectionModal.title}
        options={selectionModal.options}
        value={selectionModal.value}
        onSelect={(value) => selectionModal.setter(value)}
        onClose={() =>
          setSelectionModal((previous) => ({ ...previous, visible: false }))
        }
      />

      <PrintModal
        visible={printModalVisible}
        onClose={() => setPrintModalVisible(false)}
        selectedPrintScope={printScope}
        onSelectPrintScope={setPrintScope}
        onPrintReport={handlePrintReport}
        printingReport={printingReport}
      />
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
  viewShot: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: ReportsPageTheme.headerPaddingHorizontal,
    marginTop: ReportsPageTheme.headerTopMargin,
    marginBottom: ReportsPageTheme.headerBottomMargin,
  },
  printButton: {
    width: ReportsPageTheme.printButtonSize,
    height: ReportsPageTheme.printButtonSize,
    borderRadius: ReportsPageTheme.printButtonRadius,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    shadowColor: "#317667",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 3,
  },
  screenTitle: {
    ...ReportsPageTheme.screenTitle,
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
  successText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(12),
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.84)",
    shadowColor: "#317667",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 4,
  },
  heroCardDark: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  heroContent: {
    padding: moderateScale(16),
    gap: 12,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  heroIconBadge: {
    width: scale(38),
    height: verticalScale(38),
    borderRadius: 12,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  heroTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.3,
  },
  heroBadge: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderRadius: 999,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  heroBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  heroMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroMetaItem: {
    flex: 1,
    minWidth: scale(90),
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(10),
    borderRadius: 12,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.12)",
  },
  heroMetaLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.gray2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  heroMetaValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  reportCard: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    shadowColor: "#317667",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: scale(0), height: verticalScale(6) },
    elevation: 4,
  },
  reportCardDark: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cardSurface: {
    borderRadius: ReportsPageTheme.cardInnerRadius,
    padding: ReportsPageTheme.cardInnerPadding,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
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
    fontSize: responsiveFontSize(17),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    flexShrink: 1,
  },
  cardHeaderPill: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderRadius: 999,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  cardHeaderPillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    textTransform: "capitalize",
  },
  printModalRoot: {
    flex: 1,
    position: "relative",
  },
  printModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(51, 51, 51, 0.5)",
  },
  printModalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: moderateScale(20),
    paddingVertical: verticalScale(24),
  },
  printModalCard: {
    width: "100%",
    maxWidth: scale(420),
    alignSelf: "center",
    backgroundColor: ChickIntelPalette.light1,
    borderRadius: ReportsPageTheme.modalRadius,
    padding: ReportsPageTheme.modalPadding,
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: scale(0), height: verticalScale(10) },
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: ReportsPageTheme.modalHeaderSpacing,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    marginBottom: 0,
  },
  sectionLabel: {
    fontFamily: ReportsCardTheme.sectionTitleFontFamily,
    fontSize: ReportsCardTheme.sectionTitleFontSize,
    fontWeight: ReportsCardTheme.sectionTitleFontWeight,
    color: ReportsCardTheme.sectionTitleColor,
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(7),
    borderRadius: ReportsCardTheme.chipRadius,
    backgroundColor: "#F0F2F2",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  chipText: {
    fontFamily: ReportsCardTheme.chipFontFamily,
    fontSize: ReportsCardTheme.chipFontSize,
    color: ReportsCardTheme.chipTextColor,
  },
  chipTextSelected: {
    color: ReportsCardTheme.chipSelectedTextColor,
    fontWeight: ReportsCardTheme.chipFontWeight,
  },
  printBtn: {
    backgroundColor: ChickIntelPalette.green1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    borderRadius: 5,
    marginTop: 24,
    gap: 8,
  },
  printBtnText: {
    color: "#FFF",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
  },
  secondaryActionBtn: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    borderRadius: 5,
    gap: 8,
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
    backgroundColor: "#F7FBFA",
  },
  secondaryActionText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
  },
  compactDropdownRow: {
    minHeight: ReportsPageTheme.dropdownRowHeight,
    paddingVertical: ReportsPageTheme.dropdownRowPaddingVertical,
    paddingHorizontal: moderateScale(12),
    borderRadius: ReportsPageTheme.dropdownRowRadius,
    marginBottom: 6,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
  },
  compactDropdownLabel: {
    color: ReportsPageTheme.dropdownLabelColor,
    fontWeight: "700",
  },
  chartWrapper: {
    alignItems: "center",
    marginTop: ReportsPageTheme.chartTopMargin,
    marginBottom: 0,
    minHeight: ReportsPageTheme.chartHeight,
    justifyContent: "center",
    paddingVertical: verticalScale(10),
    borderRadius: 16,
    backgroundColor: "rgba(244, 248, 247, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.1)",
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
  donutCenterValueWrap: {
    backgroundColor: "transparent",
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(4),
    borderRadius: 6,
    marginBottom: 2,
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
    maxWidth: scale(260),
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
  donutLegend: {
    marginTop: 4,
    gap: 8,
    width: "100%",
    maxWidth: scale(240),
    alignSelf: "center",
  },
  donutLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  donutLegendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  donutLegendSwatch: {
    width: scale(12),
    height: verticalScale(12),
    borderRadius: 999,
  },
  donutLegendLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    textTransform: "capitalize",
  },
  donutLegendValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  barChartWrapper: {
    marginTop: 14,
    paddingTop: 6,
    paddingBottom: verticalScale(4),
    paddingHorizontal: moderateScale(2),
    borderRadius: 16,
    backgroundColor: "rgba(244, 248, 247, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.1)",
  },
  barGraphContainer: {
    height: verticalScale(180),
    position: "relative",
    paddingLeft: 24,
  },
  gridLinesWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: "space-between",
  },
  gridLineRow: {
    flexDirection: "row",
    alignItems: "center",
    height: verticalScale(20),
  },
  yAxisText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: "#888",
    width: scale(24),
  },
  gridLine: {
    flex: 1,
    height: verticalScale(1),
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  barsWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: "100%",
    paddingLeft: 4,
  },
  barCol: {
    alignItems: "center",
  },
  barFill: {
    backgroundColor: "#81BDB0",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: 6,
  },
  barFillHighlight: {
    backgroundColor: "#323330",
  },
  xAxisText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: "#666",
  },
  analyticsText: {
    fontFamily: ReportsCardTheme.footerTextFontFamily,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    color: ReportsPageTheme.analyticsTextColor,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    backgroundColor: "rgba(244, 248, 247, 0.48)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
    paddingBottom: verticalScale(6),
  },
  footerContainer: {
    marginTop: ReportsPageTheme.footerTopMargin,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
  },
  footerLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  footerText: {
    fontFamily: ReportsCardTheme.footerTextFontFamily,
    fontSize: ReportsCardTheme.footerTextFontSize,
    lineHeight: ReportsCardTheme.footerTextLineHeight,
    color: ReportsCardTheme.footerTextColor,
    marginBottom: 2,
    textAlign: "center",
  },
  hiddenExportRoot: {
    position: "absolute",
    opacity: 0.01,
    left: -2000,
    top: 0,
  },
  exportSheet: {
    backgroundColor: "#F3FAF6",
    borderRadius: 28,
    padding: moderateScale(36),
    borderWidth: 1,
    borderColor: "#D8EAE2",
    gap: 24,
  },
  exportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
  },
  exportTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(46),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  exportSubtitle: {
    marginTop: 8,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(20),
    color: "#5B746B",
  },
  exportBadge: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DAEAE3",
    paddingVertical: verticalScale(16),
    paddingHorizontal: moderateScale(18),
    minWidth: scale(260),
  },
  exportBadgeLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: "#678077",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exportBadgeValue: {
    marginTop: 6,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    color: ChickIntelPalette.gray1,
  },
  exportMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  exportMetaCard: {
    width: "31%",
    minWidth: scale(220),
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DAEAE3",
    paddingVertical: verticalScale(16),
    paddingHorizontal: moderateScale(18),
  },
  exportMetaLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: "#678077",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exportMetaValue: {
    marginTop: 8,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    color: ChickIntelPalette.gray1,
  },
  exportSection: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DAEAE3",
    padding: moderateScale(24),
  },
  exportSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(30),
    color: ChickIntelPalette.gray1,
    marginBottom: 18,
  },
  exportChartArea: {
    alignItems: "center",
    minHeight: verticalScale(470),
    justifyContent: "center",
  },
  exportBarArea: {
    minHeight: verticalScale(320),
    justifyContent: "center",
  },
  exportAnalyticsText: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E4EFEA",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    color: "#49635A",
  },
  exportFooter: {
    marginTop: "auto",
    textAlign: "center",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(18),
    color: "#5B746B",
  },
});
