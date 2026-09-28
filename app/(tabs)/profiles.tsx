import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ChickenIcon } from "@/components/icons/chicken-icon";
import {
    CameraViewport,
    type CameraViewportRef,
} from "@/components/scanner/camera-viewport";
import { ScannerShutter } from "@/components/scanner/scanner-shutter";
import { ViewfinderOverlay } from "@/components/scanner/viewfinder-overlay";
import { BlurCard } from "@/components/ui/blur-card";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import {
    type BatchItem,
    type EggBatchItem,
    formatBatchDateStamp,
    formatEggFertilityPercent,
    getCurrentBatchAgeLabel,
} from "@/utils/batch-store";
import {
    MIN_CHICKEN_BATCH_AGE_WEEKS,
    SEXING_START_AGE_WEEKS,
    getCurrentBatchAgeDays,
} from "@/utils/chicken-batch-rules";
import { optimizePhotoForInference } from "@/utils/image-crop-helper";
import { logError, logStep } from "@/utils/logger";
import {
    inferSexFromImage,
    resolveSexDetails,
} from "@/utils/sexing-image-inference";
import {
    deleteFarmBatch,
    fetchFarmBatches,
    updateFarmBatch,
} from "@/utils/supabase-batches";
import { recordDeletedChickenBatch } from "@/utils/supabase-chicken-batch-history";
import {
    fetchFarmEggBatches,
    updateFarmEggBatch,
} from "@/utils/supabase-egg-batches";

const TAB_BAR_OFFSET = 55;
const FAB_OFFSET_FROM_TAB_TOP = 50;
const AGE_UNIT_OPTIONS = ["Weeks", "Days"] as const;
const MIN_EGG_BATCH_CREATE_AGE_WEEKS = 8;
const CHICKEN_BATCH_PAGE_SIZE = 5;

type EggColorCard = {
    id: string;
    breed: string;
    colorName: string;
    colorHex: string;
    originBatchNo: string;
    rawBatchNo: string;
    batches: number;
    fertilityRate: string;
    createdAt?: string;
    updatedAt?: string;
};

type ChickenEditFormState = {
    breed: string;
    totalCount: string;
    femaleCount: string;
    maleCount: string;
    isolatedCount: string;
    killedCount: string;
    ageCount: string;
    ageLabel: (typeof AGE_UNIT_OPTIONS)[number];
};

function parseCount(value: string) {
    return Math.max(0, Number.parseInt(value || "0", 10) || 0);
}

function parseAgeLabel(value: string) {
    return value.match(/\d+(?:\.\d+)?/)?.[0] ?? "0";
}

function clampNonNegative(value: number) {
    return Math.max(0, value);
}

function getDerivedUnhatchedQty(
    eggQty: number,
    hatchedQty: number,
    damagedQty: number,
) {
    return clampNonNegative(eggQty - hatchedQty - damagedQty);
}

function formatProfileBatchId(prefix: "C" | "E", value: string | number) {
    const digits = String(value).replace(/[^0-9]/g, "");
    return `BATCH ${prefix}${(digits || "1").padStart(3, "0")}`;
}

function formatCreatedDate(value?: string) {
    if (!value) return "Date unavailable";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return `Added ${date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })}`;
}

