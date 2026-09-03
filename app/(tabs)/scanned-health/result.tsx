import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { HealthFlowFooterButton } from "@/components/health-scan/health-flow-footer-button";
import { HealthInputSummaryCard } from "@/components/health-scan/health-input-summary-card";
import { HealthResultCard } from "@/components/health-scan/health-result-card";
import {
    ChickSelectRow,
    ChickSelectionModal,
} from "@/components/ui/chick-form";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { DEFAULT_IMAGE_BASED_DETECTION } from "@/constants/health-scan-behaviors";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import type { BatchItem } from "@/utils/batch-store";
import {
    inferDiseaseFromImage,
    type HealthImageInferenceResult,
} from "@/utils/health-image-inference";
import { logError, logStep } from "@/utils/logger";
import { fetchFarmBatches } from "@/utils/supabase-batches";
import { mapBehaviorIdsToLabels } from "@/utils/supabase-behaviors";
import {
    detectDiseaseFromClassifierLabel,
    type MatchedDisease,
} from "@/utils/supabase-diseases";
import { createHealthJournalEntry } from "@/utils/supabase-health-journal";
import {
    appendHealthLogToMonitoring,
    createHealthMonitoringRecord,
    doesChtTagExist,
    formatChtTag,
    getNextChtNumber,
} from "@/utils/supabase-health-monitoring";

const MONITORABLE_DISEASES = ["Infectious Coryza", "Fowlpox"];
const NON_CHICKEN_RESULT = "Non-chicken detected";
const NON_CHICKEN_DESCRIPTION =
  "The captured image does not appear to contain a chicken. Retake the photo with the chicken clearly inside the frame.";
const NON_CHICKEN_RECOMMENDATION =
  "Point the camera at a chicken, keep the subject centered, and scan again.";

