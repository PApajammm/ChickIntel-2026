import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
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
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    CameraViewport,
    type CameraViewportRef,
} from "@/components/scanner/camera-viewport";
import { ScannerShutter } from "@/components/scanner/scanner-shutter";
import { ViewfinderOverlay } from "@/components/scanner/viewfinder-overlay";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    inferBreedFromImage,
    isNonChickenClassifierLabel,
    mapBreedPredictionToAttributes,
} from "@/utils/breed-image-inference";
import { logError, logStep } from "@/utils/logger";
import { addRecentBreedScan } from "@/utils/recent-breed-scans";
import { createFarmBatch, fetchFarmBatches } from "@/utils/supabase-batches";
import { fetchBreedOptions } from "@/utils/supabase-lookups";

const TAB_BAR_OFFSET = 55;
const MAX_SCAN_ZOOM = 0.7;

const AGE_UNIT_OPTIONS = ["Days old", "Weeks old"] as const;

const DEFAULT_BREED_OPTIONS = [
  "Rhode Island Red",
  "White Leghorn",
  "Australorp",
  "Silkie",
  "Plymouth Rock",
] as const;

const COLOR_OPTIONS = [
  // Reds & Pinks
  { name: "Red", hex: "#D84A49" },

  // Oranges & Yellows
  { name: "Orange", hex: "#E67E22" },
  { name: "Yellow", hex: "#E2B53C" },

  // Greens & Teals
  { name: "Green", hex: "#3FA06E" },

  // Blues & Indigos
  { name: "Blue", hex: "#4A86D8" },

  // Browns, Greys & Monochromes
  { name: "Grey", hex: "#808080" },
  { name: "Black", hex: "#323330" },
  { name: "White", hex: "#F4F5F2" },
];

type BatchMode = "chicken" | "egg";

