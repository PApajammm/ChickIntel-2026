import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
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
    ChickField,
    ChickSelectionModal,
    ChickSelectRow,
    ChickTextInput,
} from "@/components/ui/chick-form";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { useFarmData } from "@/providers/farm-data-provider";
import { logError } from "@/utils/logger";
import { computeEffectiveInventoryItems } from "@/utils/stock-alerts";
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
    deleteScheduleTask,
    fetchScheduleTaskCompletions,
    fetchScheduleTasks,
    formatScheduleDateKey,
    SCHEDULE_DAYS_OF_WEEK,
    scheduleTaskMatchesDate,
    type SupabaseScheduleTask,
    type SupabaseScheduleTaskCompletion
} from "@/utils/supabase-schedule";

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
const PREVIEW_TIMEFRAME_OPTIONS = ["Weekly", "Monthly"] as const;
type PreviewTimeframeOption = (typeof PREVIEW_TIMEFRAME_OPTIONS)[number];

type ScheduleTask = SupabaseScheduleTask;
type FeedInventoryOption = Pick<
  SupabaseInventoryItem,
  "id" | "name" | "unit" | "type" | "qty"
>;

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

const initialTasksByDate: Record<string, ScheduleTask[]> = {};
const FEEDING_TASK_LABEL = "Feeding";

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

const formatDisplayTime = (time: string) => {
  const [hourValue, minuteValue] = time.split(":").map(Number);
  if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) {
    return time;
  }

  const suffix = hourValue >= 12 ? "PM" : "AM";
  const normalizedHour = hourValue % 12 || 12;
  return `${normalizedHour}:${String(minuteValue).padStart(2, "0")} ${suffix}`;
};

const normalizeTaskLabel = (label: string) =>
  label.trim().toLowerCase().replace(/\s+/g, " ");

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

const getTaskColorsForDate = (tasks: ScheduleTask[], date: Date) => [
  ...new Set(
    tasks
      .filter((task) => scheduleTaskMatchesDate(task, date))
      .map(getTaskColor),
  ),
];