function parseBehaviorIds(raw: string | string[] | undefined): string[] {
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function humanizeClassifierLabel(label: string) {
  if (!label.trim()) return "";

  return label
    .split(/[-_]+/)
    .map((part) =>
      part.length > 0
        ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`
        : part,
    )
    .join(" ");
}

function normalizeClassifierLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNonChickenClassifierLabel(label: string) {
  const normalized = normalizeClassifierLabel(label);

  return (
    normalized === "nonchicken" ||
    normalized === "non chicken" ||
    normalized === "not chicken" ||
    normalized === "not a chicken" ||
    normalized === "no chicken"
  );
}

function isMonitorableDisease(diseaseName: string): boolean {
  const normalized = diseaseName.toLowerCase().trim();
  return MONITORABLE_DISEASES.some(
    (d) =>
      d.toLowerCase() === normalized || normalized.includes(d.toLowerCase()),
  );
}

function formatBatchOptionLabel(batch: BatchItem) {
  return `${batch.id} · ${batch.breed}`;
}

export default function ScannedHealthResultScreen() {
  const router = useRouter();
  const { activeFarm } = useAuth();
  const params = useLocalSearchParams<{
    photoUri?: string;
    detectedIllness?: string;
    capturedAt?: string;
    captureWidth?: string;
    captureHeight?: string;
    behaviors?: string;
    additionalObservation?: string;
    monitoringId?: string;
    chtTag?: string;
  }>();

  const photoUri =
    typeof params.photoUri === "string" && params.photoUri
      ? params.photoUri
      : "";

  const detectedIllness =
    typeof params.detectedIllness === "string" && params.detectedIllness
      ? params.detectedIllness
      : DEFAULT_IMAGE_BASED_DETECTION;
  const capturedAt =
    typeof params.capturedAt === "string" ? params.capturedAt : undefined;
  const captureWidth =
    typeof params.captureWidth === "string"
      ? Number.parseInt(params.captureWidth, 10)
      : undefined;
  const captureHeight =
    typeof params.captureHeight === "string"
      ? Number.parseInt(params.captureHeight, 10)
      : undefined;
  const additionalObservation =
    typeof params.additionalObservation === "string"
      ? params.additionalObservation
      : "";
  const monitoringId =
    typeof params.monitoringId === "string" ? params.monitoringId : "";
  const chtTag = typeof params.chtTag === "string" ? params.chtTag : "";
  const isMonitoringRescan = Boolean(monitoringId);

  const behaviorIds = useMemo(
    () => parseBehaviorIds(params.behaviors),
    [params.behaviors],
  );

  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [savedHealthLogId, setSavedHealthLogId] = useState<string | null>(null);
  const [imageMatchedDisease, setImageMatchedDisease] =
    useState<MatchedDisease | null>(null);
  const [imageInference, setImageInference] =
    useState<HealthImageInferenceResult | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(true);
  const { behaviors: behaviorItems } = useBehaviors();

  const selectedLabels = useMemo(
    () => mapBehaviorIdsToLabels(behaviorIds, behaviorItems),
    [behaviorIds, behaviorItems],
  );
  const fallbackImageDiseaseName = useMemo(
    () =>
      humanizeClassifierLabel(imageInference?.topPrediction?.className ?? ""),
    [imageInference?.topPrediction?.className],
  );
  const isNonChickenImage = isNonChickenClassifierLabel(
    imageInference?.topPrediction?.className ?? "",
  );

  const resolvedDetectedIllness = isNonChickenImage
    ? NON_CHICKEN_RESULT
    : imageMatchedDisease?.diseaseName ||
      fallbackImageDiseaseName ||
      detectedIllness;
  const resultDescription = isNonChickenImage
    ? NON_CHICKEN_DESCRIPTION
    : imageMatchedDisease?.description;
  const treatmentSteps = isNonChickenImage
    ? [NON_CHICKEN_RECOMMENDATION]
    : imageMatchedDisease?.treatmentSteps;
  const treatmentText = isNonChickenImage
    ? NON_CHICKEN_RECOMMENDATION
    : (imageMatchedDisease?.treatmentSteps.join(" ") ?? "");
  const resultSeverity =
    !isNonChickenImage &&
    (imageMatchedDisease?.severity === "high" ||
      imageMatchedDisease?.severity === "critical");

  const [chtDialogVisible, setChtDialogVisible] = useState(false);
  const [chtNumber, setChtNumber] = useState("");
  const [chtError, setChtError] = useState("");
  const [chtLoading, setChtLoading] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<BatchItem[]>([]);
  const [selectedBatchNo, setSelectedBatchNo] = useState("");
  const [batchPickerVisible, setBatchPickerVisible] = useState(false);
  const [updateSuccessVisible, setUpdateSuccessVisible] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const batchOptionLabels = useMemo(
    () => availableBatches.map((batch) => formatBatchOptionLabel(batch)),
    [availableBatches],
  );

  const batchOptionColors = useMemo(
    () =>
      Object.fromEntries(
        availableBatches.map((batch) => [
          formatBatchOptionLabel(batch),
          batch.colorHex,
        ]),
      ),
    [availableBatches],
  );

  const selectedBatchLabel = useMemo(() => {
    const batch = availableBatches.find(
      (entry) => entry.id === selectedBatchNo,
    );
    return batch ? formatBatchOptionLabel(batch) : "";
  }, [availableBatches, selectedBatchNo]);

  useEffect(() => {
    if (!photoUri) {
      router.replace("/(tabs)");
    }
  }, [photoUri, router]);

  useEffect(() => {
    let cancelled = false;

    setIsAnalyzingImage(true);
    inferDiseaseFromImage(photoUri)
      .then(async (inference) => {
        if (cancelled) return;

        setImageInference(inference);

        const topPrediction = inference?.topPrediction;
        if (!topPrediction) {
          setImageMatchedDisease(null);
          return;
        }

        if (isNonChickenClassifierLabel(topPrediction.className)) {
          setImageMatchedDisease(null);
          return;
        }

        const mappedDisease = await detectDiseaseFromClassifierLabel(
          topPrediction.className,
          topPrediction.confidence,
          inference?.predictions,
        );

        if (!cancelled) {
          setImageMatchedDisease(mappedDisease);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageMatchedDisease(null);
          setImageInference(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAnalyzingImage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [photoUri]);

  useEffect(() => {
    try {
      logStep("ScannedHealthResult mounted", {
        behaviorsCount: behaviorIds.length,
      });
    } catch {
      // ignore
    }
  }, [behaviorIds.length]);

  function onSave() {
    if (!activeFarm?.id) {
      Alert.alert(
        "No farm selected",
        "Set up your farm before saving health logs.",
      );
      return;
    }

    if (isNonChickenImage) {
      Alert.alert(
        "Non-chicken image",
        "This scan is not saved as a health log because the classifier did not detect a chicken. Retake the photo with a chicken in frame.",
      );
      return;
    }

    setIsSaving(true);
    setUpdateError(null);

    void createHealthJournalEntry(activeFarm.id, {
      photoUri,
      detectedIllness: resolvedDetectedIllness,
      diseaseId: imageMatchedDisease?.diseaseId,
      confidence: imageMatchedDisease?.confidence,
      detectionSource: imageMatchedDisease?.detectionSource,
      behaviorIds,
      additionalObservation,
      resultSummary: resolvedDetectedIllness,
      recommendationText: treatmentText,
      actionStatus: imageMatchedDisease?.status ?? "",
      durationValue: imageMatchedDisease?.recoveryDuration ?? "",
      healthMonitoringId: isMonitoringRescan ? monitoringId : undefined,
    })
      .then(async (saved) => {
        try {
          logStep("Health scan saved to Supabase", {
            actionStatus: imageMatchedDisease?.status,
            savedId: saved.id,
            monitoringRescan: isMonitoringRescan,
          });
        } catch {
          // ignore
        }

        if (isMonitoringRescan) {
          await appendHealthLogToMonitoring(
            activeFarm.id,
            monitoringId,
            saved.id,
          );
          setUpdateSuccessVisible(true);
          return;
        }

        setSavedHealthLogId(saved.id);
        setSaveDialogVisible(true);
      })
      .catch((error) => {
        logError("Health scan save failed", error, {
          monitoringRescan: isMonitoringRescan,
        });
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? (error as any).message
              : JSON.stringify(error);

        if (isMonitoringRescan) {
          setUpdateError(
            `Could not update this chicken's health record. Error: ${errorMessage}`,
          );
          return;
        }

        Alert.alert(
          "Unable to save",
          `The health log could not be saved. Error: ${errorMessage}`,
        );
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  async function openChtDialog() {
    if (!activeFarm?.id || !savedHealthLogId) return;

    setChtLoading(true);
    setChtError("");
    try {
      const [nextNum, batches] = await Promise.all([
        getNextChtNumber(activeFarm.id),
        fetchFarmBatches(activeFarm.id),
      ]);
      setAvailableBatches(batches);
      setSelectedBatchNo(batches[0]?.id ?? "");
      setChtNumber(String(nextNum).padStart(4, "0"));
      setChtDialogVisible(true);
    } catch (error) {
      logError("Failed to open health monitoring dialog", error);
      Alert.alert(
        "Error",
        "Could not load batch profile data for health monitoring.",
      );
    } finally {
      setChtLoading(false);
    }
  }

  function handleBatchOptionSelect(label: string) {
    const batch = availableBatches.find(
      (entry) => formatBatchOptionLabel(entry) === label,
    );
    if (batch) {
      setSelectedBatchNo(batch.id);
      setChtError("");
    }
  }

  async function confirmCht() {
    if (!activeFarm?.id || !savedHealthLogId) return;

    const numericOnly = chtNumber.replace(/\D/g, "");
    if (!numericOnly) {
      setChtError("Please enter a valid Chicken Health Tag number.");
      return;
    }

    if (!selectedBatchNo) {
      setChtError("Please select a Batch No. from your Batch Profile first.");
      return;
    }

    const chtTag = formatChtTag(parseInt(numericOnly, 10));

    setChtLoading(true);
    setChtError("");
    try {
      const exists = await doesChtTagExist(activeFarm.id, chtTag);
      if (exists) {
        setChtError(
          "This Chicken Health Tag already exists. Please choose another number.",
        );
        setChtLoading(false);
        return;
      }

      await createHealthMonitoringRecord(
        activeFarm.id,
        savedHealthLogId,
        chtTag,
        selectedBatchNo,
      );

      setChtDialogVisible(false);
      setSaveDialogVisible(false);
      Alert.alert(
        "Added to Health Monitoring",
        `Chicken ${chtTag} from Batch ${selectedBatchNo} is now being monitored.`,
        [
          {
            text: "Go to Health Monitoring",
            onPress: () => router.replace("/(tabs)/health-monitoring" as any),
          },
          {
            text: "Stay here",
            style: "cancel",
            onPress: () => router.replace("/(tabs)" as any),
          },
        ],
      );
    } catch (error) {
      logError("Failed to create health monitoring record", error);
      setChtError("Could not add to Health Monitoring. Please try again.");
    } finally {
      setChtLoading(false);
    }
  }

  if (!photoUri) {
    return null;
  }

  const canMonitor = isMonitorableDisease(resolvedDetectedIllness);

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
        <StatusBar style="dark" />

        {/* Pinned Top Header */}
        <View style={styles.fixedHeader}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)")
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
            <View style={styles.titleWrap}>
              <Text style={styles.pageTitle}>
                {isMonitoringRescan
                  ? "Update Behavior Check"
                  : "Behavior Check Result"}
              </Text>
            </View>
          </View>
          <Text style={styles.pageSubtitle}>
            {isAnalyzingImage
              ? "Analyzing the captured image before finalizing the report."
              : isMonitoringRescan
                ? `This update will be added to ${chtTag || "this chicken"}'s record. Previous notes are kept.`
                : "Behavior cues, health context, and notes in one clear journal entry."}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: 8,
              paddingBottom: 15,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {isAnalyzingImage ? (
            <View style={styles.analysisLoadingCard}>
              <ActivityIndicator
                size="small"
                color={ChickIntelPalette.green1}
              />
              <View style={styles.analysisLoadingTextWrap}>
                <Text style={styles.analysisLoadingTitle}>
                  Analyzing photo & inferring symptoms...
                </Text>
                <Text style={styles.analysisLoadingSub}>
                  Please Wait.......
                </Text>
              </View>
            </View>
          ) : null}

          <HealthInputSummaryCard
            photoUri={photoUri}
            detectedIllness={resolvedDetectedIllness}
            detectionDescription={resultDescription}
            capturedAt={capturedAt}
            captureWidth={captureWidth}
            captureHeight={captureHeight}
            selectedLabels={selectedLabels}
            additionalObservation={additionalObservation}
            showKicker={false}
          />

          <View style={styles.cardSpacer} />

          <HealthResultCard
            resultSeverity={resultSeverity}
            diseaseName={resolvedDetectedIllness}
            resultSummary={resolvedDetectedIllness}
            resultDescription={resultDescription}
            recommendationText={treatmentText}
            treatmentSteps={treatmentSteps}
            actionStatus={imageMatchedDisease?.status ?? ""}
            durationValue={imageMatchedDisease?.recoveryDuration ?? ""}
          />

          <HealthFlowFooterButton
            variant="save"
            label={isMonitoringRescan ? "Update record" : undefined}
            onPress={onSave}
            disabled={isAnalyzingImage || isSaving}
          />
        </ScrollView>

        {/* Save dialog with optional Add to Health Monitoring */}
        <Modal visible={saveDialogVisible} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={styles.modalHeaderIconBadge}>
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.modalHeaderTitle}>
                    Behavior Check Saved
                  </Text>
                </View>
                <Text style={styles.modalHeaderSubtitle}>
                  The chicken behavior note has been saved to your Behavior
                  Journal.
                </Text>
              </View>

              <View style={styles.modalBodyWrap}>
                {canMonitor && savedHealthLogId && (
                  <Pressable
                    style={[styles.monitorBtn, chtLoading && { opacity: 0.7 }]}
                    onPress={openChtDialog}
                    disabled={chtLoading}
                  >
                    {chtLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <MaterialCommunityIcons
                        name="heart-pulse"
                        size={18}
                        color="#FFF"
                      />
                    )}
                    <Text style={styles.monitorBtnText}>
                      Add to Health Monitoring
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.modalBtn}
                  onPress={() => {
                    setSaveDialogVisible(false);
                    router.replace("/(tabs)/journal");
                  }}
                >
                  <Text style={styles.modalBtnText}>
                    Go to Behavior Journal
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* CHT Tag editor dialog */}
        <Modal visible={chtDialogVisible} transparent animationType="fade">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderTitleRow}>
                    <View style={styles.modalHeaderIconBadge}>
                      <MaterialCommunityIcons
                        name="tag-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text style={styles.modalHeaderTitle}>
                      Chicken Health Tag
                    </Text>
                  </View>
                  <Text style={styles.modalHeaderSubtitle}>
                    Assign a unique tag & batch profile for health monitoring.
                  </Text>
                </View>

                <View style={styles.modalBodyWrap}>
                  <View style={styles.chtFieldWrap}>
                    <ChickSelectRow
                      label="Batch No."
                      value={selectedBatchLabel}
                      placeholder="Select batch"
                      selectedColor={
                        availableBatches.find(
                          (entry) => entry.id === selectedBatchNo,
                        )?.colorHex
                      }
                      onPress={() => {
                        if (availableBatches.length === 0) {
                          setChtError(
                            "No batches found. Add a chicken batch in Batch Profile first.",
                          );
                          return;
                        }
                        setBatchPickerVisible(true);
                      }}
                      style={styles.chtSelectField}
                      rowStyle={styles.chtSelectRow}
                    />
                  </View>

                  <View style={styles.chtInputCard}>
                    <Text style={styles.chtInputLabel}>
                      CHICHECK HEALTH TAG
                    </Text>
                    <View style={styles.chtRow}>
                      <Text style={styles.chtPrefix}>CHT-</Text>
                      <TextInput
                        style={styles.chtInput}
                        value={chtNumber}
                        onChangeText={(text) => {
                          setChtNumber(text.replace(/\D/g, ""));
                          setChtError("");
                        }}
                        keyboardType="number-pad"
                        maxLength={4}
                        placeholder="0001"
                        placeholderTextColor={ChickIntelPalette.gray2}
                      />
                    </View>
                  </View>

                  {chtError ? (
                    <Text style={styles.chtErrorText}>{chtError}</Text>
                  ) : null}

                  <View style={styles.chtBtnRow}>
                    <Pressable
                      style={styles.chtCancelBtn}
                      onPress={() => {
                        setChtDialogVisible(false);
                        setChtError("");
                      }}
                      disabled={chtLoading}
                    >
                      <Text style={styles.chtCancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.chtConfirmBtn,
                        chtLoading && { opacity: 0.7 },
                      ]}
                      onPress={confirmCht}
                      disabled={chtLoading}
                    >
                      {chtLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : null}
                      <Text style={styles.chtConfirmBtnText}>
                        Save Monitoring
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <ChickSelectionModal
          visible={batchPickerVisible}
          title="Select Batch No."
          options={batchOptionLabels}
          value={selectedBatchLabel}
          optionColors={batchOptionColors}
          onSelect={handleBatchOptionSelect}
          onClose={() => setBatchPickerVisible(false)}
        />

        <Modal
          visible={updateSuccessVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setUpdateSuccessVisible(false)}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Health scan updated</Text>
              <Text style={styles.modalBody}>
                {chtTag
                  ? `${chtTag}'s monitoring record now shows this latest scan. Earlier scans are still saved in the history.`
                  : "This chicken's monitoring record now shows the latest scan. Earlier scans are still saved in the history."}
              </Text>
              <Pressable
                style={styles.modalBtn}
                onPress={() => {
                  setUpdateSuccessVisible(false);
                  router.replace({
                    pathname:
                      `/(tabs)/health-monitoring/${monitoringId}` as any,
                    params: {
                      refresh: Date.now().toString(),
                    },
                  } as any);
                }}
              >
                <Text style={styles.modalBtnText}>
                  Back to Health Monitoring
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={updateError !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setUpdateError(null)}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Update failed</Text>
              <Text style={styles.modalBody}>{updateError}</Text>
              <Pressable
                style={styles.modalBtn}
                onPress={() => setUpdateError(null)}
              >
                <Text style={styles.modalBtnText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  safeArea: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: moderateScale(16),
    paddingTop: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  scroll: {
    paddingHorizontal: moderateScale(16),
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
    marginBottom: 2,
  },
  pageSubtitle: {
    ...HealthTypography.meta,
    marginBottom: 12,
    color: ChickIntelPalette.green1,
  },
  backButton: {
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
    flexShrink: 0,
  },
  cardSpacer: {
    height: verticalScale(4),
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: moderateScale(20),
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxWidth: scale(420),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(6) },
    elevation: 8,
  },
  modalHeader: {
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(14),
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalHeaderIconBadge: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(17),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalHeaderSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 4,
  },
  modalBodyWrap: {
    padding: moderateScale(18),
    gap: 12,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    marginBottom: 4,
  },
  modalBody: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
    color: "#5A6262",
  },
  chtFieldWrap: {
    width: "100%",
  },
  chtSelectField: {
    width: "100%",
  },
  chtSelectRow: {
    minHeight: verticalScale(44),
  },
  chtInputCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    backgroundColor: "#F9FAFA",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    gap: 4,
  },
  chtInputLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: "#5A6262",
    letterSpacing: 0.3,
  },
  chtRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chtPrefix: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
  },
  chtInput: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    borderBottomWidth: 2,
    borderBottomColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(2),
    paddingHorizontal: moderateScale(8),
    minWidth: scale(80),
    textAlign: "center",
  },
  chtErrorText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#EF4444",
    textAlign: "center",
  },
  chtBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  chtCancelBtn: {
    flex: 1,
    backgroundColor: "#F0F2F2",
    paddingVertical: verticalScale(12),
    borderRadius: 10,
    alignItems: "center",
  },
  chtCancelBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  chtConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(12),
    borderRadius: 10,
  },
  chtConfirmBtnText: {
    fontFamily: ChickFont.sans,
    color: "#FFF",
    fontWeight: "700",
    fontSize: responsiveFontSize(14),
  },
  monitorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(13),
    paddingHorizontal: moderateScale(20),
    borderRadius: 12,
    marginBottom: 12,
    width: "100%",
  },
  monitorBtnText: {
    fontFamily: ChickFont.sans,
    color: "#FFF",
    fontWeight: "700",
    fontSize: responsiveFontSize(14),
  },
  modalBtn: {
    backgroundColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(24),
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  modalBtnText: {
    fontFamily: ChickFont.sans,
    color: "#FFF",
    fontWeight: "700",
    fontSize: responsiveFontSize(14),
  },
  analysisLoadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    marginBottom: 12,
  },
  analysisLoadingTextWrap: {
    flex: 1,
  },
  analysisLoadingTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  analysisLoadingSub: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#5E6665",
    marginTop: 2,
  },
});