export default function AddBatchScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeFarm } = useAuth();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const initialMode: BatchMode = modeParam === "egg" ? "egg" : "chicken";
  const [mode] = useState<BatchMode>(initialMode);
  const router = useRouter();
  const cameraRef = useRef<CameraViewportRef>(null);
  const [breedModalOpen, setBreedModalOpen] = useState(false);
  const [breedScannerOpen, setBreedScannerOpen] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [breedCameraReady, setBreedCameraReady] = useState(false);
  const [isScanningBreed, setIsScanningBreed] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [colorSearchQuery, setColorSearchQuery] = useState("");

  const [batchNo, setBatchNo] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);

  const filteredColorOptions = useMemo(() => {
    if (!colorSearchQuery.trim()) return COLOR_OPTIONS;
    const q = colorSearchQuery.toLowerCase().trim();
    return COLOR_OPTIONS.filter((opt) => opt.name.toLowerCase().includes(q));
  }, [colorSearchQuery]);

  function getNextBatchNo(existingBatchIds: (string | null | undefined)[]) {
    const numericValues = existingBatchIds
      .map((value) => {
        const normalized = String(value ?? "").replace(/[^0-9]/g, "");
        const parsed = Number.parseInt(normalized, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      })
      .filter((value): value is number => value !== null);

    const highest = numericValues.length ? Math.max(...numericValues) : 0;
    return String(highest + 1).padStart(4, "0");
  }
  const [usedBatchColorNames, setUsedBatchColorNames] = useState<string[]>([]);
  // Duration: numeric part (number of days or weeks)
  const [durationCount, setDurationCount] = useState("");
  const [ageUnit, setAgeUnit] = useState<(typeof AGE_UNIT_OPTIONS)[number]>(
    AGE_UNIT_OPTIONS[0],
  );
  // Total birds (keeps previous behavior for male/female auto-split)
  const [totalCount, setTotalCount] = useState("");
  const [breed, setBreed] = useState("");
  const [maleCount, setMaleCount] = useState("50");
  const [femaleCount, setFemaleCount] = useState("50");
  const [breedOptions, setBreedOptions] = useState<string[]>([
    ...DEFAULT_BREED_OPTIONS,
  ]);

  const resetForm = useCallback(() => {
    setBatchNo("");
    setSelectedColor(COLOR_OPTIONS[0]);
    setDurationCount("");
    setAgeUnit(AGE_UNIT_OPTIONS[0]);
    setTotalCount("");
    setBreed("");
    setMaleCount("50");
    setFemaleCount("50");
    setBreedModalOpen(false);
    setBreedScannerOpen(false);
    setTorchEnabled(false);
    setZoomLevel(0);
    setBreedCameraReady(false);
    setIsScanningBreed(false);
    setCapturedPhotoUri(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm();
    }, [resetForm]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      fetchBreedOptions()
        .then((options) => {
          if (!active) return;

          setBreedOptions(
            options.length ? options : [...DEFAULT_BREED_OPTIONS],
          );
        })
        .catch((error) => {
          logError("Breed lookup load failed", error);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const usedBatchColorSet = useMemo(() => new Set<string>(), []);
  const allBatchColorsUsed = false;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!activeFarm?.id) {
        setUsedBatchColorNames([]);
        return () => {
          active = false;
        };
      }

      fetchFarmBatches(activeFarm.id)
        .then((batches) => {
          if (!active) return;

          const used = Array.from(
            new Set(
              batches
                .map((batch) => batch.colorName.trim().toLowerCase())
                .filter(Boolean),
            ),
          );
          const usedSet = new Set(used);
          const nextBatchNo = getNextBatchNo(batches.map((batch) => batch.id));

          if (!active) return;

          setUsedBatchColorNames(used);
          setBatchNo(nextBatchNo);
        })
        .catch((error: unknown) => {
          logError("Batch color lookup failed", error);
        });

      return () => {
        active = false;
      };
    }, [activeFarm?.id]),
  );

  function parseCount(value: string) {
    return Number.parseInt(value || "0", 10) || 0;
  }

  function onChangeTotalCount(next: string) {
    const clean = next.replace(/[^0-9]/g, "");
    setTotalCount(clean);

    if (!clean) {
      setMaleCount("");
      setFemaleCount("");
      return;
    }

    const n = Number.parseInt(clean, 10);
    const nextMale = Math.floor(n / 2);
    const nextFemale = n - nextMale;
    setMaleCount(String(nextMale));
    setFemaleCount(String(nextFemale));
  }

  function onChangeMaleCount(next: string) {
    const clean = next.replace(/[^0-9]/g, "");
    const total = parseCount(totalCount);

    if (!total) {
      setMaleCount(clean);
      return;
    }

    const nextMale = Math.min(parseCount(clean), total);
    const nextFemale = total - nextMale;

    setMaleCount(String(nextMale));
    setFemaleCount(String(nextFemale));
  }

  function onChangeFemaleCount(next: string) {
    const clean = next.replace(/[^0-9]/g, "");
    const total = parseCount(totalCount);

    if (!total) {
      setFemaleCount(clean);
      return;
    }

    const nextFemale = Math.min(parseCount(clean), total);
    const nextMale = total - nextFemale;

    setFemaleCount(String(nextFemale));
    setMaleCount(String(nextMale));
  }

  function closeBreedScanner() {
    setBreedScannerOpen(false);
    setTorchEnabled(false);
    setZoomLevel(0);
    setBreedCameraReady(false);
    setIsScanningBreed(false);
    setCapturedPhotoUri(null);
  }

  async function handleBreedCameraCapture() {
    if (!breedCameraReady || isScanningBreed) {
      Alert.alert(
        "Camera starting",
        "Please wait until the camera preview is ready.",
      );
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }

    const cam = cameraRef.current;
    if (!cam) {
      logStep("Add batch breed camera capture skipped", {
        reason: "no_camera_ref",
      });
      return;
    }

    try {
      const photo = await cam.takePictureAsync({
        quality: 0.88,
        skipProcessing: Platform.OS === "ios",
      });

      setCapturedPhotoUri(photo.uri);
      setIsScanningBreed(true);

      inferBreedFromImage(photo.uri)
        .then((inference) => {
          const topPrediction = inference?.topPrediction;

          if (!topPrediction) {
            Alert.alert(
              "Breed detection unavailable",
              "We couldn't identify a breed from this photo. Please try again with a clearer view of the chicken.",
            );
            setIsScanningBreed(false);
            setCapturedPhotoUri(null);
            return;
          }

          if (isNonChickenClassifierLabel(topPrediction.className)) {
            Alert.alert(
              "Non-chicken detected",
              "The captured image does not appear to contain a chicken. Retake the photo with the chicken clearly inside the frame.",
            );
            setIsScanningBreed(false);
            setCapturedPhotoUri(null);
            return;
          }

          const detectedBreed = mapBreedPredictionToAttributes(topPrediction);

          setBreed(detectedBreed.breedName);
          addRecentBreedScan({
            breedName: detectedBreed.breedName,
            photoUri: photo.uri,
            attributes: detectedBreed,
          });
          logStep("Add batch breed detected from camera", {
            breedName: detectedBreed.breedName,
            modelId: inference?.modelId ?? "unknown",
          });
          closeBreedScanner();
        })
        .catch((error) => {
          Alert.alert(
            "Scan failed",
            "Unable to capture a breed photo right now.",
          );
          logError("Add batch breed camera capture failed", error);
          setIsScanningBreed(false);
          setCapturedPhotoUri(null);
        });
    } catch (error) {
      Alert.alert(
        "Capture failed",
        "Unable to capture a breed photo right now.",
      );
      logError("Add batch camera picture capture failed", error);
    }
  }

  const pageTitle = useMemo(
    () =>
      mode === "chicken" ? "Add New Batch (chicken)" : "Add New Batch (egg)",
    [mode],
  );
  const viewfinderSize = Math.min(width - 64, 320);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + TAB_BAR_OFFSET + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.createHero}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)")
              }
              style={({ pressed }) => [
                styles.createHeroIcon,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={ChickIntelPalette.green1}
              />
            </Pressable>
            <View style={styles.createHeroCopy}>
              <Text style={styles.createHeroKicker}>Chicken profile</Text>
              <Text style={styles.pageTitle}>{pageTitle}</Text>
              <Text style={styles.createHeroSubtitle}>
                Register a flock group with its tag color, age, breed, and sex
                count.
              </Text>
            </View>
          </View>

          <View style={styles.summaryChipRow}>
            <View style={styles.summaryChip}>
              <MaterialCommunityIcons
                name="identifier"
                size={14}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.summaryChipText}>#{batchNo || "Auto"}</Text>
            </View>
            <View style={styles.summaryChip}>
              <View
                style={[
                  styles.summaryColorDot,
                  { backgroundColor: selectedColor.hex },
                ]}
              />
              <Text style={styles.summaryChipText}>{selectedColor.name}</Text>
            </View>
            <View style={styles.summaryChip}>
              <MaterialCommunityIcons
                name="counter"
                size={14}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.summaryChipText}>
                {totalCount || "0"} birds
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <MaterialCommunityIcons
                  name="tag-multiple-outline"
                  size={18}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.formSectionTitle}>Batch identity</Text>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Batch No.</Text>
                  <TextInput
                    value={batchNo}
                    editable={false}
                    selectTextOnFocus={false}
                    placeholder="Auto-generated"
                    style={[styles.input, styles.inputDisabled]}
                    textAlignVertical="center"
                    placeholderTextColor="#8F9696"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Batch Color</Text>
                  <Pressable
                    onPress={() => setColorModalOpen(true)}
                    style={styles.colorDropdownButton}
                    accessibilityRole="button"
                    accessibilityLabel="Select Batch Color"
                  >
                    <View style={styles.colorDropdownLeft}>
                      <View
                        style={[
                          styles.colorDropdownSwatch,
                          { backgroundColor: selectedColor.hex },
                        ]}
                      />
                      <Text style={styles.colorDropdownText} numberOfLines={1}>
                        {selectedColor.name}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={ChickIntelPalette.gray1}
                    />
                  </Pressable>
                  {usedBatchColorNames.length ? (
                    <Text style={styles.colorHint}>
                      Colors used by active batches are disabled.
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <MaterialCommunityIcons
                  name="calendar-heart"
                  size={18}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.formSectionTitle}>Age and breed</Text>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>No.</Text>
                  <TextInput
                    value={durationCount}
                    onChangeText={(v) =>
                      setDurationCount(v.replace(/[^0-9]/g, ""))
                    }
                    placeholder="1"
                    keyboardType="number-pad"
                    style={styles.input}
                    textAlignVertical="center"
                    placeholderTextColor="#8F9696"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Age unit</Text>
                  <Pressable
                    onPress={() =>
                      setAgeUnit((u) =>
                        u === AGE_UNIT_OPTIONS[0]
                          ? AGE_UNIT_OPTIONS[1]
                          : AGE_UNIT_OPTIONS[0],
                      )
                    }
                    style={styles.select}
                    accessibilityRole="button"
                    accessibilityLabel="Select age unit"
                  >
                    <Text style={styles.selectText}>{ageUnit}</Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={ChickIntelPalette.gray2}
                    />
                  </Pressable>
                </View>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Breed</Text>
                <View style={styles.breedSelectRow}>
                  <Pressable
                    onPress={() => setBreedModalOpen(true)}
                    style={[styles.select, styles.breedSelect]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose breed"
                  >
                    <Text
                      style={[
                        styles.selectText,
                        !breed && styles.selectTextPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {breed || "Select breed"}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={ChickIntelPalette.gray2}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setBreedCameraReady(false);
                      setBreedScannerOpen(true);
                    }}
                    style={({ pressed }) => [
                      styles.breedCameraButton,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Scan breed using camera"
                  >
                    <MaterialCommunityIcons
                      name="camera-outline"
                      size={22}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={18}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.formSectionTitle}>Bird count</Text>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Total</Text>
                <TextInput
                  value={totalCount}
                  onChangeText={onChangeTotalCount}
                  placeholder="100"
                  keyboardType="number-pad"
                  style={styles.input}
                  textAlignVertical="center"
                  placeholderTextColor="#8F9696"
                />
              </View>

              <View style={styles.resultRow}>
                <View style={styles.resultField}>
                  <Text style={styles.resultLabel}>Male</Text>
                  <TextInput
                    value={maleCount}
                    onChangeText={onChangeMaleCount}
                    keyboardType="number-pad"
                    style={styles.resultInput}
                    textAlignVertical="center"
                    placeholderTextColor="#8F9696"
                  />
                </View>
                <View style={styles.resultField}>
                  <Text style={styles.resultLabel}>Female</Text>
                  <TextInput
                    value={femaleCount}
                    onChangeText={onChangeFemaleCount}
                    keyboardType="number-pad"
                    style={styles.resultInput}
                    textAlignVertical="center"
                    placeholderTextColor="#8F9696"
                  />
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (!breed.trim()) {
                  Alert.alert(
                    "Breed required",
                    "Select a breed before saving.",
                  );
                  return;
                }

                if (!activeFarm?.id) {
                  Alert.alert("Farm missing", "No active farm was found.");
                  return;
                }

                const generatedBatchNo = batchNo.trim() || getNextBatchNo([]);
                const newBatch = {
                  id: generatedBatchNo,
                  breed: breed || "Unknown",
                  femaleCount: Number.parseInt(femaleCount || "0", 10) || 0,
                  maleCount: Number.parseInt(maleCount || "0", 10) || 0,
                  ageLabel: `${durationCount || "0"} ${ageUnit.toLowerCase()}`,
                  isolatedCount: 0,
                  killedCount: 0,
                  colorName: selectedColor.name,
                  colorHex: selectedColor.hex,
                };

                createFarmBatch(activeFarm.id, newBatch)
                  .then(() => {
                    logStep("Add batch saved to Supabase", {
                      farmId: activeFarm.id,
                      batchNo: newBatch.id,
                    });
                    router.push("/(tabs)/profiles");
                  })
                  .catch((error) => {
                    Alert.alert(
                      "Save failed",
                      "Unable to save the batch right now.",
                    );
                    logError("Add batch save failed", error, {
                      farmId: activeFarm.id,
                      batchNo: newBatch.id,
                    });
                  });
              }}
              style={({ pressed }) => [
                styles.saveButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save batch record"
            >
              <Text style={styles.saveText}>Save Record</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={breedModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBreedModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setBreedModalOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Breed</Text>
            {breedOptions.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  setBreed(opt);
                  setBreedModalOpen(false);
                }}
                style={({ pressed }) => [
                  styles.modalOption,
                  {
                    opacity: pressed ? 0.78 : 1,
                    backgroundColor:
                      breed === opt ? "rgba(156,213,201,0.45)" : "transparent",
                  },
                ]}
              >
                <Text style={styles.modalOptionText}>{opt}</Text>
              </Pressable>
            ))}
            {!breedOptions.length ? (
              <Text style={styles.modalOptionText}>
                No breed options found.
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={breedScannerOpen}
        animationType="slide"
        onRequestClose={closeBreedScanner}
      >
        <View style={styles.cameraModalScreen}>
          <StatusBar style="light" />
          {isScanningBreed && capturedPhotoUri ? (
            <View style={styles.scanLoadingOverlay}>
              <Image
                source={{ uri: capturedPhotoUri }}
                style={styles.scanLoadingImage}
              />
              <View style={styles.scanLoadingContent}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.scanLoadingText}>Scanning breed...</Text>
                <Text style={styles.scanLoadingSubtitle}>
                  Analyzing the captured frame
                </Text>
              </View>
            </View>
          ) : (
            <>
              <CameraViewport
                ref={cameraRef}
                active={breedScannerOpen && !isScanningBreed}
                enableTorch={torchEnabled}
                zoom={zoomLevel}
                onReadyChange={setBreedCameraReady}
              />
              <View style={styles.cameraOverlay} pointerEvents="box-none">
                <View
                  style={[styles.cameraTopRow, { paddingTop: insets.top + 12 }]}
                >
                  <View style={styles.cameraTitleStack}>
                    <Text style={styles.cameraTitle}>Breed camera</Text>
                    <Text style={styles.cameraSubtitle}>
                      Frame the chicken clearly, then capture to fill the breed.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setTorchEnabled((prev) => !prev)}
                    style={({ pressed }) => [
                      styles.cameraIconButton,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      torchEnabled ? "Turn flash off" : "Turn flash on"
                    }
                  >
                    <MaterialCommunityIcons
                      name={torchEnabled ? "flash" : "flash-off"}
                      size={20}
                      color={
                        torchEnabled
                          ? ChickIntelPalette.green1
                          : ChickIntelPalette.gray1
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={closeBreedScanner}
                    style={({ pressed }) => [
                      styles.cameraIconButton,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Close breed camera"
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color={ChickIntelPalette.gray1}
                    />
                  </Pressable>
                </View>

                <View
                  pointerEvents="box-none"
                  style={styles.cameraViewfinderArea}
                >
                  <ViewfinderOverlay size={viewfinderSize} />
                </View>

                <View
                  style={[
                    styles.cameraBottomColumn,
                    { paddingBottom: insets.bottom + 24 },
                  ]}
                >
                  <View style={styles.cameraZoomWrap}>
                    <MaterialCommunityIcons
                      name="magnify-minus-outline"
                      size={16}
                      color={ChickIntelPalette.gray2}
                    />
                    <Slider
                      style={styles.cameraZoomSlider}
                      minimumValue={0}
                      maximumValue={MAX_SCAN_ZOOM}
                      value={zoomLevel}
                      step={0.01}
                      onValueChange={setZoomLevel}
                      minimumTrackTintColor={ChickIntelPalette.green1}
                      maximumTrackTintColor="rgba(67, 139, 123, 0.18)"
                      thumbTintColor={ChickIntelPalette.green2}
                      accessibilityLabel="Breed camera zoom"
                      accessibilityRole="adjustable"
                    />
                    <MaterialCommunityIcons
                      name="magnify-plus-outline"
                      size={16}
                      color={ChickIntelPalette.gray2}
                    />
                  </View>
                  <ScannerShutter
                    onPress={handleBreedCameraCapture}
                    disabled={!breedCameraReady}
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal
        visible={colorModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setColorModalOpen(false)}
      >
        <Pressable
          style={styles.colorModalBackdrop}
          onPress={() => setColorModalOpen(false)}
        >
          <Pressable
            style={styles.colorModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.colorModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.colorModalTitle}>Select Batch Color</Text>
                <Text style={styles.colorModalSubtitle}>
                  Choose a unique color tag for this batch (
                  {COLOR_OPTIONS.length} available)
                </Text>
              </View>
              <Pressable
                onPress={() => setColorModalOpen(false)}
                style={styles.colorModalClose}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#667171"
                />
              </Pressable>
            </View>

            <View style={styles.colorSearchWrap}>
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color="#8F9696"
              />
              <TextInput
                value={colorSearchQuery}
                onChangeText={setColorSearchQuery}
                placeholder="Search colors..."
                style={styles.colorSearchInput}
                placeholderTextColor="#8F9696"
              />
              {colorSearchQuery ? (
                <Pressable onPress={() => setColorSearchQuery("")}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={16}
                    color="#8F9696"
                  />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              style={styles.colorGridScroll}
              contentContainerStyle={styles.colorGridContainer}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {filteredColorOptions.map((opt) => {
                const active = selectedColor.name === opt.name;
                const disabled = usedBatchColorSet.has(opt.name.toLowerCase());
                return (
                  <Pressable
                    key={opt.name}
                    disabled={disabled}
                    onPress={() => {
                      if (!disabled) {
                        setSelectedColor(opt);
                        setColorModalOpen(false);
                        setColorSearchQuery("");
                      }
                    }}
                    style={[
                      styles.colorGridCard,
                      active && styles.colorGridCardActive,
                      disabled && styles.colorGridCardDisabled,
                    ]}
                  >
                    <View
                      style={[
                        styles.colorGridSwatch,
                        { backgroundColor: opt.hex },
                      ]}
                    >
                      {active ? (
                        <MaterialCommunityIcons
                          name="check"
                          size={14}
                          color={
                            opt.name === "White" ||
                            opt.name === "Lemon" ||
                            opt.name === "Mint" ||
                            opt.name === "Lavender"
                              ? "#203029"
                              : "#FFFFFF"
                          }
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.colorGridName,
                        active && styles.colorGridNameActive,
                        disabled && styles.colorGridNameDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {opt.name}
                    </Text>
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
    backgroundColor: ChickIntelPalette.light1,
  },
  colorDropdownButton: {
    height: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    paddingHorizontal: moderateScale(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  colorDropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  colorDropdownSwatch: {
    width: scale(18),
    height: verticalScale(18),
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  colorDropdownText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    flex: 1,
  },
  colorModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(24),
  },
  colorModalCard: {
    width: "100%",
    maxWidth: scale(420),
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: moderateScale(18),
    shadowColor: "#000",
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  colorModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  colorModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  colorModalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#667171",
    marginTop: 2,
  },
  colorModalClose: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 16,
    backgroundColor: "#F0F4F3",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSearchWrap: {
    height: verticalScale(38),
    borderRadius: 10,
    backgroundColor: "#F4F7F6",
    borderWidth: 1,
    borderColor: "#E2E8E6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(10),
    gap: 8,
    marginBottom: 14,
  },
  colorSearchInput: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
    paddingVertical: verticalScale(0),
  },
  colorGridScroll: {
    maxHeight: 380,
  },
  colorGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 10,
  },
  colorGridCard: {
    width: "22%",
    minWidth: scale(72),
    alignItems: "center",
    padding: moderateScale(8),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E4EAE8",
    backgroundColor: "#FAFDFB",
    gap: 6,
  },
  colorGridCardActive: {
    borderColor: ChickIntelPalette.green1,
    backgroundColor: "rgba(49,118,103,0.08)",
  },
  colorGridCardDisabled: {
    opacity: 0.35,
    backgroundColor: "#F0F3F2",
  },
  colorGridSwatch: {
    width: scale(26),
    height: verticalScale(26),
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorGridName: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  colorGridNameActive: {
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  colorGridNameDisabled: {
    color: "#8F9696",
  },
  keyboardArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
  },
  createHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(14),
    backgroundColor: "rgba(202, 227, 221, 0.38)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
  },
  createHeroIcon: {
    width: scale(52),
    height: verticalScale(52),
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254, 254, 254, 0.74)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  createHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  createHeroKicker: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: ChickIntelPalette.green1,
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: ChickIntelPalette.gray1,
  },
  createHeroSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
    marginTop: verticalScale(2),
  },
  summaryChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryChip: {
    flex: 1,
    minHeight: verticalScale(34),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: moderateScale(8),
    backgroundColor: "rgba(254, 254, 254, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  summaryChipText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  summaryColorDot: {
    width: scale(12),
    height: verticalScale(12),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  segmentWrap: {
    flexDirection: "row",
    borderRadius: 5,
    backgroundColor: ChickIntelPalette.lightGreen,
    padding: moderateScale(4),
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.2)",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(10),
    borderRadius: 5,
  },
  segmentActive: {
    backgroundColor: ChickIntelPalette.gray1,
  },
  segmentInactive: {
    backgroundColor: "transparent",
  },
  segmentText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  segmentTextActive: {
    color: ChickIntelPalette.light1,
  },
  segmentTextInactive: {
    color: ChickIntelPalette.gray1,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    backgroundColor: "rgba(254, 254, 254, 0.58)",
    padding: moderateScale(12),
    gap: 12,
  },
  formSection: {
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(12),
    backgroundColor: "rgba(254, 254, 254, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.18)",
  },
  formSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  formSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  halfField: {
    flex: 1,
    gap: 5,
  },
  fieldLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#5E6666",
  },
  input: {
    height: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(0),
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 18,
    color: ChickIntelPalette.gray1,
    textAlignVertical: "center",
  },
  inputDisabled: {
    backgroundColor: "rgba(255,255,255,0.72)",
    color: ChickIntelPalette.gray2,
  },
  colorPickerRow: {
    minHeight: verticalScale(42),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D5DBDB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: verticalScale(10),
  },
  colorSwatch: {
    width: scale(22),
    height: verticalScale(22),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: ChickIntelPalette.gray1,
  },
  colorSwatchDisabled: {
    opacity: 0.35,
  },
  colorHint: {
    marginTop: 8,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray1,
    lineHeight: 18,
  },
  select: {
    height: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(0),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breedSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breedSelect: {
    flex: 1,
  },
  breedCameraButton: {
    width: scale(46),
    height: verticalScale(46),
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.green1,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.28)",
  },
  selectText: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 18,
    color: ChickIntelPalette.gray1,
  },
  selectTextPlaceholder: {
    color: "#8F9696",
  },
  sectionGap: {
    height: verticalScale(4),
  },
  sectionTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#5E6666",
  },
  sexingRow: {
    flexDirection: "row",
    gap: 12,
  },
  sexingColumn: {
    flex: 1,
    gap: 6,
  },
  sexingHeading: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#667171",
  },
  radioRow: {
    minHeight: verticalScale(34),
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.15)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: moderateScale(8),
  },
  radioOuter: {
    width: scale(16),
    height: verticalScale(16),
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#9AA3A3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: ChickIntelPalette.green1,
  },
  radioDot: {
    width: scale(8),
    height: verticalScale(8),
    borderRadius: 4,
    backgroundColor: ChickIntelPalette.green1,
  },
  guideThumb: {
    width: scale(20),
    height: verticalScale(20),
    borderRadius: 5,
    backgroundColor: "rgba(202,227,221,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioText: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
  },
  divider: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(49,118,103,0.18)",
  },
  resultRow: {
    flexDirection: "row",
    gap: 12,
  },
  resultField: {
    flex: 1,
    gap: 5,
  },
  resultLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#667171",
    textAlign: "center",
  },
  resultInput: {
    height: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    paddingVertical: verticalScale(0),
    textAlign: "center",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(16),
    lineHeight: 18,
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    textAlignVertical: "center",
  },
  saveButton: {
    marginTop: 8,
    height: verticalScale(52),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.green1,
    shadowColor: "#317667",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(5) },
    elevation: 3,
  },
  saveText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(51,51,51,0.38)",
    justifyContent: "center",
    paddingHorizontal: moderateScale(24),
  },
  modalCard: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    backgroundColor: "#FFFFFF",
    padding: moderateScale(14),
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    marginBottom: 8,
  },
  modalOption: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(10),
    borderRadius: 10,
  },
  modalOptionText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: ChickIntelPalette.gray1,
  },
  cameraModalScreen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.green1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  cameraTopRow: {
    paddingHorizontal: moderateScale(18),
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cameraTitleStack: {
    flex: 1,
    gap: 3,
  },
  cameraTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(20),
    lineHeight: 26,
    fontWeight: "800",
    color: ChickIntelPalette.light1,
    textShadowColor: ChickIntelPalette.green1,
    textShadowOffset: { width: scale(0), height: verticalScale(0) },
    textShadowRadius: 10,
  },
  cameraSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "500",
    color: ChickIntelPalette.gray2,
    maxWidth: scale(260),
  },
  cameraIconButton: {
    width: scale(40),
    height: verticalScale(40),
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
  },
  cameraViewfinderArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBottomColumn: {
    paddingHorizontal: moderateScale(18),
    alignItems: "center",
    gap: 10,
  },
  cameraZoomWrap: {
    width: "70%",
    maxWidth: scale(320),
    minHeight: verticalScale(42),
    borderRadius: 999,
    paddingHorizontal: moderateScale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.18)",
  },
  cameraZoomSlider: {
    flex: 1,
    height: verticalScale(32),
  },
  /* Quick note modal (dark) */
  quickModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,18,16,0.66)",
    justifyContent: "flex-end",
    paddingHorizontal: moderateScale(12),
    paddingTop: 12,
    paddingBottom: 12,
  },
  quickModalScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  quickModalCard: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(55, 129, 118, 0.92)",
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    minHeight: verticalScale(220),
  },
  quickModalMessage: {
    color: "#FFFFFF",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(16),
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 12,
  },
  quickNoteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 8,
    padding: moderateScale(10),
    minHeight: verticalScale(100),
    color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.04)",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    lineHeight: 18,
    textAlignVertical: "top",
  },
  quickModalActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  quickCancel: {
    flex: 1,
    height: verticalScale(40),
    borderRadius: 8,
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171717",
  },
  quickCancelText: {
    color: "#FFFFFF",
    fontFamily: ChickFont.sans,
    fontWeight: "600",
  },
  quickSave: {
    flex: 1,
    height: verticalScale(40),
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  quickSaveText: {
    color: "#000000",
    fontFamily: ChickFont.sans,
    fontWeight: "700",
  },
  scanLoadingOverlay: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  scanLoadingImage: {
    width: "100%",
    height: "100%",
    opacity: 0.5,
  },
  scanLoadingContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  scanLoadingText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  scanLoadingSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
  },
});
