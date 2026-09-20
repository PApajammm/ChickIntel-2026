import {
    ChickDatePickerModal,
    ChickTimePickerModal,
} from "@/components/ui/chick-date-picker-modal";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import {
    excludeScheduleTaskOccurrence,
    fetchScheduleOccurrenceExclusions,
    type ScheduleOccurrenceExclusion,
} from "@/utils/supabase-schedule-occurrences";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import {
    ChickSelectionModal,
    ChickSelectRow,
    ChickTextInput,
} from "@/components/ui/chick-form";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { useFarmData } from "@/providers/farm-data-provider";
import { optimizePhotoForInference } from "@/utils/image-crop-helper";
import { logError } from "@/utils/logger";
import {
    cancelTaskNotifications,
    scheduleTasksNotifications,
} from "@/utils/schedule-notifications";
import { computeEffectiveInventoryItems } from "@/utils/stock-alerts";
import { fetchFarmBatches } from "@/utils/supabase-batches";
import {
    fetchInventoryItems,
    type SupabaseInventoryItem,
} from "@/utils/supabase-inventory";
import {
    fetchMedicationOptions,
    fetchVitaminOptions,
} from "@/utils/supabase-lookups";
import {
    computeTaskStatus,
    createScheduleTask,
    fetchScheduleTaskCompletions,
    fetchScheduleTasks,
    formatScheduleDateKey,
    SCHEDULE_DAYS_OF_WEEK,
    scheduleTaskMatchesDate,
    type SupabaseScheduleTask,
    type SupabaseScheduleTaskCompletion,
} from "@/utils/supabase-schedule";
import { recordDeletedScheduleTask } from "@/utils/supabase-schedule-history";

const DAYS_OF_WEEK = [...SCHEDULE_DAYS_OF_WEEK];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const PREVIEW_TIMEFRAME_OPTIONS = ["Weekly", "Monthly"] as const;
type PreviewTimeframeOption = (typeof PREVIEW_TIMEFRAME_OPTIONS)[number];

type ScheduleTask = SupabaseScheduleTask;
type FeedInventoryOption = Pick<
  SupabaseInventoryItem,
  "id" | "name" | "unit" | "type" | "qty" | "expirationDate"
>;
type BatchOption = {
  batchNo: string;
  label: string;
};

const formatAppDate = (dateOrKey?: Date | string | null) => {
  if (!dateOrKey) return "";
  if (typeof dateOrKey === "string") {
    const [year, month, day] = dateOrKey.split("-").map(Number);
    if (year && month && day) {
      const m = String(month).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      return `${m}/${d}/${year}`;
    }
  }
  const date = typeof dateOrKey === "string" ? new Date(dateOrKey) : dateOrKey;
  if (!date || Number.isNaN(date.getTime())) return String(dateOrKey);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
};

const formatInventoryOptionLabel = (item: FeedInventoryOption) => {
  const type = item.type.trim().toLowerCase();
  if (type !== "medicine" && type !== "vitamins") return item.name;
  return `${item.name} | Exp: ${item.expirationDate ? formatAppDate(item.expirationDate) : "No date"}`;
};

const initialTasksByDate: Record<string, ScheduleTask[]> = {};
const FEEDING_TASK_LABEL = "Feeding";
const ALL_BATCHES_VALUE = "__all_batches__";

const isConsumableInventoryType = (type: string) =>
  type.trim().toLowerCase() !== "equipment";

const TASK_COLOR_MAP = {
  feeding: "#C17B31",
  vitamin: "#2D8C74",
  medication: "#C34F5F",
  egg: "#D9A441",
  default: ChickIntelPalette.green1,
};

const TASK_TITLE_COLOR_MAP: Record<string, string> = {
  feeding: "#C17B31",
  vitamins: "#2D8C74",
  "vitamin a": "#4C9F70",
  "vitamin b complex": "#2E8B57",
  "vitamin c": "#1F9D8B",
  "vitamin d3": "#3D7F5E",
  medication: "#C34F5F",
  antibiotics: "#B04B58",
  deworming: "#8F3F78",
  "egg collecting": "#D9A441",
  "electrolyte plus": "#3A86C8",
};

const TASK_COLOR_PALETTE = [
  "#C17B31",
  "#2D8C74",
  "#C34F5F",
  "#D9A441",
  "#3A86C8",
  "#8F3F78",
  "#5A7D2B",
  "#D06A3C",
  "#4E6FD8",
  "#A5578D",
];

const formatTimeValue = (date: Date) => {
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
};

const formatDisplayTime = (time?: string | null) => {
  if (!time) return "Time unavailable";
  const [hourValue, minuteValue] = time.split(":").map(Number);
  if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) {
    return time;
  }

  const suffix = hourValue >= 12 ? "PM" : "AM";
  const normalizedHour = hourValue % 12 || 12;
  return `${normalizedHour}:${String(minuteValue).padStart(2, "0")} ${suffix}`;
};

const normalizeTaskLabel = (label?: string | null) =>
  (label ?? "Task").trim().toLowerCase().replace(/\s+/g, " ");

const getFallbackTaskColor = (label: string) => {
  const normalized = normalizeTaskLabel(label);
  const hash = normalized
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TASK_COLOR_PALETTE[hash % TASK_COLOR_PALETTE.length];
};

const getTaskColor = (task: ScheduleTask) => {
  return getTaskColorByLabel(task.title || task.category);
};

const formatQuantityValue = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const getTaskColorByLabel = (label: string) => {
  const normalized = normalizeTaskLabel(label);

  if (TASK_TITLE_COLOR_MAP[normalized]) {
    return TASK_TITLE_COLOR_MAP[normalized];
  }

  if (normalized.includes("egg")) return TASK_COLOR_MAP.egg;
  if (normalized.includes("med")) return TASK_COLOR_MAP.medication;
  if (normalized.includes("vit")) return TASK_COLOR_MAP.vitamin;
  if (normalized.includes("feed")) return TASK_COLOR_MAP.feeding;

  return getFallbackTaskColor(normalized);
};

const getTaskColorsForDate = (
  tasks: ScheduleTask[],
  date: Date,
  exclusions: ScheduleOccurrenceExclusion[] = [],
) => [
  ...new Set(
    tasks
      .filter(
        (task) =>
          scheduleTaskMatchesDate(task, date) &&
          !exclusions.some(
            (exclusion) =>
              exclusion.taskId === task.id &&
              exclusion.occurrenceDate === formatScheduleDateKey(date),
          ),
      )
      .map(getTaskColor),
  ),
];

const groupTasksByDate = (tasks: SupabaseScheduleTask[]) =>
  tasks.reduce<Record<string, ScheduleTask[]>>((accumulator, task) => {
    const key = task.startDate || formatScheduleDateKey(new Date());
    accumulator[key] = [...(accumulator[key] ?? []), task];
    return accumulator;
  }, {});

const getUniqueTasks = (tasks: ScheduleTask[]) => {
  const seenTaskIds = new Set<string>();

  return tasks.filter((task) => {
    if (seenTaskIds.has(task.id)) return false;
    seenTaskIds.add(task.id);
    return true;
  });
};

const getTaskBatchNumbers = (task: ScheduleTask) =>
  task.batchNos?.length ? task.batchNos : task.batchNo ? [task.batchNo] : [];

const taskHasSameBatchAssignment = (
  existingTask: ScheduleTask,
  newTask: ScheduleTask,
) => {
  const existingBatches = getTaskBatchNumbers(existingTask);
  const newBatches = getTaskBatchNumbers(newTask);

  if (existingBatches.length === 0 || newBatches.length === 0) {
    return existingBatches.length === newBatches.length;
  }

  return newBatches.some((batchNo) => existingBatches.includes(batchNo));
};

const taskDateRangesOverlap = (
  left: Pick<ScheduleTask, "startDate" | "endDate">,
  right: Pick<ScheduleTask, "startDate" | "endDate">,
) => {
  const leftEnd = left.endDate ?? left.startDate;
  const rightEnd = right.endDate ?? right.startDate;
  return left.startDate <= rightEnd && right.startDate <= leftEnd;
};

const isExcludedOccurrence = (
  task: ScheduleTask,
  date: Date,
  exclusions: ScheduleOccurrenceExclusion[],
) =>
  exclusions.some(
    (exclusion) =>
      exclusion.taskId === task.id &&
      exclusion.occurrenceDate === formatScheduleDateKey(date),
  );