const groupTasksByDate = (tasks: SupabaseScheduleTask[]) =>
  tasks.reduce<Record<string, ScheduleTask[]>>((accumulator, task) => {
    const key = task.startDate;
    accumulator[key] = [...(accumulator[key] ?? []), task];
    return accumulator;
  }, {});

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
  const [consumableInventoryOptions, setConsumableInventoryOptions] = useState<
    FeedInventoryOption[]
  >([]);
  const [newConsumableInventoryName, setNewConsumableInventoryName] = useState(
    "Choose inventory item",
  );
  const [newConsumableInventoryId, setNewConsumableInventoryId] = useState<
    string | null
  >(null);
  const [newConsumableInventoryUnit, setNewConsumableInventoryUnit] =
    useState("");
  const [newConsumableInventoryQty, setNewConsumableInventoryQty] = useState<
    number | null
  >(null);
  const [newConsumableDailyAmount, setNewConsumableDailyAmount] = useState("");
  const [taskOptions, setTaskOptions] = useState<string[]>([
    "Feeding",
    "Vitamins",
    "Medication",
    "Egg Collecting",
  ]);

  const resetAddTaskForm = (baseDate = selectedDate) => {
    setNewTaskTitle(FEEDING_TASK_LABEL);
    setNewTaskStartDate(new Date(baseDate));
    setNewTaskEndDate(new Date(baseDate));
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setShowTimePicker(false);
    setRepeat("Never");
    setCustomRepeatDays([]);
    setNewConsumableInventoryName("Choose inventory item");
    setNewConsumableInventoryId(null);
    setNewConsumableInventoryUnit("");
    setNewConsumableInventoryQty(null);
    setNewConsumableDailyAmount("");
  };

  const openAddTaskModal = (baseDate = selectedDate) => {
    resetAddTaskForm(baseDate);
    setIsAddModalVisible(true);
  };

  const closeAddTaskModal = () => {
    setIsAddModalVisible(false);
    resetAddTaskForm(selectedDate);
  };

  const loadTaskMetadata = useCallback(async () => {
    try {
      const [, , inventoryItems, tasks, completions] = await Promise.all([
        fetchVitaminOptions(),
        fetchMedicationOptions(),
        activeFarm?.id
          ? fetchInventoryItems(activeFarm.id)
          : Promise.resolve([]),
        activeFarm?.id
          ? fetchScheduleTasks(activeFarm.id)
          : Promise.resolve([]),
        activeFarm?.id
          ? fetchScheduleTaskCompletions(activeFarm.id)
          : Promise.resolve([]),
      ]);

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
        })),
      );
    } catch (error) {
      logError("Schedule task lookup load failed", error);
    }
  }, [activeFarm?.id]);

  const [completions, setCompletions] = useState<
    SupabaseScheduleTaskCompletion[]
  >([]);

  const loadScheduleTasks = useCallback(async () => {
    if (!configured || !activeFarm?.id) {
      setDayTasks({});
      setCompletions([]);
      setLoadingTasks(false);
      return;
    }

    setLoadingTasks(true);

    try {
      const [tasks, loadedCompletions] = await Promise.all([
        fetchScheduleTasks(activeFarm.id),
        fetchScheduleTaskCompletions(activeFarm.id),
      ]);
      setDayTasks(groupTasksByDate(tasks));
      setCompletions(loadedCompletions);
    } catch (error) {
      setDayTasks({});
      setCompletions([]);
      logError("Schedule task load failed", error, {
        farmId: activeFarm.id,
      });
    } finally {
      setLoadingTasks(false);
    }
  }, [activeFarm?.id, configured]);

  const { completeTask } = useFarmData();

  const handleMarkComplete = useCallback(
    async (task: ScheduleTask, dateKey: string) => {
      if (!activeFarm?.id) return;

      try {
        const savedCompletion = await completeTask(task, dateKey);
        if (savedCompletion) {
          setCompletions((prev) => [
            ...prev.filter(
              (c) => !(c.taskId === task.id && c.completionDate === dateKey),
            ),
            savedCompletion,
          ]);
        }
      } catch (error) {
        logError("Task completion failed", error, {
          farmId: activeFarm.id,
          taskId: task.id,
          dateKey,
        });
        Alert.alert(
          "Unable to complete task",
          "Could not record task completion right now. Please try again.",
        );
      }
    },
    [activeFarm?.id, completeTask],
  );

  useEffect(() => {
    void loadTaskMetadata();
  }, [loadTaskMetadata]);

  useEffect(() => {
    void loadScheduleTasks();
  }, [loadScheduleTasks]);

  useFocusEffect(
    useCallback(() => {
      void loadTaskMetadata();
      void loadScheduleTasks();
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

  const calendarGrid = useMemo(() => {
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
  }, [viewDate]);

  const changeMonth = (delta: number) => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1),
    );
  };

  const selectedKey = formatScheduleDateKey(selectedDate);
  const allTasks = useMemo(() => Object.values(dayTasks).flat(), [dayTasks]);
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
        .filter((task) => scheduleTaskMatchesDate(task, selectedDate))
        .sort((left, right) => left.time.localeCompare(right.time)),
    [allTasks, selectedDate],
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
          if (scheduleTaskMatchesDate(task, testDate)) {
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
  }, [allTasks, previewBaseDate, previewTimeframe, viewDate]);

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
          if (scheduleTaskMatchesDate(task, cur)) {
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
  }, [allTasks, previewBaseDate]);

  const displayedPreviewTasks =
    previewTimeframe === "Weekly" ? currentWeeklyTasks : currentMonthTasks;

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
    const end = new Date(start);

    if (selectedRepeat === "Weekly") {
      end.setDate(start.getDate() + 7);
    } else if (selectedRepeat === "Daily") {
      end.setDate(start.getDate() + 30);
    } else if (selectedRepeat === "Monthly") {
      end.setMonth(start.getMonth() + 1);
    } else if (selectedRepeat === "Annually") {
      end.setFullYear(start.getFullYear() + 1);
    } else if (selectedRepeat === "Custom") {
      end.setDate(start.getDate() + 30);
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
    };

    void createScheduleTask(activeFarm.id, newTask)
      .then((createdTask) => {
        setDayTasks((prev) => ({
          ...prev,
          [startKey]: [...(prev[startKey] || []), createdTask],
        }));
        closeAddTaskModal();
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

  const handleDeleteTask = (taskId: string) => {
    if (!activeFarm?.id) return;

    void deleteScheduleTask(activeFarm.id, taskId)
      .then(() => {
        setDayTasks((prev) => {
          const nextEntries = Object.entries(prev)
            .map(
              ([dateKey, tasks]) =>
                [dateKey, tasks.filter((task) => task.id !== taskId)] as const,
            )
            .filter(([, tasks]) => tasks.length > 0);

          return Object.fromEntries(nextEntries);
        });
      })
      .catch((error) => {
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
          <Text style={[styles.headerTitle, { fontSize: responsiveTitleSize }]}>
            Schedule
          </Text>
        </View>
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
                <View style={styles.monthNavRow}>
                  <Pressable onPress={() => changeMonth(-1)} hitSlop={15}>
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={28}
                      color={ChickIntelPalette.green1}
                    />
                  </Pressable>
                  <Text
                    style={[
                      styles.monthTitle,
                      { fontSize: responsiveMonthSize },
                    ]}
                  >
                    {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </Text>
                  <Pressable onPress={() => changeMonth(1)} hitSlop={15}>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={28}
                      color={ChickIntelPalette.green1}
                    />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {DAYS_OF_WEEK.map((d) => (
                    <Text key={d} style={styles.weekLabel}>
                      {d}
                    </Text>
                  ))}
                </View>

                {calendarGrid.map((row, ridx) => (
                  <View key={`row-${ridx}`} style={styles.gridRow}>
                    {row.map((slot, sidx) => {
                      const dateKey = formatScheduleDateKey(slot.date);
                      const isSelected = dateKey === selectedKey;
                      const taskColors = getTaskColorsForDate(
                        allTasks,
                        slot.date,
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
                  <Pressable
                    onPress={() => openAddTaskModal(selectedDate)}
                    style={({ pressed }) => [
                      styles.quickAddBtn,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={24}
                      color={ChickIntelPalette.green1}
                    />
                  </Pressable>
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
                        <View key={task.id} style={styles.taskItem}>
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
                                    ? ` • ${formatQuantityValue(task.feedDailyAmount)} ${task.feedDailyUnit ?? ""}/day`
                                    : ""}
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
                              onPress={() => handleDeleteTask(task.id)}
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
                        </View>
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
                  paddingVertical: 14,
                },
              ]}
            >
              {/* Timeframe Filter Bar (Matching Reports Page Design) */}
              <View style={styles.previewTimeframeBar}>
                <Text style={styles.previewTimeframeLabel}>TASKS PREVIEW</Text>
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
                      <View
                        key={`preview-${task.id}`}
                        style={styles.previewTaskItem}
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
                                  ? ` • ${formatQuantityValue(task.feedDailyAmount)} ${task.feedDailyUnit ?? ""}/day`
                                  : ""}
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
                            onPress={() => handleDeleteTask(task.id)}
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
                      </View>
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

      {/* Add Event Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddTaskModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <Text style={styles.modalTitle}>Add to Schedule</Text>

                <ChickSelectRow
                  label="Select task"
                  value={newTaskTitle}
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

                {newTaskTitle !== "Egg Collecting" ? (
                  <>
                    <ChickSelectRow
                      label="Inventory item"
                      value={newConsumableInventoryName}
                      placeholder="Choose inventory item"
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
                          options: filteredOptions.map((item) => item.name),
                          value:
                            newConsumableInventoryName ===
                            "Choose inventory item"
                              ? ""
                              : newConsumableInventoryName,
                          onSelect: (value) => {
                            const selectedItem = filteredOptions.find(
                              (item) => item.name === value,
                            );

                            setNewConsumableInventoryName(value);
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
                      <Text style={styles.feedStockHint}>
                        Available stock:{" "}
                        {formatQuantityValue(newConsumableInventoryQty)}{" "}
                        {newConsumableInventoryUnit || "unit"}
                      </Text>
                    ) : null}
                    <ChickField label="Task quantity">
                      <ChickTextInput
                        placeholder="Enter amount to deduct when time is reached"
                        keyboardType="decimal-pad"
                        value={newConsumableDailyAmount}
                        onChangeText={setNewConsumableDailyAmount}
                        style={styles.feedAmountInput}
                      />
                      {newConsumableInventoryUnit ? (
                        <Text style={styles.feedUnitHint}>
                          Uses inventory unit: {newConsumableInventoryUnit}
                        </Text>
                      ) : null}
                    </ChickField>
                  </>
                ) : null}

                <View style={styles.modalFormRow}>
                  <ChickField label="Time" style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={styles.iconValueRow}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iconValueText}>
                        {formatDisplayTime(formatTimeValue(newTaskStartDate))}
                      </Text>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={18}
                        color={ChickIntelPalette.gray1}
                      />
                    </TouchableOpacity>
                  </ChickField>
                </View>

                <View style={styles.modalFormRow}>
                  <ChickField label="Start Date" style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={styles.iconValueRow}
                      onPress={() => setShowStartDatePicker(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iconValueText}>
                        {formatAppDate(newTaskStartDate)}
                      </Text>
                      <MaterialCommunityIcons
                        name="calendar-outline"
                        size={18}
                        color={ChickIntelPalette.gray1}
                      />
                    </TouchableOpacity>
                  </ChickField>
                  <ChickField label="End Date" style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={styles.iconValueRow}
                      onPress={() => setShowEndDatePicker(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.iconValueText}>
                        {formatAppDate(newTaskEndDate)}
                      </Text>
                      <MaterialCommunityIcons
                        name="calendar-range-outline"
                        size={18}
                        color={ChickIntelPalette.gray1}
                      />
                    </TouchableOpacity>
                  </ChickField>
                </View>
                <ChickSelectRow
                  label="Repeat"
                  value={repeat}
                  onPress={() =>
                    setSelectionModal({
                      visible: true,
                      title: "Select Repeat",
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
                    <View style={styles.customRepeatRow}>
                      {DAYS_OF_WEEK.slice(0, 4).map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.daySelector,
                            customRepeatDays.includes(day) &&
                              styles.daySelectorSelected,
                          ]}
                          onPress={() => {
                            setCustomRepeatDays((prev) =>
                              prev.includes(day)
                                ? prev.filter((d) => d !== day)
                                : [...prev, day],
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.daySelectorText,
                              customRepeatDays.includes(day) &&
                                styles.daySelectorTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.customRepeatRow}>
                      {DAYS_OF_WEEK.slice(4).map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.daySelector,
                            customRepeatDays.includes(day) &&
                              styles.daySelectorSelected,
                          ]}
                          onPress={() => {
                            setCustomRepeatDays((prev) =>
                              prev.includes(day)
                                ? prev.filter((d) => d !== day)
                                : [...prev, day],
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.daySelectorText,
                              customRepeatDays.includes(day) &&
                                styles.daySelectorTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={closeAddTaskModal}
                    style={styles.modalBtnCancel}
                  >
                    <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAddEvent}
                    style={styles.modalBtnAdd}
                  >
                    <Text style={styles.modalBtnTextAdd}>Add Task</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {showStartDatePicker && (
        <DateTimePicker
          value={newTaskStartDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowStartDatePicker(false);
            if (date) {
              setNewTaskStartDate(date);
              if (date > newTaskEndDate) {
                setNewTaskEndDate(date);
              }
            }
          }}
          accentColor={ChickIntelPalette.green1}
          themeVariant={isDark ? "dark" : "light"}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={newTaskEndDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowEndDatePicker(false);
            if (date) {
              if (date < newTaskStartDate) {
                Alert.alert(
                  "Invalid Date Range",
                  "End Date cannot be earlier than Start Date.",
                );
              } else {
                setNewTaskEndDate(date);
              }
            }
          }}
          accentColor={ChickIntelPalette.green1}
          themeVariant={isDark ? "dark" : "light"}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={newTaskStartDate}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date) setNewTaskStartDate(date);
          }}
          accentColor={ChickIntelPalette.green1}
          themeVariant={isDark ? "dark" : "light"}
        />
      )}

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

const styles = StyleSheet.create({
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
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
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
    paddingTop: 16,
    paddingBottom: 24,
    overflow: "hidden",
  },
  monthCol: {
    paddingHorizontal: moderateScale(8),
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(12),
    marginBottom: 16,
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
    marginBottom: 6,
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
    marginVertical: verticalScale(20),
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
    padding: moderateScale(4),
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
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  modalContent: {
    backgroundColor: ChickIntelPalette.light1,
    borderRadius: 5,
    padding: moderateScale(16),
    gap: 14,
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "600",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
    marginBottom: 4,
  },
  iconValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(254, 254, 254, 0.72)",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
  },
  iconValueText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
  },
  feedAmountInput: {
    minHeight: verticalScale(46),
    borderRadius: 5,
  },
  feedUnitHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
    opacity: 0.65,
    marginTop: 4,
  },
  feedStockHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
    marginTop: 3,
  },
  modalFormRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: "rgba(254, 254, 254, 0.72)",
    borderRadius: 5,
    paddingVertical: verticalScale(14),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
  },
  modalBtnAdd: {
    flex: 1,
    backgroundColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(14),
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnTextCancel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    opacity: 0.7,
  },
  modalBtnTextAdd: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    color: "#FFF",
  },
  customRepeatContainer: {
    gap: 8,
    marginTop: 10,
  },
  customRepeatRow: {
    flexDirection: "row",
    gap: 6,
  },
  daySelector: {
    flex: 1,
    minWidth: scale(0),
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
    borderRadius: 4,
    paddingVertical: verticalScale(7),
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
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    letterSpacing: -0.2,
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
