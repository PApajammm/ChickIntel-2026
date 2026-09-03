import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { ReportsCardTheme, ReportsPageTheme } from "@/constants/reports-theme";
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
import { useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

const OVERVIEW_OPTIONS: ReportOverview[] = ["Weekly", "Monthly", "Annually"];
const TYPE_OPTIONS: ReportProductionType[] = ["Eggs", "Chickens"];
const SUPPLY_OPTIONS: ReportSupplyType[] = ["Vitamins & Meds", "Feeds"];

const PRINT_SCOPES = [
  "All Categories (Multi-Page)",
  "Eggs Only",
  "Chickens Only",
  "Vitamins & Meds Only",
  "Feeds Only",
] as const;

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
      return `<circle cx="110" cy="110" r="78" fill="none" stroke="${escapeHtml(slice.color)}" stroke-width="26" stroke-dasharray="${strokeLength.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 110 110)"></circle>`;
    })
    .join("");

  return `
    <svg width="190" height="190" viewBox="0 0 220 220" role="img" aria-label="Production donut chart">
        <circle cx="110" cy="110" r="78" fill="none" stroke="#e8f3ee" stroke-width="26"></circle>
        ${segments}
        <circle cx="110" cy="110" r="52" fill="white"></circle>
        <text x="110" y="104" text-anchor="middle" font-size="28" font-weight="800" fill="#203029">${snapshot.total.toLocaleString()}</text>
        <text x="110" y="128" text-anchor="middle" font-size="12" font-weight="600" fill="#688078">Total Count</text>
    </svg>`;
}