export default function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = false;
  const { activeFarm, configured } = useAuth();
  const { width } = useWindowDimensions();

  const responsiveScale = useMemo(
    () => Math.min(Math.max(width / 390, 0.86), 1.08),
    [width],
  );
  const responsivePadding = Math.max(12, Math.round(16 * responsiveScale));
  const responsiveTitleSize = Math.max(18, Math.round(20 * responsiveScale));
  const responsiveMonthSize = Math.max(18, Math.round(21 * responsiveScale));
  const responsiveAgendaSize = Math.max(14, Math.round(15 * responsiveScale));

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [dayTasks, setDayTasks] =
    useState<Record<string, ScheduleTask[]>>(initialTasksByDate);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [previewTimeframe, setPreviewTimeframe] =
    useState<PreviewTimeframeOption>("Weekly");
  const [previewBaseDate, setPreviewBaseDate] = useState<Date>(new Date());

  // Add Modal State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState(FEEDING_TASK_LABEL);
  const [newTaskStartDate, setNewTaskStartDate] = useState(new Date());
  const [newTaskEndDate, setNewTaskEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [repeat, setRepeat] = useState("Never");
  const [customRepeatDays, setCustomRepeatDays] = useState<string[]>([]);
  const endDateManuallySetRef = useRef(false);
  const [consumableInventoryOptions, setConsumableInventoryOptions] = useState<
    FeedInventoryOption[]
  >([]);
  const [newConsumableInventoryName, setNewConsumableInventoryName] = useState(
    "Choose inventory item",
  );
  const [newConsumableInventoryLabel, setNewConsumableInventoryLabel] =
    useState("Choose inventory item");
  const [newConsumableInventoryId, setNewConsumableInventoryId] = useState<
    string | null
  >(null);
  const [newConsumableInventoryUnit, setNewConsumableInventoryUnit] =
    useState("");
  const [newConsumableInventoryQty, setNewConsumableInventoryQty] = useState<
    number | null
  >(null);
  const [newConsumableDailyAmount, setNewConsumableDailyAmount] = useState("");
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [newTaskBatchNos, setNewTaskBatchNos] = useState<string[]>([]);
  const [newTaskBatchLabels, setNewTaskBatchLabels] = useState<string[]>([
    "All batches",
  ]);
  const [batchPickerSelection, setBatchPickerSelection] = useState<string[]>([
    ALL_BATCHES_VALUE,
  ]);
  const [batchPickerVisible, setBatchPickerVisible] = useState(false);
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [taskOptions, setTaskOptions] = useState<string[]>([
    "Feeding",
    "Vitamins",
    "Medication",
    "Egg Collecting",
  ]);
  const [evidenceModalVisible, setEvidenceModalVisible] = useState(false);
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<{
    task: ScheduleTask;
    dateKey: string;
  } | null>(null);
  const [completionDetails, setCompletionDetails] = useState<{
    task: ScheduleTask;
    dateKey: string;
    completion: SupabaseScheduleTaskCompletion;
  } | null>(null);

  const resetAddTaskForm = (baseDate = selectedDate) => {
    setNewTaskTitle(FEEDING_TASK_LABEL);
    setNewTaskStartDate(new Date(baseDate));
    setNewTaskEndDate(new Date(baseDate));
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setShowTimePicker(false);
    setRepeat("Never");
    setCustomRepeatDays([]);
    endDateManuallySetRef.current = false;
    setNewConsumableInventoryName("Choose inventory item");
    setNewConsumableInventoryLabel("Choose inventory item");
    setNewConsumableInventoryId(null);
    setNewConsumableInventoryUnit("");
    setNewConsumableInventoryQty(null);
    setNewConsumableDailyAmount("");
    setNewTaskBatchNos([]);
    setNewTaskBatchLabels(["All batches"]);
    setBatchPickerSelection([ALL_BATCHES_VALUE]);
    setBatchPickerVisible(false);
    setBatchSearchQuery("");
  };

  const openAddTaskModal = (baseDate = selectedDate) => {
    resetAddTaskForm(baseDate);
    setIsAddModalVisible(true);
  };

  const closeAddTaskModal = () => {
    setIsAddModalVisible(false);
    resetAddTaskForm(selectedDate);
  };

  const loadTaskMetadata = useCallback(
    async (scheduleData?: {
      tasks: ScheduleTask[];
      completions: SupabaseScheduleTaskCompletion[];
    }) => {
      try {
        const [, , inventoryItems, tasks, completions, batches] =
          await Promise.all([
            fetchVitaminOptions(),
            fetchMedicationOptions(),
            activeFarm?.id
              ? fetchInventoryItems(activeFarm.id)
              : Promise.resolve([]),
            scheduleData?.tasks ??
              (activeFarm?.id
                ? fetchScheduleTasks(activeFarm.id)
                : Promise.resolve([])),
            scheduleData?.completions ??
              (activeFarm?.id
                ? fetchScheduleTaskCompletions(activeFarm.id)
                : Promise.resolve([])),
            activeFarm?.id
              ? fetchFarmBatches(activeFarm.id)
              : Promise.resolve([]),
          ]);

        setBatchOptions(
          batches.map((batch) => ({
            batchNo: batch.id,
            label: `Batch ${batch.id}${batch.breed ? ` | ${batch.breed}` : ""}`,
          })),
        );

        const effectiveItems = computeEffectiveInventoryItems(
          inventoryItems,
          tasks,
          new Date(),
          completions,
        );

        // Get unique categories currently in the inventory (including equipment)
        const currentCategories = new Set(
          inventoryItems.map((item) => item.type?.trim()),
        );

        const nextOptions: string[] = [];

        // Map categories to standard task labels if they exist in the inventory
        const hasFeeds = Array.from(currentCategories).some((cat) => {
          const c = cat?.trim().toLowerCase();
          return c === "feeds" || c === "chicken feed";
        });
        const hasVitamins = Array.from(currentCategories).some(
          (cat) => cat?.trim().toLowerCase() === "vitamins",
        );
        const hasMedication = Array.from(currentCategories).some((cat) => {
          const c = cat?.trim().toLowerCase();
          return c === "medication" || c === "medicine";
        });
        const hasEquipment = Array.from(currentCategories).some((cat) => {
          const c = cat?.trim().toLowerCase();
          return c === "equipment" || c === "equipments";
        });

        if (hasFeeds) {
          nextOptions.push("Feeding");
        }
        if (hasVitamins) {
          nextOptions.push("Vitamins");
        }
        if (hasMedication) {
          nextOptions.push("Medication");
        }
        if (hasEquipment) {
          nextOptions.push("Equipment");
        }

        // Add any other categories that are not the standard four, as capitalized task options
        currentCategories.forEach((cat) => {
          if (cat) {
            const c = cat.trim();
            const cLower = c.toLowerCase();
            if (
              cLower !== "feeds" &&
              cLower !== "chicken feed" &&
              cLower !== "vitamins" &&
              cLower !== "medication" &&
              cLower !== "medicine" &&
              cLower !== "equipment" &&
              cLower !== "equipments" &&
              cLower !== "other"
            ) {
              nextOptions.push(c.charAt(0).toUpperCase() + c.slice(1));
            }
          }
        });

        nextOptions.push("Egg Collecting");

        // If we only have "Egg Collecting" (no other categories in inventory), fall back to defaults
        const finalOptions =
          nextOptions.length > 1
            ? nextOptions
            : [
                FEEDING_TASK_LABEL,
                "Vitamins",
                "Medication",
                "Equipment",
                "Egg Collecting",
              ];

        setTaskOptions([...new Set(finalOptions)]);
        setConsumableInventoryOptions(
          effectiveItems.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            type: item.type,
            qty: item.remainingQty,
            expirationDate: item.expirationDate,
          })),
        );
      } catch (error) {
        logError("Schedule task lookup load failed", error);
      }
    },
    [activeFarm?.id],
  );

  const [completions, setCompletions] = useState<
    SupabaseScheduleTaskCompletion[]
  >([]);
  const [occurrenceExclusions, setOccurrenceExclusions] = useState<
    ScheduleOccurrenceExclusion[]
  >([]);

  const loadScheduleTasks = useCallback(async () => {
    if (!configured || !activeFarm?.id) {
      setDayTasks({});
      setCompletions([]);
      setLoadingTasks(false);
      return { tasks: [], completions: [] as SupabaseScheduleTaskCompletion[] };
    }

    setLoadingTasks(true);

    try {
      const [tasks, loadedCompletions, loadedExclusions] = await Promise.all([
        fetchScheduleTasks(activeFarm.id),
        fetchScheduleTaskCompletions(activeFarm.id),
        fetchScheduleOccurrenceExclusions(activeFarm.id),
      ]);
      setDayTasks(groupTasksByDate(tasks));
      setCompletions(loadedCompletions);
      setOccurrenceExclusions(loadedExclusions);
      return { tasks, completions: loadedCompletions };
    } catch (error) {
      setDayTasks({});
      setCompletions([]);
      setOccurrenceExclusions([]);
      logError("Schedule task load failed", error, {
        farmId: activeFarm.id,
      });
      return { tasks: [], completions: [] as SupabaseScheduleTaskCompletion[] };
    } finally {
      setLoadingTasks(false);
    }
  }, [activeFarm?.id, configured]);

  const { completeTask, refreshFarmData } = useFarmData();

  const openEvidenceModal = useCallback(
    (task: ScheduleTask, dateKey: string) => {
      setPendingCompletion({ task, dateKey });
      setEvidenceUri(null);
      setEvidenceModalVisible(true);
    },
    [],
  );

  const closeEvidenceModal = useCallback(() => {
    if (evidenceBusy) return;
    setEvidenceModalVisible(false);
    setPendingCompletion(null);
    setEvidenceUri(null);
  }, [evidenceBusy]);

  const chooseEvidence = useCallback(async (source: "camera" | "library") => {
    setEvidenceBusy(true);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Evidence required",
          "Allow photo access to attach evidence.",
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.85,
              exif: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
              exif: false,
              selectionLimit: 1,
            });

      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.uri) return;

      const optimized = await optimizePhotoForInference({
        photoUri: asset.uri,
        photoWidth: asset.width,
        photoHeight: asset.height,
        maxDimension: 1280,
        quality: 0.82,
      });
      setEvidenceUri(optimized.uri);
    } catch (error) {
      logError("Schedule evidence selection failed", error);
      Alert.alert("Evidence unavailable", "Could not prepare that image.");
    } finally {
      setEvidenceBusy(false);
    }
  }, []);

  const confirmCompletion = useCallback(async () => {
    if (!pendingCompletion || !evidenceUri) {
      Alert.alert(
        "Evidence required",
        "Attach an evidence photo before completing the task.",
      );
      return;
    }

    setEvidenceBusy(true);
    try {
      const savedCompletion = await completeTask(
        pendingCompletion.task,
        pendingCompletion.dateKey,
        evidenceUri,
      );
      if (savedCompletion) {
        setCompletions((prev) => [
          ...prev.filter(
            (c) =>
              !(
                c.taskId === pendingCompletion.task.id &&
                c.completionDate === pendingCompletion.dateKey
              ),
          ),
          savedCompletion,
        ]);
        void loadTaskMetadata();
      }
      setEvidenceModalVisible(false);
      setPendingCompletion(null);
      setEvidenceUri(null);
    } catch (error) {
      logError("Task completion failed", error, {
        farmId: activeFarm?.id,
        taskId: pendingCompletion.task.id,
        dateKey: pendingCompletion.dateKey,
      });
      Alert.alert(
        "Unable to complete task",
        "Could not save the task evidence right now.",
      );
    } finally {
      setEvidenceBusy(false);
    }
  }, [
    activeFarm?.id,
    completeTask,
    evidenceUri,
    loadTaskMetadata,
    pendingCompletion,
  ]);

  const handleMarkComplete = openEvidenceModal;

  const openCompletionDetails = useCallback(
    (
      task: ScheduleTask,
      dateKey: string,
      completion: SupabaseScheduleTaskCompletion,
    ) => {
      setCompletionDetails({ task, dateKey, completion });
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const scheduleData = await loadScheduleTasks();
        await loadTaskMetadata(scheduleData);
      })();
    }, [loadScheduleTasks, loadTaskMetadata]),
  );

  // Selection Modal State
  const [selectionModal, setSelectionModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    value: string;
    onSelect: (val: string) => void;
  }>({
    visible: false,
    title: "",
    options: [],
    value: "",
    onSelect: () => {},
  });

  const glassColor = isDark
    ? "rgba(15, 21, 18, 0.85)"
    : "rgba(255, 255, 255, 0.55)";
  const glassBorder = isDark
    ? "rgba(202, 227, 221, 0.2)"
    : "rgba(255, 255, 255, 0.65)";

  const [calendarViewMode, setCalendarViewMode] = useState<"week" | "month">(
    "month",
  );

  const calendarRows = useMemo(() => {
    if (calendarViewMode === "week") {
      const baseDate = selectedDate || viewDate;
      const dayOfWeek = baseDate.getDay();
      const startOfWeek = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate() - dayOfWeek,
      );

      const weekSlots = [];
      for (let i = 0; i < 7; i++) {
        const slotDate = new Date(
          startOfWeek.getFullYear(),
          startOfWeek.getMonth(),
          startOfWeek.getDate() + i,
        );
        weekSlots.push({
          day: slotDate.getDate(),
          current:
            slotDate.getMonth() === (selectedDate || viewDate).getMonth(),
          date: slotDate,
        });
      }
      return [weekSlots];
    }

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonthDays = new Date(year, month, 0).getDate();
    const prevDays = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      prevDays.push({
        day: prevMonthDays - i,
        current: false,
        date: new Date(year, month, 0 - i),
      });
    }

    const currentDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      currentDays.push({
        day: i,
        current: true,
        date: new Date(year, month, i),
      });
    }

    const totalSlots = prevDays.length + currentDays.length;
    const nextDaysCount = (7 - (totalSlots % 7)) % 7;
    const nextDays = [];
    for (let i = 1; i <= nextDaysCount; i++) {
      nextDays.push({
        day: i,
        current: false,
        date: new Date(year, month + 1, i),
      });
    }

    const fullGrid = [...prevDays, ...currentDays, ...nextDays];
    const rows = [];
    for (let i = 0; i < fullGrid.length; i += 7) {
      rows.push(fullGrid.slice(i, i + 7));
    }
    return rows;
  }, [calendarViewMode, selectedDate, viewDate]);

  const calendarNavTitle = useMemo(() => {
    if (calendarViewMode === "month") {
      return `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    }
    const baseDate = selectedDate || viewDate;
    const dayOfWeek = baseDate.getDay();
    const startOfWeek = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate() - dayOfWeek,
    );
    const endOfWeek = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + 6,
    );

    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      return `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    }
    return `${MONTHS_SHORT[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${MONTHS_SHORT[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
  }, [calendarViewMode, selectedDate, viewDate]);

  const handleNavigateCalendar = (delta: number) => {
    if (calendarViewMode === "week") {
      const baseDate = selectedDate || viewDate;
      const nextDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate() + delta * 7,
      );
      setSelectedDate(nextDate);
      setViewDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setPreviewBaseDate(new Date(nextDate));
    } else {
      setViewDate(
        new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1),
      );
    }
  };

  const changeMonth = (delta: number) => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1),
    );
  };

  const selectedKey = formatScheduleDateKey(selectedDate);
  const filteredBatchOptions = useMemo(() => {
    const query = batchSearchQuery.trim().toLowerCase();
    if (!query) return batchOptions;
    return batchOptions.filter((batch) =>
      batch.label.toLowerCase().includes(query),
    );
  }, [batchOptions, batchSearchQuery]);
  const allTasks = useMemo(
    () => getUniqueTasks(Object.values(dayTasks).flat()),
    [dayTasks],
  );
  const taskOptionColors = useMemo(
    () =>
      Object.fromEntries(
        taskOptions.map((option) => [option, getTaskColorByLabel(option)]),
      ),
    [taskOptions],
  );
  const currentDayTasks = useMemo(
    () =>
      allTasks
        .filter(
          (task) =>
            scheduleTaskMatchesDate(task, selectedDate) &&
            !isExcludedOccurrence(task, selectedDate, occurrenceExclusions),
        )
        .sort((left, right) => left.time.localeCompare(right.time)),
    [allTasks, occurrenceExclusions, selectedDate],
  );

  const currentMonthTasks = useMemo(() => {
    const targetDate =
      previewTimeframe === "Monthly" ? previewBaseDate : viewDate;
    const viewYear = targetDate.getFullYear();
    const viewMonth = targetDate.getMonth();

    return allTasks
      .filter((task) => {
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const testDate = new Date(viewYear, viewMonth, d);
          if (
            scheduleTaskMatchesDate(task, testDate) &&
            !isExcludedOccurrence(task, testDate, occurrenceExclusions)
          ) {
            return true;
          }
        }
        return false;
      })
      .sort((left, right) =>
        left.startDate === right.startDate
          ? left.time.localeCompare(right.time)
          : left.startDate.localeCompare(right.startDate),
      );
  }, [
    allTasks,
    occurrenceExclusions,
    previewBaseDate,
    previewTimeframe,
    viewDate,
  ]);

  const currentWeeklyTasks = useMemo(() => {
    // Determine the week of the previewBaseDate (Sunday - Saturday)
    const startOfWeek = new Date(previewBaseDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return allTasks
      .filter((task) => {
        const cur = new Date(startOfWeek);
        while (cur <= endOfWeek) {
          if (
            scheduleTaskMatchesDate(task, cur) &&
            !isExcludedOccurrence(task, cur, occurrenceExclusions)
          ) {
            return true;
          }
          cur.setDate(cur.getDate() + 1);
        }
        return false;
      })
      .sort((left, right) =>
        left.startDate === right.startDate
          ? left.time.localeCompare(right.time)
          : left.startDate.localeCompare(right.startDate),
      );
  }, [allTasks, occurrenceExclusions, previewBaseDate]);

  const displayedPreviewTasks =
    previewTimeframe === "Weekly" ? currentWeeklyTasks : currentMonthTasks;

  useEffect(() => {
    void scheduleTasksNotifications(allTasks);
  }, [allTasks]);

  const previewTimeframeTitle = useMemo(() => {
    if (previewTimeframe === "Weekly") {
      const startOfWeek = new Date(previewBaseDate);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const firstDayOfMonth = new Date(
        startOfWeek.getFullYear(),
        startOfWeek.getMonth(),
        1,
      ).getDay();
      const weekNum = Math.min(
        5,
        Math.max(1, Math.ceil((startOfWeek.getDate() + firstDayOfMonth) / 7)),
      );

      const startMonth = MONTHS[startOfWeek.getMonth()].slice(0, 3);
      const endMonth = MONTHS[endOfWeek.getMonth()].slice(0, 3);
      const dateRangeStr =
        startOfWeek.getMonth() === endOfWeek.getMonth()
          ? `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}`
          : `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}`;

      return `Week ${weekNum} (${dateRangeStr})`;
    }
    const targetDate = previewBaseDate;
    return `${MONTHS[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
  }, [previewBaseDate, previewTimeframe]);

  const handlePrevPreview = () => {
    if (previewTimeframe === "Weekly") {
      const next = new Date(previewBaseDate);
      next.setDate(next.getDate() - 7);
      setPreviewBaseDate(next);
    } else {
      const next = new Date(previewBaseDate);
      next.setMonth(next.getMonth() - 1);
      setPreviewBaseDate(next);
      setViewDate(next);
    }
  };

  const handleNextPreview = () => {
    if (previewTimeframe === "Weekly") {
      const next = new Date(previewBaseDate);
      next.setDate(next.getDate() + 7);
      setPreviewBaseDate(next);
    } else {
      const next = new Date(previewBaseDate);
      next.setMonth(next.getMonth() + 1);
      setPreviewBaseDate(next);
      setViewDate(next);
    }
  };

  const previewPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 18 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 35) {
          // Swiped Right -> Previous
          handlePrevPreview();
        } else if (gestureState.dx < -35) {
          // Swiped Left -> Next
          handleNextPreview();
        }
      },
    }),
  ).current;

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setPreviewBaseDate(new Date(date));
  };

  const handleRepeatSelection = (selectedRepeat: string) => {
    setRepeat(selectedRepeat);

    const start = new Date(newTaskStartDate);

    // Keep an end date the user already selected; only suggest a range for a new task.
    if (selectedRepeat !== "Never" && endDateManuallySetRef.current) {
      return;
    }

    const end = new Date(start);

    if (selectedRepeat === "Weekly") {
      end.setDate(start.getDate() + 6);
    } else if (selectedRepeat === "Daily") {
      end.setDate(start.getDate() + 29);
    } else if (selectedRepeat === "Monthly") {
      end.setMonth(start.getMonth() + 1);
    } else if (selectedRepeat === "Annually") {
      end.setFullYear(start.getFullYear() + 1);
    } else if (selectedRepeat === "Custom") {
      end.setDate(start.getDate() + 29);
    } else if (selectedRepeat === "Never") {
      end.setTime(start.getTime());
    }

    setNewTaskEndDate(end);
  };

  const getFilteredInventoryOptions = useCallback(() => {
    const titleLower = newTaskTitle.trim().toLowerCase();

    return consumableInventoryOptions.filter((item) => {
      const itemTypeLower = (item.type || "").trim().toLowerCase();

      if (titleLower === "feeding") {
        return itemTypeLower === "feeds" || itemTypeLower === "chicken feed";
      }
      if (titleLower === "vitamins") {
        return itemTypeLower === "vitamins";
      }
      if (titleLower === "medication" || titleLower === "medicine") {
        return itemTypeLower === "medication" || itemTypeLower === "medicine";
      }
      if (titleLower === "equipment" || titleLower === "equipments") {
        return itemTypeLower === "equipment" || itemTypeLower === "equipments";
      }

      // For custom categories, match type directly
      return itemTypeLower === titleLower;
    });
  }, [newTaskTitle, consumableInventoryOptions]);

  const handleTaskSelection = (taskLabel: string) => {
    setNewTaskTitle(taskLabel);
    // Reset linked inventory selections because the task category has changed
    setNewConsumableInventoryName("Choose inventory item");
    setNewConsumableInventoryLabel("Choose inventory item");
    setNewConsumableInventoryId(null);
    setNewConsumableInventoryUnit("");
    setNewConsumableDailyAmount("");
  };

  const handleAddEvent = () => {
    if (!activeFarm?.id) {
      Alert.alert("No farm selected", "Set up your farm before adding tasks.");
      return;
    }

    const isEggCollecting = newTaskTitle === "Egg Collecting";
    const parsedConsumableDailyAmount = Number.parseFloat(
      newConsumableDailyAmount,
    );
    const hasLinkedInventoryItem =
      !isEggCollecting && newConsumableInventoryId !== null;
    const hasInventoryAmountInput =
      !isEggCollecting && newConsumableDailyAmount.trim().length > 0;

    if (repeat === "Custom" && customRepeatDays.length === 0) {
      Alert.alert(
        "Custom repeat days required",
        "Choose at least one day for this custom schedule.",
      );
      return;
    }

    if (
      !isEggCollecting &&
      !hasLinkedInventoryItem &&
      hasInventoryAmountInput
    ) {
      Alert.alert(
        "Inventory item required",
        "Choose the inventory item that should be deducted for this task.",
      );
      return;
    }

    if (
      !isEggCollecting &&
      hasLinkedInventoryItem &&
      (!Number.isFinite(parsedConsumableDailyAmount) ||
        parsedConsumableDailyAmount <= 0)
    ) {
      Alert.alert(
        "Task quantity required",
        "Enter how much inventory should be deducted each time this task is reached.",
      );
      return;
    }

    const startKey = formatScheduleDateKey(newTaskStartDate);
    const endKey = formatScheduleDateKey(newTaskEndDate);

    if (endKey < startKey) {
      Alert.alert(
        "Invalid Date Range",
        "End Date cannot be earlier than Start Date.",
      );
      return;
    }

    const newTask: ScheduleTask = {
      id: "",
      title: newTaskTitle,
      time: formatTimeValue(newTaskStartDate),
      category: newTaskTitle,
      repeat: repeat,
      customRepeatDays: repeat === "Custom" ? customRepeatDays : [],
      startDate: startKey,
      endDate: endKey,
      feedInventoryItemId: hasLinkedInventoryItem
        ? newConsumableInventoryId
        : null,
      feedInventoryItemName: hasLinkedInventoryItem
        ? newConsumableInventoryName
        : null,
      feedDailyAmount: hasLinkedInventoryItem
        ? parsedConsumableDailyAmount
        : null,
      feedDailyUnit: hasLinkedInventoryItem ? newConsumableInventoryUnit : null,
      batchNo: newTaskBatchNos[0] ?? null,
      batchNos: newTaskBatchNos,
    };

    const duplicateTask = allTasks.find((existingTask) => {
      const sameTitle =
        existingTask.title.trim().toLowerCase() ===
        newTask.title.trim().toLowerCase();
      const sameInventory = hasLinkedInventoryItem
        ? existingTask.feedInventoryItemId === newTask.feedInventoryItemId ||
          (existingTask.feedInventoryItemId === null &&
            newTask.feedInventoryItemId === null &&
            existingTask.feedInventoryItemName?.trim().toLowerCase() ===
              newTask.feedInventoryItemName?.trim().toLowerCase())
        : !existingTask.feedInventoryItemId &&
          !existingTask.feedInventoryItemName;

      return (
        sameTitle &&
        sameInventory &&
        taskHasSameBatchAssignment(existingTask, newTask) &&
        taskDateRangesOverlap(existingTask, newTask)
      );
    });

    if (duplicateTask) {
      Alert.alert(
        "Duplicate task",
        "This task is already scheduled for the selected batch and date range.",
      );
      return;
    }

    void createScheduleTask(activeFarm.id, newTask)
      .then((createdTask) => {
        setDayTasks((prev) => ({
          ...prev,
          [startKey]: [...(prev[startKey] || []), createdTask],
        }));
        closeAddTaskModal();
        void refreshFarmData();
        void loadTaskMetadata();
        void scheduleTasksNotifications([createdTask]);
      })
      .catch((error: any) => {
        logError("Schedule task create failed", error, {
          farmId: activeFarm.id,
          newTask,
        });
        const msg = error?.message || error?.details || "Please try again.";
        Alert.alert("Unable to add task", `Could not save task: ${msg}`);
      });
  };

  const handleDeleteTask = (taskId: string, occurrenceDate: string) => {
    if (!activeFarm?.id) return;
    const deletedTask = Object.values(dayTasks)
      .flat()
      .find((task) => task.id === taskId);
    if (!deletedTask) return;

    const alreadyExcluded = occurrenceExclusions.some(
      (exclusion) =>
        exclusion.taskId === taskId &&
        exclusion.occurrenceDate === occurrenceDate,
    );

    if (alreadyExcluded) return;

    setOccurrenceExclusions((prev) => [...prev, { taskId, occurrenceDate }]);

    void recordDeletedScheduleTask(activeFarm.id, deletedTask)
      .then(() =>
        excludeScheduleTaskOccurrence(activeFarm.id!, taskId, occurrenceDate),
      )
      .then(() => {})
      .then(() => {
        void refreshFarmData();
        void loadTaskMetadata();
        void cancelTaskNotifications(taskId);
      })
      .catch((error) => {
        setOccurrenceExclusions((prev) =>
          prev.filter(
            (exclusion) =>
              !(
                exclusion.taskId === taskId &&
                exclusion.occurrenceDate === occurrenceDate
              ),
          ),
        );
        logError("Schedule task delete failed", error, {
          farmId: activeFarm.id,
          taskId,
        });
        Alert.alert(
          "Unable to delete task",
          "The schedule task could not be deleted. Please try again.",
        );
      });
  };

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { fontSize: responsiveTitleSize }]}
          numberOfLines={1}
        >
          Schedule
        </Text>
        <TouchableOpacity
          style={styles.headerHistoryButton}
          onPress={() => router.push("/(tabs)/schedule-history" as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open schedule history"
        >
          <MaterialCommunityIcons name="history" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 15,
          paddingHorizontal: responsivePadding,
        }}
      >
        <View style={styles.contentShell}>
          <BlurCard style={styles.glassCard} borderRadius={10} intensity={16}>
            <View
              style={[
                styles.cardSurface,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                },
              ]}
            >
              <View style={styles.monthCol}>
                {/* Mode Selector Tab: Week / Month */}
                <View style={styles.calendarModeSelectorWrap}>
                  <View style={styles.calendarModeSelector}>
                    <TouchableOpacity
                      onPress={() => setCalendarViewMode("week")}
                      style={[
                        styles.calendarModeTab,
                        calendarViewMode === "week" &&
                          styles.calendarModeTabActive,
                      ]}
                      activeOpacity={0.8}
                      accessibilityRole="tab"
                      accessibilityState={{
                        selected: calendarViewMode === "week",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="calendar-week"
                        size={15}
                        color={
                          calendarViewMode === "week"
                            ? "#FFFFFF"
                            : ChickIntelPalette.gray2
                        }
                      />
                      <Text
                        style={[
                          styles.calendarModeTabText,
                          calendarViewMode === "week" &&
                            styles.calendarModeTabTextActive,
                        ]}
                      >
                        Week
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setCalendarViewMode("month");
                        setViewDate(
                          new Date(
                            selectedDate.getFullYear(),
                            selectedDate.getMonth(),
                            1,
                          ),
                        );
                      }}
                      style={[
                        styles.calendarModeTab,
                        calendarViewMode === "month" &&
                          styles.calendarModeTabActive,
                      ]}
                      activeOpacity={0.8}
                      accessibilityRole="tab"
                      accessibilityState={{
                        selected: calendarViewMode === "month",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="calendar-month"
                        size={15}
                        color={
                          calendarViewMode === "month"
                            ? "#FFFFFF"
                            : ChickIntelPalette.gray2
                        }
                      />
                      <Text
                        style={[
                          styles.calendarModeTabText,
                          calendarViewMode === "month" &&
                            styles.calendarModeTabTextActive,
                        ]}
                      >
                        Month
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Calendar Navigation Row */}
                <View style={styles.monthNavRow}>
                  <Pressable
                    onPress={() => handleNavigateCalendar(-1)}
                    hitSlop={15}
                    accessibilityRole="button"
                    accessibilityLabel={
                      calendarViewMode === "week"
                        ? "Previous week"
                        : "Previous month"
                    }
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={28}
                      color={ChickIntelPalette.green1}
                    />
                  </Pressable>
                  <Text
                    style={[
                      styles.monthTitle,
                      {
                        fontSize:
                          calendarViewMode === "week"
                            ? responsiveFontSize(15)
                            : responsiveMonthSize,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {calendarNavTitle}
                  </Text>
                  <Pressable
                    onPress={() => handleNavigateCalendar(1)}
                    hitSlop={15}
                    accessibilityRole="button"
                    accessibilityLabel={
                      calendarViewMode === "week" ? "Next week" : "Next month"
                    }
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={28}
                      color={ChickIntelPalette.green1}
                    />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {DAYS_OF_WEEK.map((d, index) => (
                    <Text key={`dow-${d}-${index}`} style={styles.weekLabel}>
                      {d}
                    </Text>
                  ))}
                </View>

                {calendarRows.map((row, ridx) => (
                  <View key={`row-${ridx}`} style={styles.gridRow}>
                    {row.map((slot, sidx) => {
                      const dateKey = formatScheduleDateKey(slot.date);
                      const isSelected = dateKey === selectedKey;
                      const taskColors = getTaskColorsForDate(
                        allTasks,
                        slot.date,
                        occurrenceExclusions,
                      );

                      return (
                        <Pressable
                          key={`slot-${sidx}`}
                          onPress={() => handleDateSelect(slot.date)}
                          style={[
                            styles.gridSlot,
                            isSelected && styles.selectedSlot,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !slot.current && styles.mutedDayText,
                              isSelected && styles.selectedDayText,
                            ]}
                          >
                            {slot.day}
                          </Text>
                          {taskColors.length > 0 && (
                            <View style={styles.taskIndicatorRow}>
                              {taskColors.map((color, index) => (
                                <View
                                  key={`${dateKey}-${color}-${index}`}
                                  style={[
                                    styles.taskIndicator,
                                    isSelected && styles.selectedIndicator,
                                    {
                                      backgroundColor: color,
                                    },
                                  ]}
                                />
                              ))}
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.agendaWrap}>
                <View style={styles.dayHeadRow}>
                  <Text
                    style={[
                      styles.agendaDate,
                      { fontSize: responsiveAgendaSize },
                    ]}
                  >
                    {selectedDate
                      .toLocaleDateString("en-US", {
                        weekday: "long",
                      })
                      .toUpperCase()}{" "}
                    {selectedDate.getDate()}{" "}
                    {MONTHS[selectedDate.getMonth()].toUpperCase()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openAddTaskModal(selectedDate)}
                    style={styles.quickAddBtn}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Add scheduled task for selected day"
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={20}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.taskList}>
                  {loadingTasks ? (
                    <View style={styles.loadingState}>
                      <ActivityIndicator
                        size="small"
                        color={ChickIntelPalette.green1}
                      />
                      <Text style={styles.loadingText}>
                        Loading schedule...
                      </Text>
                    </View>
                  ) : currentDayTasks.length > 0 ? (
                    currentDayTasks.map((task) => {
                      const completion = completions.find(
                        (c) =>
                          c.taskId === task.id &&
                          c.completionDate === selectedKey,
                      );
                      const statusResult = computeTaskStatus(
                        task,
                        selectedKey,
                        completion,
                      );

                      return (
                        <Pressable
                          key={task.id}
                          style={styles.taskItem}
                          disabled={!statusResult.isCompleted || !completion}
                          onPress={() => {
                            if (completion) {
                              openCompletionDetails(
                                task,
                                selectedKey,
                                completion,
                              );
                            }
                          }}
                        >
                          <View style={styles.taskLeft}>
                            <View
                              style={[
                                styles.categoryBar,
                                {
                                  backgroundColor: getTaskColor(task),
                                },
                              ]}
                            />
                            <View style={{ flex: 1 }}>
                              <View style={styles.taskTitleRow}>
                                <Text style={styles.taskTitle}>
                                  {task.title}
                                </Text>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    { backgroundColor: statusResult.badgeBg },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      { color: statusResult.color },
                                    ]}
                                  >
                                    {statusResult.label}
                                  </Text>
                                </View>
                              </View>
                              {task.feedInventoryItemName ? (
                                <Text style={styles.taskMeta}>
                                  {task.feedInventoryItemName}
                                  {task.feedDailyAmount
                                    ? ` | ${formatQuantityValue(task.feedDailyAmount)} ${task.feedDailyUnit ?? ""}/day`
                                    : ""}
                                </Text>
                              ) : null}
                              {task.batchNos?.length || task.batchNo ? (
                                <Text style={styles.taskMeta}>
                                  Use for: Batch{" "}
                                  {(task.batchNos?.length
                                    ? task.batchNos
                                    : [task.batchNo]
                                  ).join(", Batch ")}
                                </Text>
                              ) : null}
                              <Text style={styles.taskRepeat}>
                                {task.repeat === "Never"
                                  ? "One-time task"
                                  : `Repeats ${task.repeat.toLowerCase()}`}
                              </Text>

                              {!statusResult.isCompleted ? (
                                <Pressable
                                  onPress={() =>
                                    handleMarkComplete(task, selectedKey)
                                  }
                                  style={({ pressed }) => [
                                    styles.completeBtn,
                                    { opacity: pressed ? 0.75 : 1 },
                                  ]}
                                >
                                  <MaterialCommunityIcons
                                    name="check-circle-outline"
                                    size={15}
                                    color={ChickIntelPalette.green1}
                                  />
                                  <Text style={styles.completeBtnText}>
                                    Mark as Completed
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.taskRight}>
                            <Text style={styles.taskTime}>
                              {formatDisplayTime(task.time)}
                            </Text>
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                handleDeleteTask(task.id, selectedKey);
                              }}
                              hitSlop={10}
                              style={styles.deleteTaskBtn}
                            >
                              <MaterialCommunityIcons
                                name="trash-can-outline"
                                size={18}
                                color="#B04B58"
                              />
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={styles.noEvents}>No events today</Text>
                  )}
                </View>
              </View>
            </View>
          </BlurCard>

          {/* Tasks Preview Section with Weekly & Monthly Timeframe Filter */}
          <BlurCard
            style={[styles.glassCard, { marginTop: 14 }]}
            borderRadius={10}
            intensity={16}
          >
            <View
              {...previewPanResponder.panHandlers}
              style={[
                styles.cardSurface,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                },
              ]}
            >
              {/* Timeframe Filter Bar (Matching Reports Page Design) */}
              <View style={styles.previewTimeframeBar}>
                <Text style={styles.previewTimeframeLabel}>TASKS HISTORY</Text>
                <View style={styles.previewSegmentedContainer}>
                  {PREVIEW_TIMEFRAME_OPTIONS.map((option) => {
                    const active = previewTimeframe === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setPreviewTimeframe(option)}
                        activeOpacity={0.8}
                        style={[
                          styles.previewSegmentedItem,
                          active && styles.previewSegmentedItemActive,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            option === "Weekly"
                              ? "calendar-week"
                              : "calendar-month"
                          }
                          size={14}
                          color={active ? "#FFF" : ChickIntelPalette.gray2}
                        />
                        <Text
                          style={[
                            styles.previewSegmentedText,
                            active && styles.previewSegmentedTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Preview Navigation Header: Centered [<] Week Range [>] and Counter */}
              <View style={styles.previewHeaderRow}>
                <View style={styles.previewNavHeaderCenter}>
                  <TouchableOpacity
                    onPress={handlePrevPreview}
                    style={styles.previewNavBtn}
                    hitSlop={10}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      previewTimeframe === "Weekly"
                        ? "Previous week"
                        : "Previous month"
                    }
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                  </TouchableOpacity>

                  <View style={styles.previewTitleStack}>
                    <MaterialCommunityIcons
                      name={
                        previewTimeframe === "Weekly"
                          ? "calendar-week-outline"
                          : "calendar-month-outline"
                      }
                      size={16}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.previewHeaderTitle} numberOfLines={1}>
                      {previewTimeframeTitle}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleNextPreview}
                    style={styles.previewNavBtn}
                    hitSlop={10}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      previewTimeframe === "Weekly" ? "Next week" : "Next month"
                    }
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.previewCountBadge}>
                  <Text style={styles.previewCountText}>
                    {displayedPreviewTasks.length} task
                    {displayedPreviewTasks.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              {displayedPreviewTasks.length > 0 ? (
                <View style={styles.previewList}>
                  {displayedPreviewTasks.map((task) => {
                    const completion = completions.find(
                      (c) =>
                        c.taskId === task.id &&
                        c.completionDate === task.startDate,
                    );
                    const statusResult = computeTaskStatus(
                      task,
                      task.startDate,
                      completion,
                    );

                    return (
                      <Pressable
                        key={`preview-${task.id}`}
                        style={styles.previewTaskItem}
                        disabled={!statusResult.isCompleted || !completion}
                        onPress={() => {
                          if (completion) {
                            openCompletionDetails(
                              task,
                              task.startDate,
                              completion,
                            );
                          }
                        }}
                      >
                        <View style={styles.taskLeft}>
                          <View
                            style={[
                              styles.categoryBar,
                              { backgroundColor: getTaskColor(task) },
                            ]}
                          />
                          <View style={{ flex: 1 }}>
                            <View style={styles.previewTaskTopRow}>
                              <Text style={styles.taskTitle}>{task.title}</Text>
                              <View style={styles.dateTag}>
                                <Text style={styles.dateTagText}>
                                  {formatAppDate(task.startDate)}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.statusBadge,
                                  { backgroundColor: statusResult.badgeBg },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    { color: statusResult.color },
                                  ]}
                                >
                                  {statusResult.label}
                                </Text>
                              </View>
                            </View>
                            {task.feedInventoryItemName ? (
                              <Text style={styles.taskMeta}>
                                {task.feedInventoryItemName}
                                {task.feedDailyAmount
                                  ? ` | ${formatQuantityValue(task.feedDailyAmount)} ${task.feedDailyUnit ?? ""}/day`
                                  : ""}
                              </Text>
                            ) : null}
                            {task.batchNos?.length || task.batchNo ? (
                              <Text style={styles.taskMeta}>
                                Use for: Batch{" "}
                                {(task.batchNos?.length
                                  ? task.batchNos
                                  : [task.batchNo]
                                ).join(", Batch ")}
                              </Text>
                            ) : null}
                            <Text style={styles.taskRepeat}>
                              {task.repeat === "Never"
                                ? "One-time task"
                                : `Repeats ${task.repeat.toLowerCase()}`}
                            </Text>

                            {!statusResult.isCompleted ? (
                              <Pressable
                                onPress={() =>
                                  handleMarkComplete(task, task.startDate)
                                }
                                style={({ pressed }) => [
                                  styles.completeBtn,
                                  { opacity: pressed ? 0.75 : 1 },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="check-circle-outline"
                                  size={15}
                                  color={ChickIntelPalette.green1}
                                />
                                <Text style={styles.completeBtnText}>
                                  Mark as Completed
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.taskRight}>
                          <Text style={styles.taskTime}>
                            {formatDisplayTime(task.time)}
                          </Text>
                          <Pressable
                            onPress={(event) => {
                              event.stopPropagation();
                              handleDeleteTask(task.id, task.startDate);
                            }}
                            hitSlop={10}
                            style={styles.deleteTaskBtn}
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={18}
                              color="#B04B58"
                            />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noEvents}>
                  {previewTimeframe === "Weekly"
                    ? "No tasks scheduled for this week"
                    : `No tasks scheduled for ${MONTHS[viewDate.getMonth()]}`}
                </Text>
              )}
            </View>
          </BlurCard>
        </View>
      </ScrollView>

      {/* Add Task Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeAddTaskModal}
      >
        <View style={styles.modalScreen}>
          <BackgroundGradient
            width="110%"
            height="110%"
            preserveAspectRatio="xMidYMid slice"
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scale: 1.08 }, { translateY: -14 }] },
            ]}
          />
          <StatusBar style="dark" />
          <KeyboardAvoidingView
            style={styles.modalKeyboardArea}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={insets.top}
          >
            <View
              style={[
                styles.modalHeaderContainer,
                { paddingTop: insets.top + 10 },
              ]}
            >
              <View style={styles.modalTopBar}>
                <TouchableOpacity
                  onPress={closeAddTaskModal}
                  style={styles.modalBackButton}
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
              </View>

              <View style={styles.modalTitleCard}>
                <View style={styles.modalKickerRow}>
                  <MaterialCommunityIcons
                    name="calendar-clock-outline"
                    size={15}
                    color="#CAE3DD"
                  />
                  <Text style={styles.modalKickerText}>Schedule routine</Text>
                </View>
                <Text style={styles.modalPageTitle}>Add New Task</Text>
                <Text style={styles.modalPageSubtitle}>
                  Set up feeding, treatment, egg collection, or custom flock
                  tasks.
                </Text>
              </View>

              <View style={styles.modalSummaryChipRow}>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="clipboard-list-outline"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {newTaskTitle || "Task"}
                  </Text>
                </View>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {formatDisplayTime(formatTimeValue(newTaskStartDate))}
                  </Text>
                </View>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="repeat"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {repeat === "Never" ? "One-time" : repeat}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>Task details</Text>
                </View>

                <ChickSelectRow
                  value={newTaskTitle}
                  placeholder="Select Task"
                  rowStyle={styles.compactSelectRow}
                  onPress={() =>
                    setSelectionModal({
                      visible: true,
                      title: "Select Task",
                      options: taskOptions,
                      value: newTaskTitle,
                      onSelect: handleTaskSelection,
                    })
                  }
                />

                <ChickSelectRow
                  label="Use for batch"
                  value={
                    newTaskBatchLabels.length > 1
                      ? `${newTaskBatchLabels.length} batches selected`
                      : (newTaskBatchLabels[0] ?? "All batches")
                  }
                  placeholder="All batches"
                  rowStyle={styles.compactSelectRow}
                  onPress={() => {
                    setBatchSearchQuery("");
                    setBatchPickerSelection(
                      newTaskBatchNos.length > 0
                        ? [...newTaskBatchNos]
                        : [ALL_BATCHES_VALUE],
                    );
                    setBatchPickerVisible(true);
                  }}
                />

                {newTaskTitle !== "Egg Collecting" ? (
                  <>
                    <ChickSelectRow
                      value={newConsumableInventoryLabel}
                      placeholder="Choose inventory item"
                      rowStyle={styles.compactSelectRow}
                      onPress={() => {
                        const filteredOptions = getFilteredInventoryOptions();
                        if (filteredOptions.length === 0) {
                          Alert.alert(
                            "No matching inventory",
                            `Add a consumable inventory item under the category matching "${newTaskTitle}" first.`,
                          );
                          return;
                        }

                        setSelectionModal({
                          visible: true,
                          title: "Select Inventory Item",
                          options: filteredOptions.map(
                            formatInventoryOptionLabel,
                          ),
                          value:
                            newConsumableInventoryLabel ===
                            "Choose inventory item"
                              ? ""
                              : newConsumableInventoryLabel,
                          onSelect: (value) => {
                            const selectedItem = filteredOptions.find(
                              (item) =>
                                formatInventoryOptionLabel(item) === value,
                            );

                            setNewConsumableInventoryName(
                              selectedItem?.name ?? value,
                            );
                            setNewConsumableInventoryLabel(value);
                            setNewConsumableInventoryId(
                              selectedItem?.id ?? null,
                            );
                            setNewConsumableInventoryUnit(
                              selectedItem?.unit ?? "",
                            );
                            setNewConsumableInventoryQty(
                              selectedItem?.qty ?? null,
                            );
                          },
                        });
                      }}
                    />

                    {newConsumableInventoryQty !== null ? (
                      <View style={styles.addModalInfoCallout}>
                        <MaterialCommunityIcons
                          name="cube-outline"
                          size={16}
                          color={ChickIntelPalette.green1}
                        />
                        <Text style={styles.addModalInfoText}>
                          Available in stock:{" "}
                          <Text
                            style={{
                              fontWeight: "700",
                              color: ChickIntelPalette.gray1,
                            }}
                          >
                            {formatQuantityValue(newConsumableInventoryQty)}{" "}
                            {newConsumableInventoryUnit || "unit"}
                          </Text>
                        </Text>
                      </View>
                    ) : null}

                    <ChickTextInput
                      placeholder="Quantity to deduct per run"
                      keyboardType="decimal-pad"
                      value={newConsumableDailyAmount}
                      onChangeText={setNewConsumableDailyAmount}
                      style={styles.compactInput}
                    />

                    {newConsumableInventoryUnit ? (
                      <View style={styles.addModalInfoCallout}>
                        <MaterialCommunityIcons
                          name="scale-balance"
                          size={16}
                          color={ChickIntelPalette.green1}
                        />
                        <Text style={styles.addModalInfoText}>
                          Deducts using inventory unit:{" "}
                          <Text
                            style={{
                              fontWeight: "700",
                              color: ChickIntelPalette.gray1,
                            }}
                          >
                            {newConsumableInventoryUnit}
                          </Text>
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>

              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="calendar-month-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>
                    Schedule & timing
                  </Text>
                </View>

                {/* Time Picker Row */}
                <TouchableOpacity
                  style={styles.dateRow}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.dateRowCopy}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.dateRowText}>
                      Time:{" "}
                      {formatDisplayTime(formatTimeValue(newTaskStartDate))}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={ChickIntelPalette.gray2}
                  />
                </TouchableOpacity>
                <ChickTimePickerModal
                  visible={showTimePicker}
                  value={newTaskStartDate}
                  onConfirm={(date) => {
                    setShowTimePicker(false);
                    setNewTaskStartDate(date);
                  }}
                  onCancel={() => setShowTimePicker(false)}
                  title="SELECT TIME"
                />

                {/* Start Date Picker Row */}
                <TouchableOpacity
                  style={styles.dateRow}
                  onPress={() => setShowStartDatePicker(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.dateRowCopy}>
                    <MaterialCommunityIcons
                      name="calendar-blank-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.dateRowText}>
                      Start date: {formatAppDate(newTaskStartDate)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={ChickIntelPalette.gray2}
                  />
                </TouchableOpacity>
                <ChickDatePickerModal
                  visible={showStartDatePicker}
                  value={newTaskStartDate}
                  onConfirm={(date) => {
                    setShowStartDatePicker(false);
                    setNewTaskStartDate(date);
                    if (date > newTaskEndDate) {
                      setNewTaskEndDate(date);
                      endDateManuallySetRef.current = false;
                    }
                  }}
                  onCancel={() => setShowStartDatePicker(false)}
                />

                {/* End Date Picker Row */}
                <TouchableOpacity
                  style={styles.dateRow}
                  onPress={() => setShowEndDatePicker(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.dateRowCopy}>
                    <MaterialCommunityIcons
                      name="calendar-range-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.dateRowText}>
                      End date: {formatAppDate(newTaskEndDate)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={ChickIntelPalette.gray2}
                  />
                </TouchableOpacity>
                <ChickDatePickerModal
                  visible={showEndDatePicker}
                  value={newTaskEndDate}
                  minDate={newTaskStartDate}
                  onConfirm={(date) => {
                    setShowEndDatePicker(false);
                    if (date < newTaskStartDate) {
                      Alert.alert(
                        "Invalid Date Range",
                        "End Date cannot be earlier than Start Date.",
                      );
                    } else {
                      setNewTaskEndDate(date);
                      endDateManuallySetRef.current = true;
                    }
                  }}
                  onCancel={() => setShowEndDatePicker(false)}
                />

                {/* Repeat Picker Row */}
                <ChickSelectRow
                  value={
                    repeat === "Never"
                      ? "Does not repeat (One-time)"
                      : `Repeats ${repeat}`
                  }
                  placeholder="Select Repeat Frequency"
                  rowStyle={styles.compactSelectRow}
                  onPress={() =>
                    setSelectionModal({
                      visible: true,
                      title: "Select Repeat Frequency",
                      options: [
                        "Never",
                        "Daily",
                        "Weekly",
                        "Monthly",
                        "Annually",
                        "Custom",
                      ],
                      value: repeat,
                      onSelect: handleRepeatSelection,
                    })
                  }
                />

                {repeat === "Custom" && (
                  <View style={styles.customRepeatContainer}>
                    <Text style={styles.customRepeatLabel}>
                      Select repeat days:
                    </Text>
                    <View style={styles.customRepeatRow}>
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = customRepeatDays.includes(day);
                        return (
                          <TouchableOpacity
                            key={day}
                            style={[
                              styles.daySelector,
                              isSelected && styles.daySelectorSelected,
                            ]}
                            onPress={() => {
                              setCustomRepeatDays((prev) =>
                                prev.includes(day)
                                  ? prev.filter((d) => d !== day)
                                  : [...prev, day],
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.daySelectorText,
                                isSelected && styles.daySelectorTextSelected,
                              ]}
                            >
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={closeAddTaskModal}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel adding task"
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSaveButton,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={handleAddEvent}
                  accessibilityRole="button"
                  accessibilityLabel="Add scheduled task"
                >
                  <Text style={styles.modalSaveButtonText}>Add Task</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={evidenceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEvidenceModal}
      >
        <View style={styles.evidenceOverlay}>
          <View style={styles.evidenceCard}>
            <View style={styles.evidenceHeader}>
              <View style={styles.modalFormSectionHeader}>
                <MaterialCommunityIcons
                  name="camera-plus-outline"
                  size={20}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.modalFormSectionTitle}>
                  Task evidence required
                </Text>
              </View>
              <Pressable
                onPress={closeEvidenceModal}
                hitSlop={10}
                disabled={evidenceBusy}
                accessibilityRole="button"
                accessibilityLabel="Close task evidence"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={ChickIntelPalette.gray2}
                />
              </Pressable>
            </View>
            <Text style={styles.evidenceText}>
              Attach a photo before marking this task as completed.
            </Text>
            {evidenceUri ? (
              <Image
                source={{ uri: evidenceUri }}
                style={styles.evidencePreview}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.evidenceActionRow}>
              <Pressable
                onPress={() => void chooseEvidence("camera")}
                style={styles.evidenceSecondaryButton}
                disabled={evidenceBusy}
              >
                <MaterialCommunityIcons
                  name="camera-outline"
                  size={17}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.evidenceSecondaryText}>Take photo</Text>
              </Pressable>
              <Pressable
                onPress={() => void chooseEvidence("library")}
                style={styles.evidenceSecondaryButton}
                disabled={evidenceBusy}
              >
                <MaterialCommunityIcons
                  name="image-outline"
                  size={17}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.evidenceSecondaryText}>Choose photo</Text>
              </Pressable>
            </View>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeEvidenceModal}
                disabled={evidenceBusy}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Pressable
                style={[
                  styles.modalSaveButton,
                  (!evidenceUri || evidenceBusy) && { opacity: 0.45 },
                ]}
                onPress={() => void confirmCompletion()}
                disabled={!evidenceUri || evidenceBusy}
              >
                <Text style={styles.modalSaveButtonText}>
                  {evidenceBusy ? "Saving..." : "Complete Task"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={completionDetails !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletionDetails(null)}
      >
        <View style={styles.evidenceOverlay}>
          <View style={styles.evidenceCard}>
            <View style={styles.evidenceHeader}>
              <View style={styles.modalFormSectionHeader}>
                <MaterialCommunityIcons
                  name="clipboard-check-outline"
                  size={20}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.modalFormSectionTitle}>
                  Completed task details
                </Text>
              </View>
              <Pressable
                onPress={() => setCompletionDetails(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close completed task details"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={ChickIntelPalette.gray2}
                />
              </Pressable>
            </View>
            {completionDetails ? (
              <>
                <Text style={styles.detailsTitle}>
                  {completionDetails.task.title}
                </Text>
                <View style={styles.detailsGrid}>
                  <Text style={styles.detailsItem}>
                    Category: {completionDetails.task.category}
                  </Text>
                  <Text style={styles.detailsItem}>
                    Date: {formatAppDate(completionDetails.dateKey)}
                  </Text>
                  <Text style={styles.detailsItem}>
                    Scheduled: {formatDisplayTime(completionDetails.task.time)}
                  </Text>
                  <Text style={styles.detailsItem}>
                    Status: {completionDetails.completion.completionStatus}
                  </Text>
                  <Text style={styles.detailsItem}>
                    Completed:{" "}
                    {new Date(
                      completionDetails.completion.completedAt,
                    ).toLocaleString()}
                  </Text>
                  {completionDetails.task.feedInventoryItemName ? (
                    <Text style={styles.detailsItem}>
                      Inventory: {completionDetails.task.feedInventoryItemName}
                      {completionDetails.task.feedDailyAmount
                        ? ` (${formatQuantityValue(completionDetails.task.feedDailyAmount)} ${completionDetails.task.feedDailyUnit ?? ""})`
                        : ""}
                    </Text>
                  ) : null}
                </View>
                {completionDetails.completion.evidenceUri ? (
                  <Image
                    source={{ uri: completionDetails.completion.evidenceUri }}
                    style={styles.evidencePreview}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.evidenceText}>
                    No evidence image was stored for this completion.
                  </Text>
                )}
              </>
            ) : null}
            <Pressable
              style={styles.modalSaveButton}
              onPress={() => setCompletionDetails(null)}
            >
              <Text style={styles.modalSaveButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={batchPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBatchPickerVisible(false)}
      >
        <View style={styles.batchPickerBackdrop}>
          <View style={styles.batchPickerCard}>
            <View style={styles.batchPickerHeader}>
              <View style={styles.batchPickerTitleWrap}>
                <View style={styles.batchPickerIconBadge}>
                  <MaterialCommunityIcons
                    name="warehouse"
                    size={19}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <View>
                  <Text style={styles.batchPickerTitle}>Use task for</Text>
                  <Text style={styles.batchPickerSubtitle}>
                    Choose a flock batch or apply it to all.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setBatchPickerVisible(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close batch picker"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color={ChickIntelPalette.gray2}
                />
              </Pressable>
            </View>

            <ChickTextInput
              value={batchSearchQuery}
              onChangeText={setBatchSearchQuery}
              placeholder="Search batch or breed"
              autoCapitalize="none"
              style={styles.batchPickerSearch}
            />

            <ScrollView
              style={styles.batchPickerList}
              contentContainerStyle={styles.batchPickerListContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={() => {
                  setBatchPickerSelection([ALL_BATCHES_VALUE]);
                }}
                style={[
                  styles.batchPickerOption,
                  batchPickerSelection.includes(ALL_BATCHES_VALUE)
                    ? styles.batchPickerOptionActive
                    : null,
                ]}
              >
                <View style={styles.batchPickerOptionIcon}>
                  <MaterialCommunityIcons
                    name="select-group"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <View style={styles.batchPickerOptionCopy}>
                  <Text style={styles.batchPickerOptionTitle}>All batches</Text>
                  <Text style={styles.batchPickerOptionMeta}>
                    This task applies across the farm.
                  </Text>
                </View>
                {batchPickerSelection.includes(ALL_BATCHES_VALUE) ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={19}
                    color={ChickIntelPalette.green1}
                  />
                ) : null}
              </Pressable>

              {filteredBatchOptions.map((batch) => {
                const selected = batchPickerSelection.includes(batch.batchNo);
                return (
                  <Pressable
                    key={batch.batchNo}
                    onPress={() => {
                      const nextSelection = selected
                        ? batchPickerSelection.filter(
                            (batchNo) => batchNo !== batch.batchNo,
                          )
                        : [
                            ...batchPickerSelection.filter(
                              (batchNo) => batchNo !== ALL_BATCHES_VALUE,
                            ),
                            batch.batchNo,
                          ];
                      setBatchPickerSelection(
                        nextSelection.length > 0
                          ? nextSelection
                          : [ALL_BATCHES_VALUE],
                      );
                    }}
                    style={[
                      styles.batchPickerOption,
                      selected ? styles.batchPickerOptionActive : null,
                    ]}
                  >
                    <View style={styles.batchPickerOptionIcon}>
                      <MaterialCommunityIcons
                        name="bird"
                        size={18}
                        color={ChickIntelPalette.green1}
                      />
                    </View>
                    <View style={styles.batchPickerOptionCopy}>
                      <Text style={styles.batchPickerOptionTitle}>
                        {batch.label}
                      </Text>
                      <Text style={styles.batchPickerOptionMeta}>
                        Task assignment batch
                      </Text>
                    </View>
                    {selected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={19}
                        color={ChickIntelPalette.green1}
                      />
                    ) : null}
                  </Pressable>
                );
              })}

              {filteredBatchOptions.length === 0 ? (
                <View style={styles.batchPickerEmpty}>
                  <MaterialCommunityIcons
                    name="magnify-close"
                    size={24}
                    color={ChickIntelPalette.gray2}
                  />
                  <Text style={styles.batchPickerEmptyText}>
                    No matching batches found.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.batchPickerApplyButton}
              onPress={() => {
                const selectedBatchNumbers = batchPickerSelection.filter(
                  (value) => value !== ALL_BATCHES_VALUE,
                );
                if (selectedBatchNumbers.length === 0) {
                  setNewTaskBatchNos([]);
                  setNewTaskBatchLabels(["All batches"]);
                } else {
                  setNewTaskBatchNos(selectedBatchNumbers);
                  setNewTaskBatchLabels(
                    selectedBatchNumbers.map(
                      (batchNo) =>
                        batchOptions.find((batch) => batch.batchNo === batchNo)
                          ?.label ?? `Batch ${batchNo}`,
                    ),
                  );
                }
                setBatchPickerVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.batchPickerApplyText}>Apply selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Selection Modal */}
      <Modal
        visible={selectionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSelectionModal((prev) => ({ ...prev, visible: false }))
        }
      >
        <ChickSelectionModal
          visible={selectionModal.visible}
          title={selectionModal.title}
          options={selectionModal.options}
          value={selectionModal.value}
          optionColors={
            selectionModal.title === "Select Task"
              ? taskOptionColors
              : undefined
          }
          onSelect={(val) => selectionModal.onSelect(val)}
          onClose={() =>
            setSelectionModal((prev) => ({
              ...prev,
              visible: false,
            }))
          }
        />
      </Modal>
    </View>
  );
}

export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <View style={styles.errorScreen}>
      <MaterialCommunityIcons
        name="calendar-alert"
        size={42}
        color={ChickIntelPalette.green1}
      />
      <Text style={styles.errorTitle}>Schedule could not be opened</Text>
      <Text style={styles.errorMessage}>
        Please try again. Your saved schedule data was not changed.
      </Text>
      <TouchableOpacity style={styles.errorRetryButton} onPress={retry}>
        <Text style={styles.errorRetryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(24),
    backgroundColor: ChickIntelPalette.light1,
    gap: 10,
  },
  errorTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  errorMessage: {
    maxWidth: 300,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
  },
  errorRetryButton: {
    marginTop: 6,
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(10),
    borderRadius: 9,
    backgroundColor: ChickIntelPalette.green1,
  },
  errorRetryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(20),
    marginTop: 10,
    marginBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
  },
  headerRightPlaceholder: {
    width: scale(42),
  },
  headerHistoryButton: {
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
  },
  addButton: {
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
  contentShell: {
    width: "100%",
    maxWidth: scale(920),
    alignSelf: "center",
  },
  headerPlus: {
    padding: moderateScale(4),
  },
  glassCard: {
    overflow: "hidden",
  },
  cardSurface: {
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 16,
    overflow: "hidden",
  },
  monthCol: {
    paddingHorizontal: moderateScale(8),
  },
  calendarModeSelectorWrap: {
    alignItems: "center",
    marginBottom: verticalScale(10),
  },
  calendarModeSelector: {
    flexDirection: "row",
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 12,
    padding: 3,
  },
  calendarModeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: verticalScale(6),
    paddingHorizontal: moderateScale(16),
    borderRadius: 9,
  },
  calendarModeTabActive: {
    backgroundColor: ChickIntelPalette.green1,
    shadowColor: ChickIntelPalette.green1,
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  calendarModeTabText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.textMuted,
  },
  calendarModeTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(12),
    marginBottom: 10,
  },
  monthTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(21),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    textAlign: "center",
    flex: 1,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "500",
    color: ChickIntelPalette.green1,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  gridSlot: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    marginHorizontal: moderateScale(2),
    paddingVertical: verticalScale(6),
  },
  selectedSlot: {
    backgroundColor: "rgba(49, 118, 103, 0.15)",
  },
  dayText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
  },
  mutedDayText: {
    opacity: 0.35,
  },
  selectedDayText: {
    fontWeight: "700",
  },
  taskIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 6,
    minHeight: verticalScale(6),
  },
  taskIndicator: {
    width: scale(4),
    height: verticalScale(4),
    borderRadius: 4,
  },
  selectedIndicator: {
    width: scale(10),
    height: verticalScale(6),
    borderRadius: 4,
  },
  divider: {
    height: verticalScale(1),
    backgroundColor: "rgba(49, 118, 103, 0.15)",
    marginVertical: verticalScale(12),
    marginHorizontal: moderateScale(20),
  },
  agendaWrap: {
    paddingHorizontal: moderateScale(12),
  },
  dayHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  agendaDate: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
    letterSpacing: 0.4,
  },
  quickAddBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: 10,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#317667",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  taskList: {
    gap: 8,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(16),
    gap: 8,
  },
  loadingText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "500",
    color: ChickIntelPalette.green1,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: verticalScale(6),
  },
  taskLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  categoryBar: {
    width: scale(4),
    height: verticalScale(28),
    borderRadius: 2,
  },
  taskRight: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 12,
  },
  taskTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  taskMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    opacity: 0.7,
    marginTop: 2,
  },
  taskRepeat: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
    opacity: 0.65,
    marginTop: 2,
  },
  taskTime: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  deleteTaskBtn: {
    padding: moderateScale(2),
  },
  noEvents: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: ChickIntelPalette.green1,
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
  // Add Task Modal (Matching Inventory Add Item Design)
  modalScreen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  modalKeyboardArea: {
    flex: 1,
  },
  modalHeaderContainer: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
    flexShrink: 0,
    paddingBottom: 12,
  },
  modalTopBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalBackButton: {
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
  modalTitleCard: {
    borderRadius: 14,
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    backgroundColor: ChickIntelPalette.green1,
    gap: 4,
  },
  modalKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalKickerText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: "#CAE3DD",
  },
  modalPageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: "#FFFFFF",
  },
  modalPageSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.88)",
  },
  modalSummaryChipRow: {
    flexDirection: "row",
    gap: 6,
  },
  modalSummaryChip: {
    flex: 1,
    minHeight: verticalScale(26),
    paddingVertical: verticalScale(3),
    paddingHorizontal: moderateScale(6),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    backgroundColor: "rgba(254, 254, 254, 0.72)",
  },
  modalSummaryChipText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  modalScrollContent: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
    paddingTop: verticalScale(4),
  },
  batchPickerBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
    backgroundColor: "rgba(20, 31, 29, 0.48)",
  },
  batchPickerCard: {
    maxHeight: "78%",
    borderRadius: 18,
    padding: moderateScale(14),
    backgroundColor: "#F8FCFA",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  batchPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  batchPickerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },
  batchPickerIconBadge: {
    width: scale(36),
    height: verticalScale(36),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
  },
  batchPickerTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(17),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  batchPickerSubtitle: {
    marginTop: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.textMuted,
  },
  batchPickerSearch: {
    minHeight: verticalScale(42),
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  batchPickerList: {
    flexGrow: 0,
  },
  batchPickerListContent: {
    gap: 6,
    paddingBottom: 2,
  },
  batchPickerOption: {
    minHeight: verticalScale(54),
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: moderateScale(9),
    paddingVertical: verticalScale(8),
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  batchPickerOptionActive: {
    borderColor: "rgba(49, 118, 103, 0.2)",
    backgroundColor: "rgba(202, 227, 221, 0.62)",
  },
  batchPickerOptionIcon: {
    width: scale(30),
    height: verticalScale(30),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "rgba(49, 118, 103, 0.1)",
  },
  batchPickerOptionCopy: {
    flex: 1,
    gap: 2,
  },
  batchPickerOptionTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  batchPickerOptionMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.textMuted,
  },
  batchPickerEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: verticalScale(22),
  },
  batchPickerEmptyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.textMuted,
  },
  batchPickerApplyButton: {
    minHeight: verticalScale(42),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: ChickIntelPalette.green1,
  },
  batchPickerApplyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalFormSection: {
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(14),
    backgroundColor: "rgba(254, 254, 254, 0.92)",
  },
  modalFormSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalFormSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "800",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
  },
  addModalInfoCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: "rgba(202, 227, 221, 0.28)",
  },
  addModalInfoText: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    fontWeight: "600",
    color: ChickIntelPalette.textMuted,
  },
  compactSelectRow: {
    minHeight: verticalScale(46),
    paddingVertical: verticalScale(11),
    borderRadius: 12,
    backgroundColor: "rgba(244, 248, 247, 0.96)",
  },
  compactInput: {
    minHeight: verticalScale(46),
    paddingVertical: verticalScale(11),
    borderRadius: 12,
    backgroundColor: "rgba(244, 248, 247, 0.96)",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
  },
  dateRowCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateRowText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: verticalScale(4),
    marginBottom: verticalScale(12),
  },
  modalCancelButton: {
    flex: 1,
    height: verticalScale(52),
    borderRadius: 14,
    backgroundColor: "rgba(254, 254, 254, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButtonText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
  },
  modalSaveButton: {
    flex: 1,
    height: verticalScale(52),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#317667",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 3,
  },
  modalSaveButtonText: {
    color: "#FFF",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
  },
  evidenceOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  evidenceCard: {
    width: "100%",
    maxWidth: scale(420),
    borderRadius: 16,
    padding: moderateScale(18),
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  evidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  evidenceText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.textMuted,
  },
  evidencePreview: {
    width: "100%",
    height: verticalScale(190),
    borderRadius: 12,
    backgroundColor: "#EEF2F1",
  },
  evidenceActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  evidenceSecondaryButton: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.25)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  evidenceSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  detailsTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  detailsGrid: {
    gap: 6,
  },
  detailsItem: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    color: ChickIntelPalette.textMuted,
  },
  customRepeatContainer: {
    gap: 8,
    marginTop: 4,
  },
  customRepeatLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  customRepeatRow: {
    flexDirection: "row",
    gap: 5,
  },
  daySelector: {
    flex: 1,
    minWidth: scale(0),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    borderRadius: 8,
    paddingVertical: verticalScale(8),
    paddingHorizontal: moderateScale(2),
    alignItems: "center",
    justifyContent: "center",
  },
  daySelectorSelected: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  daySelectorText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
  },
  daySelectorTextSelected: {
    color: "#FFF",
  },
  // Tasks Preview Styles
  previewTimeframeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 12,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    marginBottom: verticalScale(12),
    gap: 8,
  },
  previewTimeframeLabel: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  previewSegmentedContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  previewSegmentedItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(5),
    borderRadius: 6,
  },
  previewSegmentedItemActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  previewSegmentedText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  previewSegmentedTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: verticalScale(15),
    marginBottom: verticalScale(4),
    position: "relative",
    width: "100%",
  },
  previewNavHeaderCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6),
    alignSelf: "center",
  },
  previewNavBtn: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
  },
  previewTitleStack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(2),
  },
  previewHeaderTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  previewCountBadge: {
    position: "absolute",
    right: 0,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    paddingHorizontal: moderateScale(7),
    paddingVertical: verticalScale(3),
    borderRadius: 6,
  },
  previewCountText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  previewList: {
    gap: 10,
  },
  previewTaskItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderRadius: 8,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
  },
  previewTaskTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  dateTag: {
    backgroundColor: "rgba(49, 118, 103, 0.15)",
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: 4,
  },
  dateTagText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: moderateScale(7),
    paddingVertical: verticalScale(2),
    borderRadius: 4,
  },
  statusBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
  },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingVertical: verticalScale(4),
    paddingHorizontal: moderateScale(8),
    backgroundColor: "rgba(45, 140, 116, 0.12)",
    borderRadius: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(45, 140, 116, 0.25)",
  },
  completeBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
});