export default function ProfilesScreen() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const router = useRouter();
    const { activeFarm } = useAuth();
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);
    const { mode: profileModeParam } = useLocalSearchParams<{
        mode?: string;
    }>();
    const [mode, setMode] = useState<"chicken" | "egg">(
        profileModeParam === "egg" ? "egg" : "chicken",
    );

    useEffect(() => {
        if (profileModeParam === "egg" || profileModeParam === "chicken") {
            setMode(profileModeParam);
        }
    }, [profileModeParam]);

    const [chickenData, setChickenData] = useState<BatchItem[]>([]);
    const [chickenLoading, setChickenLoading] = useState(true);
    const [chickenError, setChickenError] = useState<string | null>(null);

    const [savedEggBatches, setSavedEggBatches] = useState<EggBatchItem[]>([]);
    const [eggError, setEggError] = useState<string | null>(null);

    const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
    const [editVisible, setEditVisible] = useState(false);
    const [sexScannerOpen, setSexScannerOpen] = useState(false);
    const [sexCameraReady, setSexCameraReady] = useState(false);
    const [sexTorchEnabled, setSexTorchEnabled] = useState(false);
    const [sexZoomLevel, setSexZoomLevel] = useState(0);
    const [isScanningSex, setIsScanningSex] = useState(false);
    const [capturedSexPhotoUri, setCapturedSexPhotoUri] = useState<
        string | null
    >(null);
    const sexCameraRef = useRef<CameraViewportRef>(null);
    const [ageUnitMenuVisible, setAgeUnitMenuVisible] = useState(false);
    const [formState, setFormState] = useState<ChickenEditFormState>({
        breed: "",
        totalCount: "",
        femaleCount: "",
        maleCount: "",
        isolatedCount: "",
        killedCount: "",
        ageCount: "",
        ageLabel: AGE_UNIT_OPTIONS[0],
    });

    const [batchToDelete, setBatchToDelete] = useState<BatchItem | null>(null);
    const [isDeletingBatch, setIsDeletingBatch] = useState(false);

    const [selectedEgg, setSelectedEgg] = useState<EggBatchItem | null>(null);
    const [eggEditVisible, setEggEditVisible] = useState(false);
    const [eggForm, setEggForm] = useState({
        batchNo: "",
        eggQty: "",
        lineNo: "",
        ageUnit: "",
        origin: "",
    });

    const loadChickenBatches = useCallback(async () => {
        if (!activeFarm?.id) {
            setChickenData([]);
            setChickenLoading(false);
            return;
        }

        setChickenLoading(true);
        setChickenError(null);

        try {
            const rows = await fetchFarmBatches(activeFarm.id);
            setChickenData(rows);
            logStep("Profiles chicken batches loaded", {
                farmId: activeFarm.id,
                count: rows.length,
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to load chicken batches.";
            setChickenError(message);
            logError("Profiles chicken batches load failed", error, {
                farmId: activeFarm.id,
            });
        } finally {
            setChickenLoading(false);
        }
    }, [activeFarm?.id]);

    const loadEggBatches = useCallback(async () => {
        if (!activeFarm?.id) {
            setSavedEggBatches([]);
            setEggError(null);
            return;
        }

        setEggError(null);
        try {
            const rows = await fetchFarmEggBatches(activeFarm.id);
            setSavedEggBatches(rows);
        } catch (error) {
            setEggError(
                error instanceof Error
                    ? error.message
                    : "Unable to load egg batches.",
            );
            logError("Profiles egg batches load failed", error, {
                farmId: activeFarm.id,
            });
        }
    }, [activeFarm?.id]);

    useEffect(() => {
        void loadChickenBatches();
        void loadEggBatches();
    }, [loadChickenBatches, loadEggBatches]);

    useFocusEffect(
        useCallback(() => {
            void loadChickenBatches();
            void loadEggBatches();
        }, [loadChickenBatches, loadEggBatches]),
    );

    function openEdit(item: BatchItem) {
        setSelectedBatch(item);
        setFormState({
            breed: item.breed || "",
            totalCount: String(
                item.totalCount ?? item.femaleCount + item.maleCount,
            ),
            femaleCount: String(item.femaleCount ?? 0),
            maleCount: String(item.maleCount ?? 0),
            isolatedCount: String(item.isolatedCount ?? 0),
            killedCount: String(item.killedCount ?? 0),
            ageCount: parseAgeLabel(item.ageLabel),
            ageLabel: /day/i.test(item.ageLabel) ? "Days" : "Weeks",
        });
        setEditVisible(true);
    }

    function openEggBatches(item: BatchItem) {
        router.push({
            pathname: "/(tabs)/eggbatchitem/[color]" as any,
            params: {
                color: item.colorName,
                colorHex: item.colorHex,
                batchNo: item.id,
                originBatchNo: item.id,
                detailMode: "parent",
                breed: item.breed,
            },
        });
    }

    function closeEdit() {
        setEditVisible(false);
        setSelectedBatch(null);
        closeSexScanner();
    }

    const sexingEligible =
        parseCount(formState.ageCount) >= SEXING_START_AGE_WEEKS;

    function onEditFemaleCountChange(value: string) {
        const total = parseCount(formState.totalCount);
        const female = Math.min(
            parseCount(value.replace(/[^0-9]/g, "")),
            total,
        );
        setFormState((state) => ({
            ...state,
            femaleCount: String(female),
            maleCount: String(total - female),
        }));
    }

    function onEditMaleCountChange(value: string) {
        const total = parseCount(formState.totalCount);
        const male = Math.min(parseCount(value.replace(/[^0-9]/g, "")), total);
        setFormState((state) => ({
            ...state,
            maleCount: String(male),
            femaleCount: String(total - male),
        }));
    }

    function closeSexScanner() {
        setSexScannerOpen(false);
        setSexCameraReady(false);
        setSexTorchEnabled(false);
        setSexZoomLevel(0);
        setIsScanningSex(false);
        setCapturedSexPhotoUri(null);
    }

    async function handleEditSexCapture() {
        if (
            !sexingEligible ||
            !sexCameraReady ||
            !sexCameraRef.current ||
            isScanningSex
        ) {
            return;
        }

        try {
            const rawPhoto = await sexCameraRef.current.takePictureAsync({
                quality: 0.8,
                skipProcessing: Platform.OS === "ios",
            });
            const photo = await optimizePhotoForInference({
                photoUri: rawPhoto.uri,
                photoWidth: rawPhoto.width,
                photoHeight: rawPhoto.height,
                maxDimension: 1024,
                quality: 0.8,
            });

            setCapturedSexPhotoUri(photo.uri);
            setIsScanningSex(true);
            const inference = await inferSexFromImage(photo.uri);
            const details = resolveSexDetails(inference);

            if (details.sex === "male" || details.sex === "female") {
                setFormState((state) => {
                    const male = parseCount(state.maleCount);
                    const female = parseCount(state.femaleCount);
                    const total = parseCount(state.totalCount);

                    if (total > 0) {
                        if (details.sex === "female") {
                            const nextFemale = Math.min(total, female + 1);
                            const nextMale = total - nextFemale;
                            return {
                                ...state,
                                femaleCount: String(nextFemale),
                                maleCount: String(nextMale),
                            };
                        } else {
                            const nextMale = Math.min(total, male + 1);
                            const nextFemale = total - nextMale;
                            return {
                                ...state,
                                maleCount: String(nextMale),
                                femaleCount: String(nextFemale),
                            };
                        }
                    }

                    const nextMale = details.sex === "male" ? male + 1 : male;
                    const nextFemale =
                        details.sex === "female" ? female + 1 : female;
                    return {
                        ...state,
                        maleCount: String(nextMale),
                        femaleCount: String(nextFemale),
                        totalCount: String(nextMale + nextFemale),
                    };
                });
            } else {
                Alert.alert(
                    "No sex detected",
                    "Try another angle with the chicken clearly centered.",
                );
            }
        } catch (error) {
            Alert.alert(
                "Capture failed",
                "Unable to classify the chicken sex.",
            );
            logError("Edit chicken batch sex camera failed", error);
        } finally {
            closeSexScanner();
        }
    }

    async function saveEdit() {
        if (!selectedBatch) return closeEdit();
        const enteredAge = parseCount(formState.ageCount);
        const ageInDays = enteredAge * (formState.ageLabel === "Days" ? 1 : 7);

        if (ageInDays < MIN_CHICKEN_BATCH_AGE_WEEKS * 7) {
            Alert.alert(
                "Chicken is too young",
                formState.ageLabel === "Days"
                    ? `Chicken batches must be at least 14 days old (2 weeks).`
                    : `Chicken batches must be at least ${MIN_CHICKEN_BATCH_AGE_WEEKS} weeks old.`,
            );
            return;
        }

        const totalCount = parseCount(formState.totalCount);
        const femaleCount = parseCount(formState.femaleCount);
        const maleCount = parseCount(formState.maleCount);
        const classifiedCount = femaleCount + maleCount;
        if (classifiedCount > totalCount) {
            Alert.alert(
                "Check chicken counts",
                "Male + Female counts cannot be greater than the total chicken count.",
            );
            return;
        }
        const unknownCount = totalCount - classifiedCount;

        const updated: BatchItem = {
            ...selectedBatch,
            breed: formState.breed,
            totalCount,
            femaleCount,
            maleCount,
            unknownCount,
            isolatedCount: parseCount(formState.isolatedCount),
            killedCount: parseCount(formState.killedCount),
            ageLabel: `${enteredAge} ${formState.ageLabel.toLowerCase()}`,
        };
        if (!activeFarm?.id) {
            Alert.alert("Farm missing", "No active farm was found.");
            return;
        }
        try {
            await updateFarmBatch(activeFarm.id, selectedBatch.id, updated);
            setChickenData((prev) =>
                prev.map((item) =>
                    item.id === selectedBatch.id ? updated : item,
                ),
            );
            logStep("Profiles chicken batch updated", {
                farmId: activeFarm.id,
                batchNo: selectedBatch.id,
            });
        } catch (error) {
            Alert.alert("Update failed", "Unable to save the batch changes.");
            logError("Profiles chicken batch update failed", error, {
                farmId: activeFarm.id,
                batchNo: selectedBatch.id,
            });
            return;
        }
        closeEdit();
    }

    function closeEggEdit() {
        setEggEditVisible(false);
        setSelectedEgg(null);
    }

    async function saveEggEdit() {
        if (!selectedEgg) return closeEggEdit();
        const updated: EggBatchItem = {
            ...selectedEgg,
            batchNo: eggForm.batchNo,
            eggQty: parseCount(eggForm.eggQty),
            lineNo: parseCount(eggForm.lineNo),
            ageUnit:
                (eggForm.ageUnit as EggBatchItem["ageUnit"]) ||
                selectedEgg.ageUnit,
            origin: eggForm.origin,
            colorName: selectedEgg.colorName ?? eggForm.origin,
            colorHex: selectedEgg.colorHex,
            unhatchedQty: getDerivedUnhatchedQty(
                parseCount(eggForm.eggQty),
                selectedEgg.hatchedQty ?? 0,
                selectedEgg.damagedQty ?? 0,
            ),
            updatedAt: new Date().toISOString(),
        };
        if (!activeFarm?.id) {
            Alert.alert("Farm missing", "No active farm was found.");
            return;
        }
        try {
            await updateFarmEggBatch(activeFarm.id, selectedEgg.id, updated);
            setSavedEggBatches((prev) =>
                prev.map((egg) => (egg.id === selectedEgg.id ? updated : egg)),
            );
        } catch (error) {
            Alert.alert("Update failed", "Unable to save egg batch changes.");
            logError("Profiles egg batch update failed", error, {
                farmId: activeFarm.id,
                eggBatchId: selectedEgg.id,
            });
            return;
        }
        closeEggEdit();
    }

    function confirmRemove(item: BatchItem) {
        setBatchToDelete(item);
    }

    async function handleDeleteBatchConfirm() {
        if (!batchToDelete || !activeFarm?.id) return;
        setIsDeletingBatch(true);
        try {
            await recordDeletedChickenBatch(activeFarm.id, batchToDelete);
            await deleteFarmBatch(activeFarm.id, batchToDelete.id);
            setChickenData((prev) =>
                prev.filter((item) => item.id !== batchToDelete.id),
            );
            logStep("Profiles chicken batch deleted", {
                farmId: activeFarm.id,
                batchNo: batchToDelete.id,
            });
            setBatchToDelete(null);
        } catch (error) {
            Alert.alert(
                "Delete failed",
                "Unable to delete this batch right now.",
            );
            logError("Profiles chicken batch delete failed", error, {
                farmId: activeFarm.id,
                batchNo: batchToDelete.id,
            });
        } finally {
            setIsDeletingBatch(false);
        }
    }

    const eggColorCards = useMemo<EggColorCard[]>(() => {
        const batchMap = new Map<
            string,
            {
                batchNo: string;
                breed: string;
                createdAt?: string;
                updatedAt?: string;
                colorName: string;
                colorHex: string;
                count: number;
                hatchedQty: number;
                damagedQty: number;
                unhatchedQty: number;
            }
        >();

        chickenData
            .filter((batch) => !batch.originBatchNo?.trim())
            .forEach((batch) => {
                const key = batch.id.trim().toLowerCase();
                if (!batchMap.has(key)) {
                    batchMap.set(key, {
                        batchNo: batch.id,
                        breed: batch.breed,
                        createdAt: batch.createdAt,
                        updatedAt: batch.updatedAt,
                        colorName: batch.colorName || "Default",
                        colorHex: batch.colorHex || ChickIntelPalette.gray2,
                        count: 0,
                        hatchedQty: 0,
                        damagedQty: 0,
                        unhatchedQty: 0,
                    });
                }
            });

        savedEggBatches.forEach((egg) => {
            const parentBatchNo = (egg.origin || egg.batchNo || "").trim();
            const key = parentBatchNo.toLowerCase();

            const existing = batchMap.get(key) ?? {
                batchNo: parentBatchNo || "0001",
                breed: "",
                createdAt: egg.createdAt,
                updatedAt: egg.updatedAt,
                colorName: egg.colorName || egg.origin || "Unspecified",
                colorHex: egg.colorHex || ChickIntelPalette.gray2,
                count: 0,
                hatchedQty: 0,
                damagedQty: 0,
                unhatchedQty: 0,
            };

            const eggLatest = egg.updatedAt || egg.createdAt;
            const existingLatest = existing.updatedAt || existing.createdAt;
            if (eggLatest && (!existingLatest || eggLatest > existingLatest)) {
                existing.updatedAt = egg.updatedAt;
                existing.createdAt = egg.createdAt;
            }

            existing.count += 1;
            existing.hatchedQty += egg.hatchedQty ?? 0;
            existing.damagedQty += egg.damagedQty ?? 0;
            existing.unhatchedQty += getDerivedUnhatchedQty(
                egg.eggQty ?? 0,
                egg.hatchedQty ?? 0,
                egg.damagedQty ?? 0,
            );

            batchMap.set(key, existing);
        });

        return [...batchMap.values()].map((item) => {
            const formattedBatchNo = item.batchNo.trim();

            return {
                id: `egg-${item.batchNo}`,
                breed: item.breed,
                colorName: item.colorName,
                colorHex: item.colorHex,
                originBatchNo: formattedBatchNo,
                rawBatchNo: item.batchNo,
                batches: item.count,
                fertilityRate: formatEggFertilityPercent({
                    hatchedQty: item.hatchedQty,
                    damagedQty: item.damagedQty,
                    unhatchedQty: item.unhatchedQty,
                }),
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            };
        });
    }, [chickenData, savedEggBatches]);

    const chickenEggSummaries = useMemo(() => {
        const summaries: Record<
            string,
            {
                batchCount: number;
                totalEggs: number;
                hatched: number;
                unhatched: number;
                damaged: number;
            }
        > = {};

        savedEggBatches.forEach((egg) => {
            const key = (egg.origin || "").trim().toLowerCase();
            if (!key) return;
            const summary = summaries[key] ?? {
                batchCount: 0,
                totalEggs: 0,
                hatched: 0,
                unhatched: 0,
                damaged: 0,
            };
            summary.batchCount += 1;
            summary.totalEggs += egg.eggQty ?? 0;
            summary.hatched += egg.hatchedQty ?? 0;
            summary.unhatched += egg.unhatchedQty ?? 0;
            summary.damaged += egg.damagedQty ?? 0;
            summaries[key] = summary;
        });

        return summaries;
    }, [savedEggBatches]);

    const chickenSubBatchSummaries = useMemo(() => {
        return chickenData.reduce<
            Record<string, { batchCount: number; chicks: number }>
        >((summaries, batch) => {
            const origin = batch.originBatchNo?.trim().toLowerCase();
            if (!origin) return summaries;

            const summary = summaries[origin] ?? { batchCount: 0, chicks: 0 };
            summary.batchCount += 1;
            summary.chicks += batch.totalCount ?? 0;
            summaries[origin] = summary;
            return summaries;
        }, {});
    }, [chickenData]);

    const parentChickenBatches = useMemo(
        () => chickenData.filter((batch) => !batch.originBatchNo?.trim()),
        [chickenData],
    );

    const activeBreedData = useMemo(() => {
        const counts: Record<string, number> = {};
        const breeds = new Map<string, string>();

        parentChickenBatches.forEach((batch) => {
            const total =
                batch.totalCount ??
                batch.femaleCount + batch.maleCount + (batch.unknownCount ?? 0);
            const alive = Math.max(total - (batch.killedCount ?? 0), 0);
            const breed = batch.breed?.trim();

            if (alive > 0 && breed) {
                const key = breed.toLowerCase();
                if (!breeds.has(key)) breeds.set(key, breed);
                counts[key] = (counts[key] ?? 0) + alive;
            }
        });

        const names = Array.from(breeds.values()).sort((left, right) =>
            left.localeCompare(right),
        );

        return {
            names,
            counts,
            getCount: (name?: string | null) => {
                if (!name) return 0;
                return counts[name.toLowerCase()] ?? 0;
            },
        };
    }, [parentChickenBatches]);

    const activeBreedNames = activeBreedData.names;
    const [selectedBreed, setSelectedBreed] = useState<string | null>(null);
    const [breedMenuVisible, setBreedMenuVisible] = useState(false);
    const breedSelectorRef = useRef<View>(null);
    const [breedMenuCoords, setBreedMenuCoords] = useState<{
        x: number;
        y: number;
        width: number;
    } | null>(null);

    const handleToggleBreedMenu = useCallback(() => {
        if (breedMenuVisible) {
            setBreedMenuVisible(false);
            return;
        }
        breedSelectorRef.current?.measureInWindow((x, y, width, height) => {
            setBreedMenuCoords({ x, y: y + height + 4, width });
            setBreedMenuVisible(true);
        });
    }, [breedMenuVisible]);

    const selectedBreedCount = activeBreedData.getCount(selectedBreed);

    useEffect(() => {
        if (
            selectedBreed &&
            activeBreedNames.some(
                (breed) => breed.toLowerCase() === selectedBreed.toLowerCase(),
            )
        ) {
            return;
        }

        setSelectedBreed(activeBreedNames[0] ?? null);
    }, [activeBreedNames, selectedBreed]);

    // Chicken Dashboard Metrics
    const chickenDashboard = useMemo(() => {
        let totalBirds = 0;
        let totalAlive = 0;
        let totalMales = 0;
        let totalFemales = 0;
        let totalIsolated = 0;
        let totalLoss = 0;
        let totalEggBatches = 0;
        let totalEggs = 0;

        parentChickenBatches.forEach((batch) => {
            const batchTotal =
                batch.totalCount ??
                batch.femaleCount + batch.maleCount + (batch.unknownCount ?? 0);
            const loss = batch.killedCount ?? 0;
            const isolated = batch.isolatedCount ?? 0;
            const alive = Math.max(batchTotal - loss, 0);

            totalBirds += batchTotal;
            totalAlive += alive;
            totalMales += batch.maleCount ?? 0;
            totalFemales += batch.femaleCount ?? 0;
            totalIsolated += isolated;
            totalLoss += loss;

            const eggSummary =
                chickenEggSummaries[batch.id.trim().toLowerCase()];
            if (eggSummary) {
                totalEggBatches += eggSummary.batchCount ?? 0;
                totalEggs += eggSummary.totalEggs ?? 0;
            }
        });

        const survivalRate =
            totalBirds > 0 ? Math.round((totalAlive / totalBirds) * 100) : 100;

        return {
            batchCount: parentChickenBatches.length,
            currentlyAlive: totalAlive,
            totalBirds,
            totalMales,
            totalFemales,
            totalIsolated,
            totalLoss,
            survivalRate,
            totalEggBatches,
            totalEggs,
        };
    }, [parentChickenBatches, chickenEggSummaries]);

    // Chicken Search, Filter & Sort State
    const [chickenSearch, setChickenSearch] = useState("");
    const [chickenFilter, setChickenFilter] = useState<
        "all" | "active" | "isolated" | "eggs"
    >("all");
    const [chickenSort, setChickenSort] = useState<
        "asc" | "desc" | "population" | "newest"
    >("asc");
    const [dashCardIndex, setDashCardIndex] = useState(0);
    const [chickenPage, setChickenPage] = useState(0);

    // Filtered & Sorted Chicken Batches
    const filteredChickenBatches = useMemo(() => {
        let list = [...parentChickenBatches];

        const q = chickenSearch.trim().toLowerCase();
        if (q) {
            list = list.filter((batch) => {
                const idMatch =
                    batch.id.toLowerCase().includes(q) ||
                    `c${batch.id}`.toLowerCase().includes(q);
                const breedMatch = (batch.breed || "")
                    .toLowerCase()
                    .includes(q);
                const colorMatch = (batch.colorName || "")
                    .toLowerCase()
                    .includes(q);
                const notesMatch = batch.notes?.some((n) =>
                    n.text.toLowerCase().includes(q),
                );
                return idMatch || breedMatch || colorMatch || notesMatch;
            });
        }

        if (chickenFilter === "active") {
            list = list.filter((b) => {
                const total =
                    b.totalCount ??
                    b.femaleCount + b.maleCount + (b.unknownCount ?? 0);
                const alive = Math.max(total - (b.killedCount ?? 0), 0);
                return alive > 0;
            });
        } else if (chickenFilter === "isolated") {
            list = list.filter((b) => (b.isolatedCount ?? 0) > 0);
        } else if (chickenFilter === "eggs") {
            list = list.filter((b) => {
                const sum = chickenEggSummaries[b.id.trim().toLowerCase()];
                return sum && sum.batchCount > 0;
            });
        }

        list.sort((a, b) => {
            if (chickenSort === "asc") {
                const numA = parseInt(a.id.replace(/\D/g, "") || "0", 10);
                const numB = parseInt(b.id.replace(/\D/g, "") || "0", 10);
                return numA - numB;
            }
            if (chickenSort === "desc") {
                const numA = parseInt(a.id.replace(/\D/g, "") || "0", 10);
                const numB = parseInt(b.id.replace(/\D/g, "") || "0", 10);
                return numB - numA;
            }
            if (chickenSort === "population") {
                const totalA =
                    a.totalCount ??
                    a.femaleCount + a.maleCount + (a.unknownCount ?? 0);
                const totalB =
                    b.totalCount ??
                    b.femaleCount + b.maleCount + (b.unknownCount ?? 0);
                return totalB - totalA;
            }
            if (chickenSort === "newest") {
                return (
                    new Date(b.createdAt || 0).getTime() -
                    new Date(a.createdAt || 0).getTime()
                );
            }
            return 0;
        });

        return list;
    }, [
        parentChickenBatches,
        chickenSearch,
        chickenFilter,
        chickenSort,
        chickenEggSummaries,
    ]);

    const chickenPageCount = Math.max(
        1,
        Math.ceil(filteredChickenBatches.length / CHICKEN_BATCH_PAGE_SIZE),
    );
    const paginatedChickenBatches = useMemo(
        () =>
            filteredChickenBatches.slice(
                chickenPage * CHICKEN_BATCH_PAGE_SIZE,
                (chickenPage + 1) * CHICKEN_BATCH_PAGE_SIZE,
            ),
        [filteredChickenBatches, chickenPage],
    );

    useEffect(() => {
        setChickenPage(0);
    }, [chickenSearch, chickenFilter, chickenSort]);

    useEffect(() => {
        setChickenPage((current) => Math.min(current, chickenPageCount - 1));
    }, [chickenPageCount]);

    // Egg Search & Sort State
    const [eggSearch, setEggSearch] = useState("");
    const [eggSort, setEggSort] = useState<
        "newest" | "oldest" | "asc" | "desc"
    >("newest");

    const filteredEggCards = useMemo(() => {
        let list = [...eggColorCards];
        const q = eggSearch.trim().toLowerCase();
        if (q) {
            list = list.filter((egg) => {
                const colorMatch = (egg.colorName || "")
                    .toLowerCase()
                    .includes(q);
                const breedMatch = (egg.breed || "").toLowerCase().includes(q);
                const originMatch = (egg.originBatchNo || "")
                    .toLowerCase()
                    .includes(q);
                return colorMatch || breedMatch || originMatch;
            });
        }
        list.sort((a, b) => {
            if (eggSort === "asc") {
                const numA = parseInt(
                    (a.originBatchNo || "0").replace(/\D/g, "") || "0",
                    10,
                );
                const numB = parseInt(
                    (b.originBatchNo || "0").replace(/\D/g, "") || "0",
                    10,
                );
                return numA - numB;
            }
            if (eggSort === "desc") {
                const numA = parseInt(
                    (a.originBatchNo || "0").replace(/\D/g, "") || "0",
                    10,
                );
                const numB = parseInt(
                    (b.originBatchNo || "0").replace(/\D/g, "") || "0",
                    10,
                );
                return numB - numA;
            }
            return 0;
        });
        return list;
    }, [eggColorCards, eggSearch, eggSort]);

    const canCreateEggBatch = useMemo(
        () =>
            parentChickenBatches.some(
                (batch) =>
                    getCurrentBatchAgeDays(batch) >=
                    MIN_EGG_BATCH_CREATE_AGE_WEEKS * 7,
            ),
        [parentChickenBatches],
    );

    const fabBottom = TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP;

    return (
        <SafeAreaView
            style={[
                styles.screen,
                { backgroundColor: ChickIntelPalette.canvas },
            ]}
            edges={["top"]}
        >
            <StatusBar style="dark" />
            <View style={styles.fixedHeader}>
                <View style={styles.pageHeaderRow}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.backButton,
                            { opacity: pressed ? 0.75 : 1 },
                        ]}
                        onPress={() =>
                            router.canGoBack()
                                ? router.back()
                                : router.replace("/(tabs)")
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={ChickIntelPalette.gray1}
                        />
                    </Pressable>

                    <Text
                        style={[
                            styles.pageTitle,
                            { color: ChickIntelPalette.gray1 },
                        ]}
                        numberOfLines={1}
                    >
                        {mode === "chicken"
                            ? "Chicken Batch Profile"
                            : "Egg Batch Profile"}
                    </Text>

                    {mode === "egg" ? (
                        <View style={styles.headerActions}>
                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname:
                                            "/(tabs)/egg-fertility-report" as any,
                                        params: { overview: "Weekly" },
                                    })
                                }
                                style={styles.eggAnalyticsIconButton}
                                accessibilityRole="button"
                                accessibilityLabel="Open egg fertility report"
                            >
                                <MaterialCommunityIcons
                                    name="chart-donut"
                                    size={22}
                                    color={ChickIntelPalette.gray1}
                                />
                            </Pressable>
                            <Pressable
                                onPress={() =>
                                    router.push(
                                        "/(tabs)/egg-batch-history" as any,
                                    )
                                }
                                style={styles.eggAnalyticsIconButton}
                                accessibilityRole="button"
                                accessibilityLabel="Open egg batch history"
                            >
                                <MaterialCommunityIcons
                                    name="history"
                                    size={24}
                                    color={ChickIntelPalette.gray1}
                                />
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            onPress={() =>
                                router.push(
                                    "/(tabs)/chicken-batch-history" as any,
                                )
                            }
                            style={styles.eggAnalyticsIconButton}
                            accessibilityRole="button"
                            accessibilityLabel="Open chicken batch history"
                        >
                            <MaterialCommunityIcons
                                name="history"
                                size={24}
                                color={ChickIntelPalette.gray1}
                            />
                        </Pressable>
                    )}
                </View>
                <View style={styles.segmentStickyHeader}>
                    <View style={styles.segmentWrap}>
                        <Pressable
                            onPress={() => setMode("chicken")}
                            style={[
                                styles.segment,
                                mode === "chicken"
                                    ? styles.segmentActive
                                    : styles.segmentInactive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    mode === "chicken"
                                        ? styles.segmentTextActive
                                        : styles.segmentTextInactive,
                                ]}
                            >
                                Chicken Batch
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setMode("egg")}
                            style={[
                                styles.segment,
                                mode === "egg"
                                    ? styles.segmentActive
                                    : styles.segmentInactive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    mode === "egg"
                                        ? styles.segmentTextActive
                                        : styles.segmentTextInactive,
                                ]}
                            >
                                Egg Batch
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: 10,
                        paddingBottom: 78,
                    },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                {mode === "chicken" ? (
                    <View style={styles.list}>
                        {/* Chicken Batch Executive Dashboard */}
                        <View style={styles.dashboardContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.dashboardCarousel}
                                onScroll={(e) => {
                                    const offsetX =
                                        e.nativeEvent.contentOffset.x;
                                    const cardStep =
                                        scale(165) + moderateScale(10);
                                    const index = Math.min(
                                        4,
                                        Math.max(
                                            0,
                                            Math.round(offsetX / cardStep),
                                        ),
                                    );
                                    setDashCardIndex(index);
                                }}
                                scrollEventThrottle={16}
                            >
                                {/* 1. Currently Alive (Hero Card) */}
                                <View style={styles.dashKpiCard}>
                                    <View style={styles.dashKpiTopRow}>
                                        <Text style={styles.dashKpiLabel}>
                                            CURRENTLY ALIVE
                                        </Text>
                                        <View style={styles.dashKpiBadge}>
                                            <Text
                                                style={styles.dashKpiBadgeText}
                                            >
                                                {chickenDashboard.survivalRate}%
                                                Survival
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.dashKpiValue}>
                                        {chickenDashboard.currentlyAlive}
                                    </Text>
                                    <Text style={styles.dashKpiSub}>
                                        out of {chickenDashboard.totalBirds}{" "}
                                        total recorded
                                    </Text>
                                </View>

                                {/* 2. Batch Count */}
                                <View style={styles.dashKpiCard}>
                                    <View style={styles.dashKpiTopRow}>
                                        <Text style={styles.dashKpiLabel}>
                                            BATCH COUNT
                                        </Text>
                                        <View style={styles.dashKpiBadge}>
                                            <Text
                                                style={styles.dashKpiBadgeText}
                                            >
                                                Flock Groups
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.dashKpiValue}>
                                        {chickenDashboard.batchCount}
                                    </Text>
                                    <Text style={styles.dashKpiSub}>
                                        Active chicken batches
                                    </Text>
                                </View>

                                {/* 3. Total Male & Female */}
                                <View style={styles.dashKpiCard}>
                                    <View style={styles.dashKpiTopRow}>
                                        <Text style={styles.dashKpiLabel}>
                                            MALE & FEMALE
                                        </Text>
                                        <View style={styles.dashKpiBadge}>
                                            <Text
                                                style={styles.dashKpiBadgeText}
                                            >
                                                Composition
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.dashKpiValue}>
                                        {chickenDashboard.totalFemales}F ·{" "}
                                        {chickenDashboard.totalMales}M
                                    </Text>
                                    <Text style={styles.dashKpiSub}>
                                        {chickenDashboard.totalFemales} Females
                                        · {chickenDashboard.totalMales} Males
                                    </Text>
                                </View>

                                {/* 4. Active Breeds */}
                                <View style={styles.dashKpiCard}>
                                    <View style={styles.dashKpiTopRow}>
                                        <Text style={styles.dashKpiLabel}>
                                            ACTIVE BREED
                                        </Text>
                                        <View style={styles.dashKpiBadge}>
                                            <Text
                                                style={styles.dashKpiBadgeText}
                                            >
                                                {activeBreedData.names.length} active
                                            </Text>
                                        </View>
                                    </View>
                                    <View ref={breedSelectorRef} collapsable={false}>
                                        <Pressable
                                            style={styles.dashBreedSelector}
                                            onPress={handleToggleBreedMenu}
                                            accessibilityRole="button"
                                            accessibilityLabel="Choose active breed"
                                        >
                                            <Text
                                                style={styles.dashBreedSelectorText}
                                                numberOfLines={1}
                                            >
                                                {selectedBreed ??
                                                    "No active breeds"}
                                            </Text>
                                            {selectedBreed ? (
                                                <View style={styles.dashBreedCountBadge}>
                                                    <Text style={styles.dashBreedCountBadgeText}>
                                                        {selectedBreedCount}
                                                    </Text>
                                                </View>
                                            ) : null}
                                            <MaterialCommunityIcons
                                                name={
                                                    breedMenuVisible
                                                        ? "chevron-up"
                                                        : "chevron-down"
                                                }
                                                size={16}
                                                color={ChickIntelPalette.gray1}
                                            />
                                        </Pressable>
                                    </View>
                                    <Text style={styles.dashKpiValue}>
                                        {selectedBreedCount}
                                    </Text>
                                    <Text style={styles.dashKpiSub}>
                                        {selectedBreed
                                            ? `${selectedBreed} has ${selectedBreedCount} active chickens in the farm`
                                            : "No active chickens in the farm"}
                                    </Text>
                                </View>

                                {/* 5. Production Yield */}
                                <View style={styles.dashKpiCard}>
                                    <View style={styles.dashKpiTopRow}>
                                        <Text style={styles.dashKpiLabel}>
                                            EGG PRODUCTION
                                        </Text>
                                        <View style={styles.dashKpiBadge}>
                                            <Text
                                                style={styles.dashKpiBadgeText}
                                            >
                                                Yield
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.dashKpiValue}>
                                        {chickenDashboard.totalEggs}
                                    </Text>
                                    <Text style={styles.dashKpiSub}>
                                        eggs across{" "}
                                        {chickenDashboard.totalEggBatches}{" "}
                                        batches
                                    </Text>
                                </View>
                            </ScrollView>

                            {/* Pagination Dots Indicator */}
                            <View style={styles.dashPaginationDots}>
                                {[0, 1, 2, 3, 4].map((idx) => (
                                    <View
                                        key={`dash-dot-${idx}`}
                                        style={[
                                            styles.dashPaginationDot,
                                            dashCardIndex === idx &&
                                                styles.dashPaginationDotActive,
                                        ]}
                                    />
                                ))}
                            </View>

                            {/* Floating Breed Dropdown Modal - extends without resizing dashboard card */}
                            <Modal
                                visible={breedMenuVisible && activeBreedData.names.length > 0}
                                transparent
                                animationType="fade"
                                onRequestClose={() => setBreedMenuVisible(false)}
                            >
                                <Pressable
                                    style={styles.dashBreedModalOverlay}
                                    onPress={() => setBreedMenuVisible(false)}
                                >
                                    <View
                                        style={[
                                            styles.dashBreedMenuFloating,
                                            breedMenuCoords
                                                ? {
                                                      top: breedMenuCoords.y,
                                                      left: breedMenuCoords.x,
                                                      width: breedMenuCoords.width,
                                                  }
                                                : null,
                                        ]}
                                    >
                                        <ScrollView
                                            style={{ maxHeight: verticalScale(180) }}
                                            nestedScrollEnabled
                                            showsVerticalScrollIndicator
                                        >
                                            {activeBreedData.names.map((breed) => {
                                                const count = activeBreedData.getCount(breed);
                                                const isSelected =
                                                    selectedBreed?.toLowerCase() === breed.toLowerCase();
                                                return (
                                                    <Pressable
                                                        key={breed}
                                                        style={[
                                                            styles.dashBreedOption,
                                                            isSelected && styles.dashBreedOptionSelected,
                                                        ]}
                                                        onPress={() => {
                                                            setSelectedBreed(breed);
                                                            setBreedMenuVisible(false);
                                                        }}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.dashBreedOptionText,
                                                                isSelected && styles.dashBreedOptionTextSelected,
                                                            ]}
                                                            numberOfLines={1}
                                                        >
                                                            {breed}
                                                        </Text>
                                                        <View style={styles.dashBreedCountBadge}>
                                                            <Text style={styles.dashBreedCountBadgeText}>
                                                                {count}
                                                            </Text>
                                                        </View>
                                                    </Pressable>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                </Pressable>
                            </Modal>
                        </View>

                        {/* Search and Filter Row */}
                        <View style={styles.searchFilterContainer}>
                            <View style={styles.searchBar}>
                                <MaterialCommunityIcons
                                    name="magnify"
                                    size={20}
                                    color={ChickIntelPalette.gray1}
                                />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search batch #, breed, notes..."
                                    placeholderTextColor={
                                        ChickIntelPalette.gray2
                                    }
                                    value={chickenSearch}
                                    onChangeText={setChickenSearch}
                                />
                                {chickenSearch.length > 0 ? (
                                    <Pressable
                                        onPress={() => setChickenSearch("")}
                                        hitSlop={8}
                                        style={styles.searchClearBtn}
                                    >
                                        <MaterialCommunityIcons
                                            name="close-circle"
                                            size={18}
                                            color={ChickIntelPalette.gray2}
                                        />
                                    </Pressable>
                                ) : null}
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterPillsRow}
                            >
                                <Pressable
                                    style={[
                                        styles.filterChip,
                                        chickenFilter === "all" &&
                                            styles.filterChipActive,
                                    ]}
                                    onPress={() => setChickenFilter("all")}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            chickenFilter === "all" &&
                                                styles.filterChipTextActive,
                                        ]}
                                    >
                                        All ({parentChickenBatches.length})
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.filterChip,
                                        chickenFilter === "active" &&
                                            styles.filterChipActive,
                                    ]}
                                    onPress={() => setChickenFilter("active")}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            chickenFilter === "active" &&
                                                styles.filterChipTextActive,
                                        ]}
                                    >
                                        Active
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.filterChip,
                                        chickenFilter === "isolated" &&
                                            styles.filterChipActive,
                                    ]}
                                    onPress={() => setChickenFilter("isolated")}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            chickenFilter === "isolated" &&
                                                styles.filterChipTextActive,
                                        ]}
                                    >
                                        In Isolation
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.filterChip,
                                        chickenFilter === "eggs" &&
                                            styles.filterChipActive,
                                    ]}
                                    onPress={() => setChickenFilter("eggs")}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            chickenFilter === "eggs" &&
                                                styles.filterChipTextActive,
                                        ]}
                                    >
                                        Has Egg Batches
                                    </Text>
                                </Pressable>

                                {/* Sort Toggle */}
                                <Pressable
                                    style={[styles.filterChip, styles.sortChip]}
                                    onPress={() => {
                                        if (chickenSort === "asc")
                                            setChickenSort("desc");
                                        else if (chickenSort === "desc")
                                            setChickenSort("population");
                                        else if (chickenSort === "population")
                                            setChickenSort("newest");
                                        else setChickenSort("asc");
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={
                                            chickenSort === "asc"
                                                ? "sort-numeric-ascending"
                                                : chickenSort === "desc"
                                                  ? "sort-numeric-descending"
                                                  : chickenSort === "population"
                                                    ? "account-group"
                                                    : "clock-outline"
                                        }
                                        size={14}
                                        color={ChickIntelPalette.gray1}
                                    />
                                    <Text style={styles.filterChipText}>
                                        {chickenSort === "asc"
                                            ? "Batch (Asc)"
                                            : chickenSort === "desc"
                                              ? "Batch (Desc)"
                                              : chickenSort === "population"
                                                ? "Population"
                                                : "Newest"}
                                    </Text>
                                </Pressable>
                            </ScrollView>
                        </View>

                        {chickenLoading ? (
                            <Text style={styles.emptyStateText}>
                                Loading chicken batches...
                            </Text>
                        ) : null}
                        {!chickenLoading && chickenError ? (
                            <Text style={styles.emptyStateText}>
                                {chickenError}
                            </Text>
                        ) : null}
                        {!chickenLoading &&
                        !chickenError &&
                        filteredChickenBatches.length === 0 ? (
                            <Text style={styles.emptyStateText}>
                                {chickenSearch
                                    ? "No chicken batches match your search."
                                    : "No chicken batches found for this farm yet."}
                            </Text>
                        ) : null}
                        {paginatedChickenBatches.map((item) => {
                            const eggSummary = chickenEggSummaries[
                                item.id.trim().toLowerCase()
                            ] ?? {
                                batchCount: 0,
                                totalEggs: 0,
                                hatched: 0,
                                unhatched: 0,
                                damaged: 0,
                            };
                            const chickSummary = chickenSubBatchSummaries[
                                item.id.trim().toLowerCase()
                            ] ?? {
                                batchCount: 0,
                                chicks: 0,
                            };
                            const totalCount =
                                item.totalCount ??
                                item.femaleCount +
                                    item.maleCount +
                                    item.unknownCount;

                            return (
                                <BlurCard
                                    key={item.id}
                                    style={styles.card}
                                    borderRadius={16}
                                    intensity={20}
                                >
                                    <Pressable
                                        onPress={() => openEggBatches(item)}
                                        style={({ pressed }) => [
                                            styles.cardMainContainer,
                                            { opacity: pressed ? 0.94 : 1 },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open egg batches for chicken batch ${item.id}`}
                                    >
                                        {/* Card Header: Batch Pill + Date, Color Badge & Actions */}
                                        <View style={styles.cardHeaderRow}>
                                            <View
                                                style={styles.headerLeftStack}
                                            >
                                                <View
                                                    style={
                                                        styles.batchPillBadge
                                                    }
                                                >
                                                    <ChickenIcon
                                                        size={12}
                                                        color="#000000"
                                                    />
                                                    <Text
                                                        style={
                                                            styles.batchPillText
                                                        }
                                                    >
                                                        {formatProfileBatchId(
                                                            "C",
                                                            item.id,
                                                        )}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View
                                                style={
                                                    styles.headerRightActions
                                                }
                                            >
                                                <View
                                                    style={
                                                        styles.colorPillBadge
                                                    }
                                                >
                                                    <View
                                                        style={[
                                                            styles.colorDot,
                                                            {
                                                                backgroundColor:
                                                                    item.colorHex ||
                                                                    ChickIntelPalette.gray2,
                                                            },
                                                        ]}
                                                    />
                                                    <Text
                                                        style={
                                                            styles.colorPillText
                                                        }
                                                    >
                                                        {item.colorName ||
                                                            "Default"}
                                                    </Text>
                                                </View>

                                                <View
                                                    style={styles.iconCluster}
                                                >
                                                    <Pressable
                                                        onPress={() =>
                                                            openEdit(item)
                                                        }
                                                        hitSlop={8}
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.actionIconBtn,
                                                            {
                                                                opacity: pressed
                                                                    ? 0.72
                                                                    : 1,
                                                            },
                                                        ]}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Edit batch ${item.id}`}
                                                    >
                                                        <MaterialCommunityIcons
                                                            name="pencil-outline"
                                                            size={15}
                                                            color="#111111"
                                                        />
                                                    </Pressable>

                                                    <Pressable
                                                        onPress={() =>
                                                            confirmRemove(item)
                                                        }
                                                        hitSlop={8}
                                                        style={({
                                                            pressed,
                                                        }) => [
                                                            styles.actionIconBtn,
                                                            {
                                                                opacity: pressed
                                                                    ? 0.7
                                                                    : 1,
                                                            },
                                                        ]}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Delete batch ${item.id}`}
                                                    >
                                                        <MaterialCommunityIcons
                                                            name="trash-can-outline"
                                                            size={15}
                                                            color="#111111"
                                                        />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        </View>

                                        {item.breed ? (
                                            <Text style={styles.breedTitle}>
                                                {item.breed}
                                            </Text>
                                        ) : null}

                                        <Text style={styles.createdDateText}>
                                            {formatBatchDateStamp(
                                                item.createdAt,
                                                item.updatedAt,
                                            )}
                                        </Text>

                                        {/* Row 1: Flock Composition & Age */}
                                        <View style={styles.metricsRow}>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Total
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {totalCount}
                                                </Text>
                                            </View>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Females
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {item.femaleCount}
                                                </Text>
                                            </View>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Males
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {item.maleCount}
                                                </Text>
                                            </View>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Age
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {getCurrentBatchAgeLabel(
                                                        item,
                                                    )}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Row 2: Health & Production */}
                                        <View style={styles.metricsRow}>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Isolation
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {item.isolatedCount}
                                                </Text>
                                            </View>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Loss
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {item.killedCount}
                                                </Text>
                                            </View>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Egg batches
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {eggSummary.batchCount} (
                                                    {eggSummary.totalEggs})
                                                </Text>
                                            </View>
                                            <View style={styles.metricChip}>
                                                <Text
                                                    style={
                                                        styles.metricChipLabel
                                                    }
                                                >
                                                    Chicks
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.metricChipValue
                                                    }
                                                >
                                                    {chickSummary.chicks}
                                                </Text>
                                            </View>
                                        </View>

                                        {item.notes?.length ? (
                                            <View
                                                style={styles.noteSummaryList}
                                            >
                                                {item.notes.map((note) => (
                                                    <View
                                                        key={note.id}
                                                        style={
                                                            styles.noteSummaryCard
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.noteSummaryLabel
                                                            }
                                                        >
                                                            Note:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.noteSummaryText
                                                            }
                                                        >
                                                            {note.text}
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.noteSummaryMeta
                                                            }
                                                        >
                                                            {new Date(
                                                                note.createdAt,
                                                            ).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : null}
                                    </Pressable>
                                </BlurCard>
                            );
                        })}
                        {filteredChickenBatches.length >
                        CHICKEN_BATCH_PAGE_SIZE ? (
                            <View style={styles.batchPagination}>
                                <Pressable
                                    onPress={() =>
                                        setChickenPage((current) =>
                                            Math.max(0, current - 1),
                                        )
                                    }
                                    disabled={chickenPage === 0}
                                    style={styles.batchPaginationButton}
                                    accessibilityRole="button"
                                    accessibilityLabel="Previous chicken batch page"
                                >
                                    <MaterialCommunityIcons
                                        name="chevron-left"
                                        size={20}
                                        color={
                                            chickenPage === 0
                                                ? ChickIntelPalette.gray2
                                                : ChickIntelPalette.green1
                                        }
                                    />
                                </Pressable>
                                <Text style={styles.batchPaginationText}>
                                    Page {chickenPage + 1} of {chickenPageCount}
                                </Text>
                                <Pressable
                                    onPress={() =>
                                        setChickenPage((current) =>
                                            Math.min(
                                                chickenPageCount - 1,
                                                current + 1,
                                            ),
                                        )
                                    }
                                    disabled={
                                        chickenPage >= chickenPageCount - 1
                                    }
                                    style={styles.batchPaginationButton}
                                    accessibilityRole="button"
                                    accessibilityLabel="Next chicken batch page"
                                >
                                    <MaterialCommunityIcons
                                        name="chevron-right"
                                        size={20}
                                        color={
                                            chickenPage >= chickenPageCount - 1
                                                ? ChickIntelPalette.gray2
                                                : ChickIntelPalette.green1
                                        }
                                    />
                                </Pressable>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.list}>
                        {/* Egg Search and Sort Row */}
                        <View style={styles.searchFilterContainer}>
                            <View style={styles.searchBar}>
                                <MaterialCommunityIcons
                                    name="magnify"
                                    size={20}
                                    color={ChickIntelPalette.gray1}
                                />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search egg color, breed, batch #..."
                                    placeholderTextColor={
                                        ChickIntelPalette.gray2
                                    }
                                    value={eggSearch}
                                    onChangeText={setEggSearch}
                                />
                                {eggSearch.length > 0 ? (
                                    <Pressable
                                        onPress={() => setEggSearch("")}
                                        hitSlop={8}
                                        style={styles.searchClearBtn}
                                    >
                                        <MaterialCommunityIcons
                                            name="close-circle"
                                            size={18}
                                            color={ChickIntelPalette.gray2}
                                        />
                                    </Pressable>
                                ) : null}
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterPillsRow}
                            >
                                <Pressable
                                    style={[styles.filterChip, styles.sortChip]}
                                    onPress={() => {
                                        if (eggSort === "newest")
                                            setEggSort("oldest");
                                        else if (eggSort === "oldest")
                                            setEggSort("asc");
                                        else if (eggSort === "asc")
                                            setEggSort("desc");
                                        else setEggSort("newest");
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={
                                            eggSort === "asc"
                                                ? "sort-numeric-ascending"
                                                : eggSort === "desc"
                                                  ? "sort-numeric-descending"
                                                  : "clock-outline"
                                        }
                                        size={14}
                                        color={ChickIntelPalette.gray1}
                                    />
                                    <Text style={styles.filterChipText}>
                                        {eggSort === "asc"
                                            ? "Origin Batch (Asc)"
                                            : eggSort === "desc"
                                              ? "Origin Batch (Desc)"
                                              : eggSort === "newest"
                                                ? "Newest First"
                                                : "Oldest First"}
                                    </Text>
                                </Pressable>
                            </ScrollView>
                        </View>

                        {eggError ? (
                            <Text style={styles.emptyStateText}>
                                {eggError}
                            </Text>
                        ) : null}
                        {!eggError && filteredEggCards.length === 0 ? (
                            <Text style={styles.emptyStateText}>
                                {eggSearch
                                    ? "No egg batches match your search."
                                    : "No egg batches recorded yet."}
                            </Text>
                        ) : null}
                        {filteredEggCards.map((item) => (
                            <BlurCard
                                key={item.id}
                                style={styles.card}
                                borderRadius={16}
                                intensity={20}
                            >
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname:
                                                "/(tabs)/eggbatchitem/[color]" as any,
                                            params: {
                                                color: item.colorName,
                                                colorHex: item.colorHex,
                                                batchNo: item.rawBatchNo,
                                                originBatchNo:
                                                    item.originBatchNo,
                                                detailMode: "egg",
                                                breed: item.breed,
                                            },
                                        })
                                    }
                                    style={({ pressed }) => [
                                        styles.cardMainContainer,
                                        { opacity: pressed ? 0.92 : 1 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open ${item.colorName} egg batches`}
                                >
                                    <View style={styles.cardHeaderRow}>
                                        <View style={styles.headerLeftStack}>
                                            <View style={styles.batchPillBadge}>
                                                <ChickenIcon
                                                    size={12}
                                                    color="#111111"
                                                />
                                                <Text
                                                    style={styles.batchPillText}
                                                >
                                                    {formatProfileBatchId(
                                                        "C",
                                                        item.originBatchNo,
                                                    )}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.headerRightActions}>
                                            <View style={styles.colorPillBadge}>
                                                <View
                                                    style={[
                                                        styles.colorDot,
                                                        {
                                                            backgroundColor:
                                                                item.colorHex,
                                                        },
                                                    ]}
                                                />
                                                <Text
                                                    style={styles.colorPillText}
                                                >
                                                    {item.colorName}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <Text style={styles.breedTitle}>
                                        {item.breed ||
                                            `${item.colorName} Flock`}
                                    </Text>

                                    <Text style={styles.createdDateText}>
                                        {formatBatchDateStamp(
                                            item.createdAt,
                                            item.updatedAt,
                                        )}
                                    </Text>

                                    <View style={styles.metricsRow}>
                                        <View style={styles.metricChip}>
                                            <Text
                                                style={styles.metricChipLabel}
                                            >
                                                Total Batches
                                            </Text>
                                            <Text
                                                style={styles.metricChipValue}
                                            >
                                                {item.batches}
                                            </Text>
                                        </View>
                                        <View style={styles.metricChip}>
                                            <Text
                                                style={styles.metricChipLabel}
                                            >
                                                Fertility rate
                                            </Text>
                                            <Text
                                                style={styles.metricChipValue}
                                            >
                                                {item.fertilityRate}
                                            </Text>
                                        </View>
                                    </View>
                                </Pressable>
                            </BlurCard>
                        ))}
                    </View>
                )}
            </ScrollView>

            {mode === "chicken" || canCreateEggBatch ? (
                <PrimaryFab
                    iconName="plus"
                    variant="green"
                    onPress={() => {
                        if (mode === "egg") {
                            router.push({
                                pathname: "/(tabs)/eggbatchitem/ageunit",
                                params: { mode: "egg" },
                            });
                        } else {
                            router.push({
                                pathname: "/(tabs)/add-batch",
                                params: { mode },
                            });
                        }
                    }}
                    bottom={fabBottom}
                    accessibilityLabel="Create new batch"
                />
            ) : null}

            <Modal visible={editVisible} animationType="fade" transparent>
                <KeyboardAvoidingView
                    style={styles.modalKeyboardArea}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={insets.top}
                >
                    <View style={styles.modalOverlay}>
                        <ScrollView
                            contentContainerStyle={styles.modalScrollContent}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.modalCard}>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalHeaderTitleRow}>
                                        <View
                                            style={styles.modalHeaderIconBadge}
                                        >
                                            <MaterialCommunityIcons
                                                name="pencil-outline"
                                                size={20}
                                                color="#FFFFFF"
                                            />
                                        </View>
                                        <Text style={styles.modalTitle}>
                                            Edit Chicken Batch
                                        </Text>
                                    </View>
                                    <Text
                                        style={styles.modalSubtitle}
                                        numberOfLines={1}
                                    >
                                        {selectedBatch
                                            ? `${formatProfileBatchId("C", selectedBatch.id)} | `
                                            : ""}
                                        {selectedBatch?.breed || "General"}
                                    </Text>
                                </View>

                                <View style={styles.modalBody}>
                                    <Text style={styles.modalLabel}>Breed</Text>
                                    <TextInput
                                        value={formState.breed}
                                        onChangeText={(t) =>
                                            setFormState((s) => ({
                                                ...s,
                                                breed: t,
                                            }))
                                        }
                                        editable={!sexingEligible}
                                        style={[
                                            styles.modalInput,
                                            sexingEligible &&
                                                styles.modalInputDisabled,
                                        ]}
                                        placeholder="Breed name"
                                        placeholderTextColor={
                                            ChickIntelPalette.gray2
                                        }
                                    />

                                    <View style={styles.readonlyMetricRow}>
                                        <Text style={styles.modalLabel}>
                                            Total
                                        </Text>
                                        <Text
                                            style={styles.readonlyMetricValue}
                                        >
                                            {formState.totalCount || "0"}
                                        </Text>
                                        <Text style={styles.readonlyMetricHint}>
                                            Total count cannot be changed when
                                            editing a batch.
                                        </Text>
                                    </View>

                                    <View style={styles.rowInputs}>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.modalLabel}>
                                                Female
                                            </Text>
                                            <TextInput
                                                value={formState.femaleCount}
                                                onChangeText={
                                                    onEditFemaleCountChange
                                                }
                                                keyboardType="number-pad"
                                                editable={sexingEligible}
                                                style={[
                                                    styles.modalInput,
                                                    !sexingEligible &&
                                                        styles.modalInputDisabled,
                                                ]}
                                            />
                                        </View>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.modalLabel}>
                                                Male
                                            </Text>
                                            <TextInput
                                                value={formState.maleCount}
                                                onChangeText={
                                                    onEditMaleCountChange
                                                }
                                                keyboardType="number-pad"
                                                editable={sexingEligible}
                                                style={[
                                                    styles.modalInput,
                                                    !sexingEligible &&
                                                        styles.modalInputDisabled,
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.rowInputs}>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.modalLabel}>
                                                Isolation
                                            </Text>
                                            <TextInput
                                                value={formState.isolatedCount}
                                                onChangeText={(t) =>
                                                    setFormState((s) => ({
                                                        ...s,
                                                        isolatedCount:
                                                            t.replace(
                                                                /[^0-9]/g,
                                                                "",
                                                            ),
                                                    }))
                                                }
                                                keyboardType="number-pad"
                                                editable={!sexingEligible}
                                                style={[
                                                    styles.modalInput,
                                                    sexingEligible &&
                                                        styles.modalInputDisabled,
                                                ]}
                                            />
                                        </View>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.modalLabel}>
                                                Loss
                                            </Text>
                                            <TextInput
                                                value={formState.killedCount}
                                                onChangeText={(t) =>
                                                    setFormState((s) => ({
                                                        ...s,
                                                        killedCount: t.replace(
                                                            /[^0-9]/g,
                                                            "",
                                                        ),
                                                    }))
                                                }
                                                keyboardType="number-pad"
                                                editable={!sexingEligible}
                                                style={[
                                                    styles.modalInput,
                                                    sexingEligible &&
                                                        styles.modalInputDisabled,
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    <Text style={styles.modalLabel}>Age</Text>
                                    <View style={styles.ageEditRow}>
                                        <TextInput
                                            value={formState.ageCount}
                                            onChangeText={(value) =>
                                                setFormState((state) => ({
                                                    ...state,
                                                    ageCount: value.replace(
                                                        /[^0-9]/g,
                                                        "",
                                                    ),
                                                }))
                                            }
                                            keyboardType="number-pad"
                                            style={[
                                                styles.modalInput,
                                                styles.ageCountInput,
                                            ]}
                                            placeholder={"2"}
                                            placeholderTextColor={
                                                ChickIntelPalette.gray2
                                            }
                                        />
                                        <Pressable
                                            onPress={() =>
                                                !sexingEligible &&
                                                setAgeUnitMenuVisible(true)
                                            }
                                            disabled={sexingEligible}
                                            style={[
                                                styles.modalSelect,
                                                styles.ageUnitSelect,
                                                sexingEligible &&
                                                    styles.modalInputDisabled,
                                            ]}
                                            accessibilityRole="button"
                                        >
                                            <Text
                                                style={[
                                                    styles.modalSelectText,
                                                    sexingEligible && {
                                                        color: "#9CA3AF",
                                                    },
                                                ]}
                                            >
                                                {formState.ageLabel}
                                            </Text>
                                            <MaterialCommunityIcons
                                                name="chevron-down"
                                                size={18}
                                                color={
                                                    sexingEligible
                                                        ? "#9CA3AF"
                                                        : ChickIntelPalette.gray2
                                                }
                                            />
                                        </Pressable>
                                    </View>
                                    <Text style={styles.ageLimitHint}>
                                        Minimum: 2 weeks
                                    </Text>

                                    {sexingEligible ? (
                                        <Pressable
                                            onPress={() =>
                                                setSexScannerOpen(true)
                                            }
                                            style={styles.sexCameraButton}
                                            accessibilityRole="button"
                                            accessibilityLabel="Open camera sexing"
                                        >
                                            <MaterialCommunityIcons
                                                name="gender-male-female"
                                                size={20}
                                                color="#FFFFFF"
                                            />
                                            <Text
                                                style={
                                                    styles.sexCameraButtonText
                                                }
                                            >
                                                Camera Sexing
                                            </Text>
                                        </Pressable>
                                    ) : (
                                        <Text style={styles.sexingAgeHint}>
                                            Male, female, and camera sexing are
                                            available at 9 weeks.
                                        </Text>
                                    )}

                                    <View style={styles.modalActions}>
                                        <Pressable
                                            onPress={closeEdit}
                                            style={styles.modalCancel}
                                            accessibilityRole="button"
                                        >
                                            <Text
                                                style={styles.modalCancelText}
                                            >
                                                Cancel
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={saveEdit}
                                            style={styles.modalSave}
                                            accessibilityRole="button"
                                        >
                                            <Text style={styles.modalSaveText}>
                                                Save Changes
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                visible={sexScannerOpen}
                animationType="slide"
                presentationStyle="fullScreen"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={closeSexScanner}
            >
                <View style={styles.sexCameraScreen}>
                    <StatusBar style="light" />
                    {isScanningSex && capturedSexPhotoUri ? (
                        <View style={styles.sexScanLoadingOverlay}>
                            <Text style={styles.sexScanLoadingText}>
                                Scanning sex...
                            </Text>
                            <Text style={styles.sexScanLoadingSubtitle}>
                                Comparing cock and hen confidence
                            </Text>
                        </View>
                    ) : (
                        <>
                            <CameraViewport
                                ref={sexCameraRef}
                                active={sexScannerOpen && !isScanningSex}
                                enableTorch={sexTorchEnabled}
                                zoom={sexZoomLevel}
                                onReadyChange={setSexCameraReady}
                            />
                            <View
                                style={styles.sexCameraOverlay}
                                pointerEvents="box-none"
                            >
                                <View
                                    style={[
                                        styles.sexCameraHeader,
                                        { paddingTop: insets.top + 12 },
                                    ]}
                                >
                                    <View style={styles.sexCameraTitleWrap}>
                                        <Text style={styles.sexCameraTitle}>
                                            Camera Sexing
                                        </Text>
                                        <Text style={styles.sexCameraSubtitle}>
                                            Frame the chicken clearly, then
                                            capture to classify sex.
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() =>
                                            setSexTorchEnabled(
                                                (value) => !value,
                                            )
                                        }
                                        style={styles.sexCameraIconButton}
                                        accessibilityRole="button"
                                        accessibilityLabel="Toggle camera flash"
                                    >
                                        <MaterialCommunityIcons
                                            name={
                                                sexTorchEnabled
                                                    ? "flash"
                                                    : "flash-off"
                                            }
                                            size={20}
                                            color={
                                                sexTorchEnabled
                                                    ? ChickIntelPalette.green1
                                                    : ChickIntelPalette.gray1
                                            }
                                        />
                                    </Pressable>
                                    <Pressable
                                        onPress={closeSexScanner}
                                        style={styles.sexCameraIconButton}
                                        accessibilityRole="button"
                                        accessibilityLabel="Close camera sexing"
                                    >
                                        <MaterialCommunityIcons
                                            name="close"
                                            size={20}
                                            color={ChickIntelPalette.gray1}
                                        />
                                    </Pressable>
                                </View>
                                <View style={styles.sexViewfinderArea}>
                                    <ViewfinderOverlay
                                        size={Math.min(width - 64, 300)}
                                    />
                                </View>
                                <View style={styles.sexCameraBottom}>
                                    <View style={styles.sexZoomRow}>
                                        <MaterialCommunityIcons
                                            name="magnify-minus-outline"
                                            size={16}
                                            color="#FFF"
                                        />
                                        <Slider
                                            style={styles.sexZoomSlider}
                                            minimumValue={0}
                                            maximumValue={0.7}
                                            value={sexZoomLevel}
                                            step={0.01}
                                            onValueChange={setSexZoomLevel}
                                            minimumTrackTintColor={
                                                ChickIntelPalette.green1
                                            }
                                            maximumTrackTintColor="rgba(255,255,255,0.35)"
                                            thumbTintColor={
                                                ChickIntelPalette.green2
                                            }
                                        />
                                        <MaterialCommunityIcons
                                            name="magnify-plus-outline"
                                            size={16}
                                            color="#FFF"
                                        />
                                    </View>
                                    <ScannerShutter
                                        onPress={handleEditSexCapture}
                                        disabled={!sexCameraReady}
                                    />
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            <Modal visible={eggEditVisible} animationType="fade" transparent>
                <KeyboardAvoidingView
                    style={styles.modalKeyboardArea}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={insets.top}
                >
                    <View style={styles.modalOverlay}>
                        <ScrollView
                            contentContainerStyle={styles.modalScrollContent}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.eggModalCard}>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalHeaderTitleRow}>
                                        <View
                                            style={styles.modalHeaderIconBadge}
                                        >
                                            <MaterialCommunityIcons
                                                name="egg-outline"
                                                size={20}
                                                color="#FFFFFF"
                                            />
                                        </View>
                                        <Text style={styles.modalTitle}>
                                            Edit Egg Batch
                                        </Text>
                                    </View>
                                    <Text
                                        style={styles.modalSubtitle}
                                        numberOfLines={1}
                                    >
                                        {formatProfileBatchId(
                                            "E",
                                            eggForm.batchNo,
                                        )}{" "}
                                        | {eggForm.origin || "Egg Batch"}
                                    </Text>
                                </View>

                                <View style={styles.eggModalBody}>
                                    <Text style={styles.modalLabel}>
                                        Batch number
                                    </Text>
                                    <TextInput
                                        value={eggForm.batchNo}
                                        onChangeText={(t) =>
                                            setEggForm((s) => ({
                                                ...s,
                                                batchNo: t,
                                            }))
                                        }
                                        style={styles.modalInput}
                                        placeholder="Batch number"
                                        placeholderTextColor={
                                            ChickIntelPalette.gray2
                                        }
                                    />

                                    <View style={styles.rowInputs}>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.modalLabel}>
                                                Egg quantity
                                            </Text>
                                            <TextInput
                                                value={eggForm.eggQty}
                                                onChangeText={(t) =>
                                                    setEggForm((s) => ({
                                                        ...s,
                                                        eggQty: t.replace(
                                                            /[^0-9]/g,
                                                            "",
                                                        ),
                                                    }))
                                                }
                                                keyboardType="number-pad"
                                                style={styles.modalInput}
                                            />
                                        </View>
                                        <View style={styles.halfInput}>
                                            <Text style={styles.modalLabel}>
                                                Line number
                                            </Text>
                                            <TextInput
                                                value={eggForm.lineNo}
                                                onChangeText={(t) =>
                                                    setEggForm((s) => ({
                                                        ...s,
                                                        lineNo: t.replace(
                                                            /[^0-9]/g,
                                                            "",
                                                        ),
                                                    }))
                                                }
                                                keyboardType="number-pad"
                                                style={styles.modalInput}
                                            />
                                        </View>
                                    </View>

                                    <Text style={styles.modalLabel}>
                                        Origin
                                    </Text>
                                    <TextInput
                                        value={eggForm.origin}
                                        onChangeText={(t) =>
                                            setEggForm((s) => ({
                                                ...s,
                                                origin: t,
                                            }))
                                        }
                                        style={styles.modalInput}
                                        placeholder="e.g. Farm A"
                                        placeholderTextColor={
                                            ChickIntelPalette.gray2
                                        }
                                    />

                                    <Text style={styles.modalLabel}>
                                        Age unit
                                    </Text>
                                    <TextInput
                                        value={eggForm.ageUnit}
                                        onChangeText={(t) =>
                                            setEggForm((s) => ({
                                                ...s,
                                                ageUnit: t,
                                            }))
                                        }
                                        style={styles.modalInput}
                                        placeholder="Weeks old"
                                        placeholderTextColor={
                                            ChickIntelPalette.gray2
                                        }
                                    />

                                    <Text style={styles.modalLabel}>
                                        Unhatched quantity
                                    </Text>
                                    <View style={styles.readonlyMetricRow}>
                                        <Text
                                            style={styles.readonlyMetricValue}
                                        >
                                            {getDerivedUnhatchedQty(
                                                parseCount(eggForm.eggQty),
                                                selectedEgg?.hatchedQty ?? 0,
                                                selectedEgg?.damagedQty ?? 0,
                                            )}
                                        </Text>
                                        <Text style={styles.readonlyMetricHint}>
                                            Auto-calculated from total eggs
                                            minus hatched and damaged.
                                        </Text>
                                    </View>

                                    <View style={styles.modalActions}>
                                        <Pressable
                                            onPress={closeEggEdit}
                                            style={styles.modalCancel}
                                            accessibilityRole="button"
                                        >
                                            <Text
                                                style={styles.modalCancelText}
                                            >
                                                Cancel
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={saveEggEdit}
                                            style={styles.modalSave}
                                            accessibilityRole="button"
                                        >
                                            <Text style={styles.modalSaveText}>
                                                Save Changes
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            <Modal
                visible={ageUnitMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAgeUnitMenuVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setAgeUnitMenuVisible(false)}
                >
                    <View style={styles.ageMenuCard}>
                        <Text style={styles.modalLabel}>Age unit</Text>
                        {AGE_UNIT_OPTIONS.map((option) => (
                            <Pressable
                                key={option}
                                onPress={() => {
                                    setFormState((state) => ({
                                        ...state,
                                        ageLabel: option,
                                    }));
                                    setAgeUnitMenuVisible(false);
                                }}
                                style={({ pressed }) => [
                                    styles.ageMenuOption,
                                    { opacity: pressed ? 0.82 : 1 },
                                ]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.ageMenuText}>{option}</Text>
                                {formState.ageLabel === option ? (
                                    <MaterialCommunityIcons
                                        name="check"
                                        size={18}
                                        color={ChickIntelPalette.gray1}
                                    />
                                ) : null}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            <DeleteConfirmationModal
                visible={Boolean(batchToDelete)}
                title="Delete Chicken Batch?"
                subtitle="This action cannot be undone."
                itemBadge="CHICKEN BATCH"
                itemTitle={
                    batchToDelete?.breed
                        ? batchToDelete.breed
                        : batchToDelete?.id
                          ? `Batch #${batchToDelete.id}`
                          : undefined
                }
                itemSubtitle={
                    batchToDelete
                        ? `${batchToDelete.totalCount} ${batchToDelete.totalCount === 1 ? "chicken" : "chickens"} • ${formatBatchDateStamp(batchToDelete.createdAt, batchToDelete.updatedAt)}`
                        : undefined
                }
                message="Are you sure you want to delete this chicken batch? This batch will be moved to deleted history."
                confirmLabel="Delete"
                isDeleting={isDeletingBatch}
                onConfirm={handleDeleteBatchConfirm}
                onCancel={() => {
                    if (!isDeletingBatch) setBatchToDelete(null);
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: ChickIntelPalette.canvas,
    },
    fixedHeader: {
        paddingHorizontal: moderateScale(20),
        backgroundColor: "transparent",
    },
    content: {
        paddingHorizontal: moderateScale(20),
        gap: 12,
    },
    pageTitle: {
        flex: 1,
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(18),
        lineHeight: 28,
        fontWeight: "800",
        letterSpacing: -0.4,
        color: ChickIntelPalette.gray1,
        textAlign: "center",
    },
    pageHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginTop: 10,
        marginBottom: 8,
        minHeight: verticalScale(42),
    },
    headerRightPlaceholder: {
        width: scale(42),
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    segmentStickyHeader: {
        backgroundColor: "transparent",
        paddingVertical: 6,
    },
    backButton: {
        width: scale(38),
        height: verticalScale(38),
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
    },
    eggAnalyticsIconButton: {
        width: scale(38),
        height: verticalScale(38),
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
        flexShrink: 0,
    },
    segmentWrap: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 4,
        gap: 4,
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
    },
    segment: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: verticalScale(38),
        borderRadius: 8,
        paddingHorizontal: moderateScale(10),
    },
    segmentActive: {
        backgroundColor: ChickIntelPalette.green1,
    },
    segmentInactive: {
        backgroundColor: "transparent",
    },
    segmentText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        fontWeight: "700",
        lineHeight: 18,
        color: ChickIntelPalette.textMuted,
    },
    segmentTextActive: {
        color: "#FFFFFF",
    },
    segmentTextInactive: {
        color: ChickIntelPalette.textMuted,
    },
    list: {
        gap: 10,
    },
    emptyStateText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        lineHeight: 20,
        color: ChickIntelPalette.textMuted,
        textAlign: "center",
        paddingVertical: verticalScale(12),
    },
    card: {
        position: "relative",
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
        shadowColor: "#161E1A",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: verticalScale(2) },
        elevation: 2,
        overflow: "hidden",
    },
    statusAccentBar: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: scale(4),
    },
    cardMainContainer: {
        paddingLeft: 2,
        gap: 8,
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
    },
    headerLeftStack: {
        flex: 1,
        gap: 2,
    },
    batchPillBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: ChickIntelPalette.lightGreen,
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        minHeight: verticalScale(28),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
        alignSelf: "flex-start",
    },
    batchPillText: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(12),
        fontWeight: "800",
        color: ChickIntelPalette.green1,
        letterSpacing: -0.2,
    },
    breedTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(16),
        lineHeight: 22,
        fontWeight: "800",
        letterSpacing: -0.3,
        color: ChickIntelPalette.gray1,
    },
    createdDateText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        lineHeight: 16,
        color: ChickIntelPalette.textMuted,
        paddingBottom: 10,
        marginTop: verticalScale(-5),
    },
    headerRightActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    colorPillBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        minHeight: verticalScale(28),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
    },
    colorDot: {
        width: scale(8),
        height: verticalScale(8),
        borderRadius: 4,
    },
    colorPillText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
    },
    actionIconBtn: {
        width: scale(28),
        height: verticalScale(28),
        borderRadius: 8,
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
        alignItems: "center",
        justifyContent: "center",
    },
    iconCluster: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metricsRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 2,
    },
    metricChip: {
        flex: 1,
        backgroundColor: ChickIntelPalette.lightGreen,
        borderRadius: 8,
        paddingVertical: verticalScale(6),
        paddingHorizontal: moderateScale(4),
        alignItems: "center",
        justifyContent: "center",
    },
    metricChipLabel: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(9.5),
        fontWeight: "600",
        color: ChickIntelPalette.textMuted,
        textAlign: "center",
    },
    metricChipValue: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(12.5),
        fontWeight: "800",
        color: ChickIntelPalette.gray1,
        marginTop: 2,
        textAlign: "center",
    },
    noteSummaryList: {
        marginTop: 6,
        gap: 6,
    },
    noteSummaryCard: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
        backgroundColor: ChickIntelPalette.lightGreen,
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(8),
        gap: 2,
    },
    noteSummaryLabel: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    noteSummaryText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 16,
        color: ChickIntelPalette.gray1,
    },
    noteSummaryMeta: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        color: ChickIntelPalette.textMuted,
    },
    editActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(5),
        borderRadius: 999,
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    editActionText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        alignItems: "center",
        padding: moderateScale(20),
    },
    modalKeyboardArea: {
        flex: 1,
    },
    sexCameraScreen: {
        flex: 1,
        backgroundColor: "#000000",
    },
    sexCameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: "space-between",
    },
    sexCameraHeader: {
        paddingHorizontal: moderateScale(16),
        paddingBottom: verticalScale(12),
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    sexCameraTitleWrap: {
        flex: 1,
        gap: 3,
    },
    sexCameraTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(20),
        fontWeight: "800",
        color: "#FFFFFF",
    },
    sexCameraSubtitle: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 16,
        color: "rgba(255,255,255,0.86)",
    },
    sexCameraIconButton: {
        width: scale(40),
        height: verticalScale(40),
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.92)",
    },
    sexViewfinderArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    sexCameraBottom: {
        alignItems: "center",
        paddingHorizontal: moderateScale(18),
        paddingBottom: verticalScale(24),
        gap: 12,
    },
    sexZoomRow: {
        width: "100%",
        maxWidth: scale(360),
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    sexZoomSlider: {
        flex: 1,
        height: verticalScale(32),
    },
    sexScanLoadingOverlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.86)",
        padding: moderateScale(24),
    },
    sexScanLoadingText: {
        marginTop: verticalScale(14),
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(20),
        fontWeight: "800",
        color: "#FFFFFF",
    },
    sexScanLoadingSubtitle: {
        marginTop: verticalScale(6),
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        color: "rgba(255,255,255,0.78)",
        textAlign: "center",
    },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: "center",
    },
    modalCard: {
        width: "100%",
        maxWidth: scale(500),
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: scale(0), height: verticalScale(6) },
        elevation: 8,
    },
    eggModalCard: {
        width: "100%",
        maxWidth: scale(440),
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
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
    modalTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(17),
        fontWeight: "800",
        color: "#FFFFFF",
    },
    modalSubtitle: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        color: "rgba(255, 255, 255, 0.85)",
        marginTop: 4,
    },
    modalBody: {
        padding: moderateScale(18),
        gap: 12,
    },
    eggModalBody: {
        paddingHorizontal: moderateScale(16),
        paddingTop: verticalScale(14),
        paddingBottom: verticalScale(16),
        gap: 9,
    },
    modalLabel: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        color: ChickIntelPalette.gray1,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.2,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: "rgba(49, 118, 103, 0.22)",
        borderRadius: 10,
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        color: ChickIntelPalette.gray1,
        backgroundColor: "#F9FAFA",
    },
    modalInputDisabled: {
        color: "#9CA3AF",
        backgroundColor: "#EEF1F0",
    },
    modalSelect: {
        minHeight: verticalScale(44),
        borderWidth: 1,
        borderColor: "rgba(49, 118, 103, 0.22)",
        borderRadius: 10,
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        backgroundColor: "#F9FAFA",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    ageEditRow: {
        flexDirection: "row",
        gap: 8,
    },
    ageCountInput: {
        flex: 1,
    },
    ageUnitSelect: {
        flex: 1.5,
    },
    ageLimitHint: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        lineHeight: 14,
        fontWeight: "600",
        color: ChickIntelPalette.green1,
    },
    sexingAgeHint: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        lineHeight: 15,
        fontWeight: "600",
        color: ChickIntelPalette.textMuted,
    },
    sexCameraButton: {
        minHeight: verticalScale(44),
        borderRadius: 12,
        backgroundColor: ChickIntelPalette.green1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    sexCameraButtonText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "800",
        color: "#FFFFFF",
    },
    modalSelectText: {
        fontFamily: ChickFont.sans,
        color: ChickIntelPalette.gray1,
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
    },
    ageMenuCard: {
        width: "100%",
        maxWidth: scale(400),
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: moderateScale(16),
        gap: 10,
    },
    ageMenuOption: {
        minHeight: verticalScale(42),
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(49, 118, 103, 0.16)",
        backgroundColor: "rgba(244, 248, 247, 0.9)",
        paddingHorizontal: moderateScale(12),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    ageMenuText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        color: ChickIntelPalette.gray1,
        fontWeight: "600",
    },
    rowInputs: {
        flexDirection: "row",
        gap: 10,
    },
    halfInput: {
        flex: 1,
        gap: 6,
    },
    readonlyMetricRow: {
        borderWidth: 1,
        borderColor: "rgba(49, 118, 103, 0.18)",
        borderRadius: 10,
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        backgroundColor: "rgba(202, 227, 221, 0.25)",
        gap: 2,
    },
    readonlyMetricValue: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(16),
        fontWeight: "800",
        color: ChickIntelPalette.green1,
    },
    readonlyMetricHint: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        lineHeight: 15,
        color: "#52615D",
    },
    modalActions: {
        flexDirection: "row",
        gap: moderateScale(12),
        justifyContent: "center",
        marginTop: verticalScale(12),
    },
    modalCancel: {
        flex: 1,
        minHeight: verticalScale(42),
        borderRadius: scale(10),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: moderateScale(16),
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    modalCancelText: {
        fontFamily: ChickFont.sans,
        color: ChickIntelPalette.gray1,
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
    },
    modalSave: {
        flex: 1,
        minHeight: verticalScale(42),
        borderRadius: scale(10),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: moderateScale(16),
        backgroundColor: ChickIntelPalette.green1,
    },
    modalSaveText: {
        fontFamily: ChickFont.sans,
        color: "#FFFFFF",
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
    },
    // Chicken Dashboard KPI Carousel Styles
    dashboardContainer: {
        marginBottom: verticalScale(12),
    },
    dashPaginationDots: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginTop: verticalScale(8),
    },
    dashPaginationDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(64, 83, 77, 0.25)",
    },
    dashPaginationDotActive: {
        width: 18,
        backgroundColor: ChickIntelPalette.green1,
    },
    batchPagination: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: moderateScale(14),
        marginTop: verticalScale(2),
        marginBottom: verticalScale(4),
    },
    batchPaginationButton: {
        width: scale(34),
        height: verticalScale(34),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: scale(10),
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    batchPaginationText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
    },
    dashboardCarousel: {
        paddingHorizontal: moderateScale(4),
        gap: moderateScale(10),
    },
    dashKpiCard: {
        width: scale(165),
        backgroundColor: ChickIntelPalette.green1,
        borderRadius: 14,
        paddingHorizontal: moderateScale(12),
        paddingTop: verticalScale(10),
        paddingBottom: verticalScale(10),
        borderWidth: 1,
        borderColor: "rgba(64, 83, 77, 0.4)",
        shadowColor: "#161E1A",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: verticalScale(2) },
        elevation: 3,
        justifyContent: "space-between",
        minHeight: verticalScale(95),
    },
    dashKpiTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 4,
    },
    dashKpiLabel: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(9.5),
        fontWeight: "700",
        color: "rgba(255, 255, 255, 0.85)",
        letterSpacing: 0.5,
    },
    dashKpiBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.18)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.35)",
        borderRadius: 6,
        paddingHorizontal: moderateScale(5),
        paddingVertical: verticalScale(2),
    },
    dashKpiBadgeAlert: {
        backgroundColor: "rgba(247, 192, 144, 0.25)",
        borderColor: "rgba(247, 192, 144, 0.5)",
    },
    dashKpiBadgeText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(9),
        fontWeight: "700",
        color: "#FFFFFF",
    },
    dashBreedSelector: {
        minHeight: verticalScale(32),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        marginTop: verticalScale(6),
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(4),
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.12)",
    },
    dashBreedSelectorText: {
        flex: 1,
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
    },
    dashBreedModalOverlay: {
        flex: 1,
        backgroundColor: "transparent",
    },
    dashBreedMenuFloating: {
        position: "absolute",
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.12)",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        paddingVertical: verticalScale(4),
        overflow: "hidden",
    },
    dashBreedOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(6),
    },
    dashBreedOptionSelected: {
        backgroundColor: "rgba(64, 83, 77, 0.08)",
    },
    dashBreedOptionText: {
        flex: 1,
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10.5),
        fontWeight: "600",
        color: ChickIntelPalette.gray1,
    },
    dashBreedOptionTextSelected: {
        fontWeight: "800",
        color: ChickIntelPalette.green1,
    },
    dashBreedCountBadge: {
        backgroundColor: "rgba(64, 83, 77, 0.12)",
        paddingHorizontal: moderateScale(6),
        paddingVertical: verticalScale(2),
        borderRadius: 6,
        marginLeft: 4,
    },
    dashBreedCountBadgeText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(9.5),
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    dashKpiValue: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(22),
        lineHeight: 26,
        fontWeight: "900",
        color: "#FFFFFF",
        marginTop: verticalScale(3),
    },
    dashKpiSub: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        fontWeight: "600",
        color: ChickIntelPalette.accent,
        marginTop: verticalScale(2),
    },
    // Search & Filter Styles
    searchFilterContainer: {
        gap: verticalScale(8),
        marginBottom: verticalScale(8),
        paddingHorizontal: moderateScale(2),
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: scale(10),
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
        paddingHorizontal: moderateScale(10),
        minHeight: verticalScale(40),
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        color: ChickIntelPalette.gray1,
        paddingVertical: verticalScale(6),
    },
    searchClearBtn: {
        padding: 4,
    },
    filterPillsRow: {
        flexDirection: "row",
        gap: moderateScale(6),
        alignItems: "center",
        paddingVertical: verticalScale(2),
    },
    filterChip: {
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(5),
        borderRadius: scale(20),
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    filterChipActive: {
        backgroundColor: ChickIntelPalette.green1,
        borderColor: ChickIntelPalette.green1,
    },
    sortChip: {
        backgroundColor: "rgba(64, 83, 77, 0.08)",
        borderColor: "rgba(64, 83, 77, 0.2)",
    },
    filterChipText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11.5),
        fontWeight: "600",
        color: ChickIntelPalette.gray1,
    },
    filterChipTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
});