function renderProductionSection(
  title: string,
  categoryIcon: string,
  snapshot: FarmReportSnapshot["production"],
) {
  const rows = snapshot.slices
    .map((slice) => {
      const percentVal =
        snapshot.total > 0
          ? Math.round((slice.count / snapshot.total) * 100)
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

  const topSlice = snapshot.slices.reduce(
    (max, item) => (item.count > max.count ? item : max),
    snapshot.slices[0] || { label: "N/A", count: 0, displayPercent: "0%" },
  );

  return `
    <div class="category-header">
      <div class="category-title-wrap">
        <span class="category-badge">${categoryIcon}</span>
        <h2 class="category-title">${escapeHtml(title)}</h2>
      </div>
      <div class="category-tag">Production Category Page</div>
    </div>

    <!-- Top KPI Grid -->
    <div class="kpi-banner">
      <div class="kpi-box">
        <div class="kpi-title">TOTAL VOLUME</div>
        <div class="kpi-value">${snapshot.total.toLocaleString()}</div>
        <div class="kpi-sub">Total Units Recorded</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">PRIMARY OUTCOME</div>
        <div class="kpi-value" style="text-transform: capitalize;">${escapeHtml(topSlice.label)}</div>
        <div class="kpi-sub">${escapeHtml(topSlice.displayPercent)} (${topSlice.count.toLocaleString()} units)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">REPORT STATUS</div>
        <div class="kpi-value" style="color: #317667;">Verified</div>
        <div class="kpi-sub">ChickInteL Analytics</div>
      </div>
    </div>

    <!-- Chart + Breakdown Section -->
    <div class="section-card">
      <div class="chart-flex-layout">
        <div class="chart-visual-box">
          ${donutSvgFor(snapshot)}
        </div>
        <div class="chart-details-box">
          <div class="details-heading">Distribution Breakdown</div>
          <table class="data-table">
              <thead>
                  <tr>
                      <th>Category</th>
                      <th style="text-align: right;">Count</th>
                      <th style="text-align: right;">Share</th>
                      <th style="width: 35%;">Ratio Bar</th>
                  </tr>
              </thead>
              <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Insight Box -->
    <div class="insight-box">
      <div class="insight-title">💡 Operational Takeaway & Analysis</div>
      <div class="insight-text">${escapeHtml(snapshot.analyticsText)}</div>
    </div>`;
}

function barChartHtmlFor(supply: FarmReportSnapshot["supply"]) {
  if (!supply.bars.length) {
    return `<div class="empty-state">No supply activity recorded for this period.</div>`;
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

function renderSupplySection(
  title: string,
  categoryIcon: string,
  supply: FarmReportSnapshot["supply"],
) {
  if (supply.slices && supply.slices.length > 0) {
    return renderProductionSection(title, categoryIcon, {
      title,
      total:
        supply.totalSlices ??
        supply.slices.reduce((sum, s) => sum + s.count, 0),
      slices: supply.slices,
      analyticsText: supply.analyticsText,
    });
  }

  const totalQty = supply.bars.reduce((sum, b) => sum + b.value, 0);
  const peakBar = supply.bars.reduce(
    (max, b) => (b.value > max.value ? b : max),
    supply.bars[0] || { label: "N/A", value: 0 },
  );

  const supplyRows =
    supply.bars.length > 0
      ? supply.bars
          .map(
            (bar) => `
                <tr>
                    <td style="font-weight: 700;">${escapeHtml(bar.label)}</td>
                    <td style="font-weight: 700; text-align: right;">${bar.value.toLocaleString()}</td>
                    <td style="text-align: center;">
                      <span class="status-badge ${bar.highlight ? "status-peak" : "status-normal"}">
                        ${bar.highlight ? "Peak Usage" : "Normal Usage"}
                      </span>
                    </td>
                </tr>`,
          )
          .join("")
      : `<tr><td colspan="3" style="text-align: center; color: #888;">No supply records available.</td></tr>`;

  return `
    <div class="category-header">
      <div class="category-title-wrap">
        <span class="category-badge">${categoryIcon}</span>
        <h2 class="category-title">${escapeHtml(title)}</h2>
      </div>
      <div class="category-tag">Supply Category Page</div>
    </div>

    <!-- Top KPI Grid -->
    <div class="kpi-banner">
      <div class="kpi-box">
        <div class="kpi-title">TOTAL USAGE RECORDED</div>
        <div class="kpi-value">${totalQty.toLocaleString()}</div>
        <div class="kpi-sub">Total Units Consumed</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">PEAK CONSUMPTION ITEM</div>
        <div class="kpi-value">${escapeHtml(peakBar.label)}</div>
        <div class="kpi-sub">${peakBar.value.toLocaleString()} Units</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">INVENTORY TRACKING</div>
        <div class="kpi-value" style="color: #317667;">Active</div>
        <div class="kpi-sub">ChickInteL Inventory System</div>
      </div>
    </div>

    <!-- Chart Card -->
    <div class="section-card">
      <div class="details-heading" style="margin-bottom: 12px;">Consumption Trend Chart</div>
      ${barChartHtmlFor(supply)}
    </div>

    <!-- Data Table Card -->
    <div class="section-card" style="margin-top: 14px;">
      <div class="details-heading" style="margin-bottom: 10px;">Item Usage Breakdown</div>
      <table class="data-table">
          <thead>
              <tr>
                  <th>Item / Period</th>
                  <th style="text-align: right;">Quantity Consumed</th>
                  <th style="text-align: center;">Activity Status</th>
              </tr>
          </thead>
          <tbody>${supplyRows}</tbody>
      </table>
    </div>

    <!-- Insight Box -->
    <div class="insight-box">
      <div class="insight-title">💡 Operational Takeaway & Inventory Analysis</div>
      <div class="insight-text">${escapeHtml(supply.analyticsText)}</div>
    </div>`;
}

function buildPrintableHtml({
  farmName,
  generatedBy,
  generatedDate,
  generatedTime,
  overview,
  printScope,
  eggReport,
  chickenReport,
  vitaminsReport,
  feedsReport,
}: {
  farmName: string;
  generatedBy: string;
  generatedDate: string;
  generatedTime: string;
  overview: ReportOverview;
  printScope: PrintScopeOption;
  eggReport: FarmReportSnapshot;
  chickenReport: FarmReportSnapshot;
  vitaminsReport: FarmReportSnapshot;
  feedsReport: FarmReportSnapshot;
}) {
  const pages: { contentHtml: string; categoryName: string }[] = [];

  if (printScope === "All Categories (Multi-Page)") {
    pages.push({
      categoryName: "Egg Production",
      contentHtml: renderProductionSection(
        "Egg Production Report",
        "🥚",
        eggReport.production,
      ),
    });
    pages.push({
      categoryName: "Chicken Production",
      contentHtml: renderProductionSection(
        "Chicken Flock & Batch Report",
        "🐓",
        chickenReport.production,
      ),
    });
    pages.push({
      categoryName: "Vitamins & Meds",
      contentHtml: renderSupplySection(
        "Vitamins & Medication Activity",
        "💊",
        vitaminsReport.supply,
      ),
    });
    pages.push({
      categoryName: "Feeds Consumption",
      contentHtml: renderSupplySection(
        "Feeds Consumption & Inventory",
        "🌾",
        feedsReport.supply,
      ),
    });
  } else if (printScope === "Eggs Only") {
    pages.push({
      categoryName: "Egg Production",
      contentHtml: renderProductionSection(
        "Egg Production Report",
        "🥚",
        eggReport.production,
      ),
    });
  } else if (printScope === "Chickens Only") {
    pages.push({
      categoryName: "Chicken Production",
      contentHtml: renderProductionSection(
        "Chicken Flock & Batch Report",
        "🐓",
        chickenReport.production,
      ),
    });
  } else if (printScope === "Vitamins & Meds Only") {
    pages.push({
      categoryName: "Vitamins & Meds",
      contentHtml: renderSupplySection(
        "Vitamins & Medication Activity",
        "💊",
        vitaminsReport.supply,
      ),
    });
  } else if (printScope === "Feeds Only") {
    pages.push({
      categoryName: "Feeds Consumption",
      contentHtml: renderSupplySection(
        "Feeds Consumption & Inventory",
        "🌾",
        feedsReport.supply,
      ),
    });
  }

  const totalPages = pages.length;

  const sheetsHtml = pages
    .map(
      (page, idx) => `
      <div class="sheet ${idx === totalPages - 1 ? "" : "page-break"}">
          <!-- Top Page Header -->
          <div class="page-top-header">
              <div class="brand-group">
                  <h1 class="brand-title">ChickInteL</h1>
                  <p class="brand-sub">Executive Farm Intelligence Report</p>
              </div>
              <div class="page-badge">
                Page ${idx + 1} of ${totalPages} • ${escapeHtml(page.categoryName)}
              </div>
          </div>

          <!-- Metadata Bar -->
          <div class="meta-strip">
              <div class="meta-item"><span class="meta-lbl">FARM:</span> <span class="meta-val">${escapeHtml(farmName)}</span></div>
              <div class="meta-item"><span class="meta-lbl">DATE:</span> <span class="meta-val">${escapeHtml(generatedDate)}</span></div>
              <div class="meta-item"><span class="meta-lbl">TIME:</span> <span class="meta-val">${escapeHtml(generatedTime)}</span></div>
              <div class="meta-item"><span class="meta-lbl">TIMEFRAME:</span> <span class="meta-val">${escapeHtml(overview)}</span></div>
              <div class="meta-item"><span class="meta-lbl">PREPARED BY:</span> <span class="meta-val">${escapeHtml(generatedBy)}</span></div>
          </div>

          <!-- Page Section Body -->
          ${page.contentHtml}

          <!-- Footer -->
          <div class="page-footer">
            <span>Official ChickInteL Farm Document</span>
            <span>Generated on ${escapeHtml(generatedDate)} ${escapeHtml(generatedTime)}</span>
            <span>Page ${idx + 1} of ${totalPages}</span>
          </div>
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <title>ChickInteL Farm Report - ${escapeHtml(overview)}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
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
                body {
                    padding: 16px;
                }
                .page-break {
                    page-break-after: always;
                    break-after: page;
                }
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
                    page-break-inside: avoid;
                    break-inside: avoid;
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
                .category-title-wrap {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .category-badge {
                    font-size: 22px;
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

                /* KPI Banner */
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
                    font-size: 18px;
                    font-weight: 800;
                    color: #203029;
                    margin: 4px 0 2px;
                }
                .kpi-sub {
                    font-size: 10px;
                    color: #317667;
                    font-weight: 600;
                }

                /* Section Cards */
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
                    min-width: 200px;
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

                /* Tables */
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
                .status-badge {
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 700;
                }
                .status-peak {
                    background: rgba(32, 48, 41, 0.1);
                    color: #203029;
                }
                .status-normal {
                    background: rgba(49, 118, 103, 0.1);
                    color: #317667;
                }

                /* Bar Chart */
                .bar-chart-container {
                    position: relative;
                    height: 140px;
                    margin-top: 10px;
                    padding-left: 28px;
                }
                .grid-lines-bg {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 20px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .grid-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 10px;
                    color: #688078;
                }
                .grid-row .line {
                    flex: 1;
                    height: 1px;
                    background: #e8f3ee;
                }
                .bars-flex {
                    position: relative;
                    z-index: 2;
                    height: 100%;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-around;
                    padding-left: 8px;
                    padding-bottom: 20px;
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
                    margin-bottom: 3px;
                }
                .bar-track {
                    width: 100%;
                    max-width: 22px;
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
                    font-size: 10px;
                    font-weight: 600;
                    color: #203029;
                    margin-top: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                /* Insight Box */
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

                /* Page Footer */
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
              <Text style={styles.modalTitle}>Print PDF Farm Report</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={ChickIntelPalette.gray1}
                />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Select PDF Page Structure</Text>
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
                name="file-pdf-box"
                size={22}
                color="#FFF"
              />
              <Text style={styles.printBtnText}>
                {printingReport
                  ? "Generating multi-page PDF..."
                  : "Export & Print PDF"}
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

function SegmentedPills<T extends string>({
  options,
  selected,
  onSelect,
  icons,
  containerStyle,
  itemStyle,
}: {
  options: T[];
  selected: T;
  onSelect: (opt: T) => void;
  icons?: Record<string, keyof typeof MaterialCommunityIcons.glyphMap>;
  containerStyle?: any;
  itemStyle?: any;
}) {
  return (
    <View style={[styles.segmentedContainer, containerStyle]}>
      {options.map((opt) => {
        const active = opt === selected;
        const iconName = icons?.[opt];
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            activeOpacity={0.8}
            style={[
              styles.segmentedItem,
              itemStyle,
              active && styles.segmentedItemActive,
            ]}
          >
            {iconName && (
              <MaterialCommunityIcons
                name={iconName}
                size={13}
                color={active ? "#FFF" : "#4A5452"}
              />
            )}
            <Text
              style={[
                styles.segmentedText,
                active && styles.segmentedTextActive,
              ]}
              numberOfLines={1}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
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
          <Text style={styles.donutCenterLabel}>Total Items</Text>
        </View>
      </View>

      <View style={styles.breakdownList}>
        {slices.map((slice) => {
          const percentVal =
            total > 0 ? Math.round((slice.count / total) * 100) : 0;
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

function ConsumptionBarChart({
  bars,
  maxY,
}: {
  bars: FarmReportSnapshot["supply"]["bars"];
  maxY: number;
}) {
  const graphHeight = 130;
  const axisValues = [maxY, Math.round(maxY / 2), 0];
  const barWidth = bars.length > 10 ? 18 : bars.length > 7 ? 22 : 28;

  if (bars.length === 0) {
    return (
      <View style={styles.emptyChartBox}>
        <MaterialCommunityIcons
          name="cube-outline"
          size={28}
          color={ChickIntelPalette.gray2}
        />
        <Text style={styles.emptyChartText}>
          No consumption data recorded for this timeframe.
        </Text>
      </View>
    );
  }

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
              style={[styles.barCol, { width: barWidth + 12 }]}
            >
              <Text style={styles.barValueLabel}>
                {item.value > 0 ? item.value : ""}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: barHeight, width: barWidth },
                    item.highlight ? styles.barFillHighlight : null,
                  ]}
                />
              </View>
              <Text style={styles.xAxisText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SmartInsightCard({ text }: { text: string }) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHeaderRow}>
        <View style={styles.insightIconBadge}>
          <MaterialCommunityIcons
            name="lightbulb-on-outline"
            size={16}
            color={ChickIntelPalette.green1}
          />
        </View>
        <Text style={styles.insightTitle}>Key Takeaway & Insight</Text>
      </View>
      <Text style={styles.insightBodyText}>{text}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const { activeFarm, profile } = useAuth();
  const isDark = false;
  const activeFarmId = activeFarm?.id;

  const [overview, setOverview] = useState<ReportOverview>("Weekly");
  const [prodType, setProdType] = useState<ReportProductionType>("Eggs");
  const [supplyType, setSupplyType] =
    useState<ReportSupplyType>("Vitamins & Meds");
  const [report, setReport] = useState<FarmReportSnapshot>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printScope, setPrintScope] = useState<PrintScopeOption>(
    "All Categories (Multi-Page)",
  );
  const [printingReport, setPrintingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  async function handlePrintReport() {
    setSaveError(null);
    setSaveMessage(null);
    setPrintingReport(true);

    try {
      if (!activeFarm?.id) {
        throw new Error("No active farm selected to print reports.");
      }

      const farmId = activeFarm.id;

      // Fetch all snapshots for per-page category compilation
      const [eggReport, chickenReport, vitaminsReport, feedsReport] =
        await Promise.all([
          fetchFarmReportSnapshot({
            farmId,
            overview,
            productionType: "Eggs",
            supplyType: "Vitamins & Meds",
          }),
          fetchFarmReportSnapshot({
            farmId,
            overview,
            productionType: "Chickens",
            supplyType: "Vitamins & Meds",
          }),
          fetchFarmReportSnapshot({
            farmId,
            overview,
            productionType: "Eggs",
            supplyType: "Vitamins & Meds",
          }),
          fetchFarmReportSnapshot({
            farmId,
            overview,
            productionType: "Eggs",
            supplyType: "Feeds",
          }),
        ]);

      const html = buildPrintableHtml({
        farmName: activeFarm?.name || "ChickInteL Farm",
        generatedBy,
        generatedDate,
        generatedTime,
        overview,
        printScope,
        eggReport,
        chickenReport,
        vitaminsReport,
        feedsReport,
      });

      await Print.printAsync({
        html,
        orientation: "portrait",
      });

      setSaveMessage("PDF report exported successfully.");
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

  const topSlice = report.production.slices.reduce(
    (max, item) => (item.count > max.count ? item : max),
    report.production.slices[0] || {
      label: "N/A",
      count: 0,
      displayPercent: "0%",
    },
  );

  const totalSupplyUsage = report.supply.bars.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const displayedSupplyTotal = report.supply.totalSlices ?? totalSupplyUsage;

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: 1.08 }, { translateY: -14 }] },
        ]}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.viewShot}>
          {/* Pinned Top Header */}
          <View style={styles.fixedHeader}>
            <View style={styles.header}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <TouchableOpacity
                  style={styles.printButton}
                  onPress={() =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace("/(tabs)")
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={22}
                    color="#FFF"
                  />
                </TouchableOpacity>
                <View>
                  <Text style={styles.screenTitle}>Farm Reports</Text>
                  <Text style={styles.screenSubtitle}>
                    {activeFarm?.name || "No active farm"} • {overview} Snapshot
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.printButton}
                onPress={() => setPrintModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="printer-outline"
                  size={22}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>

            {/* Timeframe Filter Bar */}
            <View style={styles.timeframeBarContainer}>
              <Text style={styles.timeframeLabel}>Timeframe:</Text>
              <SegmentedPills
                options={OVERVIEW_OPTIONS}
                selected={overview}
                onSelect={(val) => setOverview(val)}
                containerStyle={styles.timeframePillsContainer}
                itemStyle={styles.timeframePillItem}
                icons={{
                  Weekly: "calendar-week",
                  Monthly: "calendar-month",
                  Annually: "calendar-multiselect",
                }}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: 10,
                paddingBottom: 15,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color={ChickIntelPalette.green1} />
                <Text style={styles.statusText}>
                  Updating report analytics...
                </Text>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {saveError ? (
              <Text style={styles.errorText}>{saveError}</Text>
            ) : null}
            {saveMessage ? (
              <Text style={styles.successText}>{saveMessage}</Text>
            ) : null}

            {/* KPI Summary Cards */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrap}>
                  <MaterialCommunityIcons
                    name={prodType === "Eggs" ? "egg" : "bird"}
                    size={16}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <Text style={styles.kpiLabel}>Total {prodType}</Text>
                <Text style={styles.kpiValue}>
                  {report.production.total.toLocaleString()}
                </Text>
                <Text style={styles.kpiSubtext}>{overview} total recorded</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrap}>
                  <MaterialCommunityIcons
                    name="chart-pie"
                    size={16}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <Text style={styles.kpiLabel}>Top Outcome</Text>
                <Text
                  style={[styles.kpiValue, { textTransform: "capitalize" }]}
                >
                  {topSlice.label}
                </Text>
                <Text style={styles.kpiSubtext}>
                  {topSlice.displayPercent} ({topSlice.count.toLocaleString()})
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiIconWrap}>
                  <MaterialCommunityIcons
                    name="truck-delivery-outline"
                    size={16}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <Text style={styles.kpiLabel}>Consumed Supply</Text>
                <Text style={styles.kpiValue}>
                  {displayedSupplyTotal.toLocaleString()}
                </Text>
                <Text style={styles.kpiSubtext}>
                  {supplyType} units consumed
                </Text>
              </View>
            </View>

            {/* Section 1: Production Overview */}
            <BlurCard
              style={[styles.reportCard, isDark && styles.reportCardDark]}
              borderRadius={20}
              intensity={18}
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
                        name={prodType === "Eggs" ? "egg-outline" : "bird"}
                        size={18}
                        color={ChickIntelPalette.green1}
                      />
                    </View>
                    <Text style={styles.cardTitle}>
                      {report.production.title}
                    </Text>
                  </View>
                  <SegmentedPills
                    options={TYPE_OPTIONS}
                    selected={prodType}
                    onSelect={(val) => setProdType(val)}
                    icons={{
                      Eggs: "egg",
                      Chickens: "bird",
                    }}
                  />
                </View>

                <View style={styles.chartWrapper}>
                  <DonutChart
                    slices={report.production.slices}
                    total={report.production.total}
                  />
                </View>

                <SmartInsightCard text={report.production.analyticsText} />
              </View>
            </BlurCard>

            {/* Section 2: Supply Activity */}
            <BlurCard
              style={[styles.reportCard, isDark && styles.reportCardDark]}
              borderRadius={20}
              intensity={18}
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
                        size={18}
                        color={ChickIntelPalette.green1}
                      />
                    </View>
                    <Text style={styles.cardTitle}>{report.supply.title}</Text>
                  </View>
                  <SegmentedPills
                    options={SUPPLY_OPTIONS}
                    selected={supplyType}
                    onSelect={(val) => setSupplyType(val)}
                    icons={{
                      "Vitamins & Meds": "pill",
                      Feeds: "barley",
                    }}
                  />
                </View>

                {supplyType === "Feeds" ||
                (report.supply.slices && report.supply.slices.length > 0) ? (
                  <View style={styles.chartWrapper}>
                    <DonutChart
                      slices={report.supply.slices ?? []}
                      total={report.supply.totalSlices ?? 0}
                    />
                  </View>
                ) : (
                  <View style={styles.barChartWrapper}>
                    <ConsumptionBarChart
                      bars={report.supply.bars}
                      maxY={report.supply.maxY}
                    />
                  </View>
                )}

                <SmartInsightCard text={report.supply.analyticsText} />
              </View>
            </BlurCard>

            {/* Footer Metadata */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerLabel}>
                Report Snapshot Information
              </Text>
              <Text style={styles.footerText}>Generated by: {generatedBy}</Text>
              <Text style={styles.footerText}>
                Date: {generatedDate} at {generatedTime}
              </Text>
              <Text style={styles.footerText}>
                Farm: {activeFarm?.name || "No active farm"}
              </Text>
            </View>
          </ScrollView>
        </View>

        <PrintModal
          visible={printModalVisible}
          onClose={() => setPrintModalVisible(false)}
          selectedPrintScope={printScope}
          onSelectPrintScope={setPrintScope}
          onPrintReport={handlePrintReport}
          printingReport={printingReport}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ReportsPageTheme.screenBackground,
  },
  safeArea: {
    flex: 1,
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
  viewShot: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(4),
    marginTop: verticalScale(6),
    marginBottom: verticalScale(2),
  },
  screenTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray2,
    marginTop: 2,
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
  timeframeBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 14,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    gap: moderateScale(6),
  },
  timeframeLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  timeframePillsContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  timeframePillItem: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(4),
    paddingVertical: verticalScale(5),
    gap: 3,
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segmentedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(6),
    borderRadius: 8,
  },
  segmentedItemActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  segmentedText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  segmentedTextActive: {
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
  successText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(8),
  },

  // KPI Summary Cards
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 16,
    padding: moderateScale(12),
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
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  kpiSubtext: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.green1,
    fontWeight: "600",
  },

  // Cards & Headers
  reportCard: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
  },
  reportCardDark: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
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
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: scale(130),
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
    flexShrink: 1,
  },

  // Donut Chart Container & Breakdown
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

  // Breakdown List
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

  // Bar Chart Container
  barChartWrapper: {
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(8),
    paddingHorizontal: moderateScale(10),
    borderRadius: 16,
    backgroundColor: "rgba(244, 248, 247, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.1)",
  },
  barGraphContainer: {
    height: verticalScale(175),
    position: "relative",
    paddingLeft: 22,
    paddingTop: 16,
  },
  gridLinesWrap: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: "space-between",
  },
  gridLineRow: {
    flexDirection: "row",
    alignItems: "center",
    height: verticalScale(16),
  },
  yAxisText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.gray2,
    width: scale(22),
  },
  gridLine: {
    flex: 1,
    height: verticalScale(1),
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  barsWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: "100%",
    paddingBottom: 22,
  },
  barCol: {
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barValueLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    marginBottom: 2,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    backgroundColor: "#81BDB0",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barFillHighlight: {
    backgroundColor: "#323330",
  },
  xAxisText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.gray1,
    marginTop: 4,
    fontWeight: "600",
  },
  emptyChartBox: {
    padding: verticalScale(30),
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyChartText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray2,
    textAlign: "center",
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

  // Footer Container
  footerContainer: {
    marginTop: verticalScale(10),
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    gap: 2,
  },
  footerLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  footerText: {
    fontFamily: ReportsCardTheme.footerTextFontFamily,
    fontSize: ReportsCardTheme.footerTextFontSize,
    lineHeight: ReportsCardTheme.footerTextLineHeight,
    color: ReportsCardTheme.footerTextColor,
    textAlign: "center",
  },

  // Print Modal
  printModalRoot: {
    flex: 1,
    position: "relative",
  },
  printModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
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
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  sectionLabel: {
    fontFamily: ReportsCardTheme.sectionTitleFontFamily,
    fontSize: ReportsCardTheme.sectionTitleFontSize,
    fontWeight: ReportsCardTheme.sectionTitleFontWeight,
    color: ReportsCardTheme.sectionTitleColor,
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "column",
    gap: 6,
  },
  chip: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    borderRadius: 10,
    backgroundColor: "#F0F2F2",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  chipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray1,
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  printBtn: {
    backgroundColor: ChickIntelPalette.green1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    borderRadius: 10,
    marginTop: 18,
    gap: 8,
  },
  printBtnText: {
    color: "#FFF",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
  },
  secondaryActionBtn: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
    backgroundColor: "#F7FBFA",
  },
  secondaryActionText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
  },
});
