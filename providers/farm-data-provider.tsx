import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { logError, logStep } from "@/utils/logger";
import {
    computeEffectiveInventoryItems,
    type EffectiveInventoryItem,
} from "@/utils/stock-alerts";
import {
    createInventoryItem,
    deleteInventoryItem,
    fetchInventoryItems,
    updateInventoryItem,
    type SupabaseInventoryItem,
} from "@/utils/supabase-inventory";
import {
    completeScheduleTask,
    createScheduleTask,
    deleteScheduleTask,
    fetchScheduleTaskCompletions,
    fetchScheduleTasks,
    type SupabaseScheduleTask,
    type SupabaseScheduleTaskCompletion,
} from "@/utils/supabase-schedule";

type FarmDataContextType = {
  rawItems: SupabaseInventoryItem[];
  effectiveItems: EffectiveInventoryItem[];
  scheduleTasks: SupabaseScheduleTask[];
  scheduleCompletions: SupabaseScheduleTaskCompletion[];
  loading: boolean;
  refreshFarmData: () => Promise<void>;
  restockItem: (
    itemId: string,
    restockQty: number,
    extra?: { deliveredDate?: Date; expirationDate?: Date },
  ) => Promise<void>;
  completeTask: (
    task: SupabaseScheduleTask,
    dateKey: string,
  ) => Promise<SupabaseScheduleTaskCompletion | undefined>;
  removeTask: (taskId: string) => Promise<void>;
  addTask: (
    input: Parameters<typeof createScheduleTask>[1],
  ) => Promise<SupabaseScheduleTask>;
  addInventoryItem: (
    input: Parameters<typeof createInventoryItem>[1],
  ) => Promise<SupabaseInventoryItem>;
  removeInventoryItem: (itemId: string) => Promise<void>;
};

const FarmDataContext = createContext<FarmDataContextType | null>(null);

export function FarmDataProvider({ children }: { children: React.ReactNode }) {
  const { activeFarm, configured } = useAuth();
  const [rawItems, setRawItems] = useState<SupabaseInventoryItem[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<SupabaseScheduleTask[]>(
    [],
  );
  const [scheduleCompletions, setScheduleCompletions] = useState<
    SupabaseScheduleTaskCompletion[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  // Periodically tick `now` so time-based schedule status & stock alerts recalculate
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const refreshFarmData = useCallback(async () => {
    if (!configured || !activeFarm?.id) {
      setRawItems([]);
      setScheduleTasks([]);
      setScheduleCompletions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [items, tasks, completions] = await Promise.all([
        fetchInventoryItems(activeFarm.id),
        fetchScheduleTasks(activeFarm.id),
        fetchScheduleTaskCompletions(activeFarm.id),
      ]);

      setRawItems(items);
      setScheduleTasks(tasks);
      setScheduleCompletions(completions);
      logStep("Farm data refreshed", {
        farmId: activeFarm.id,
        itemsCount: items.length,
        tasksCount: tasks.length,
      });
    } catch (error) {
      logError("Failed to refresh farm data", error, {
        farmId: activeFarm?.id,
      });
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id, configured]);

  // Initial load and auth status changes
  useEffect(() => {
    void refreshFarmData();
  }, [refreshFarmData]);

  // Real-time Supabase Subscription
  useEffect(() => {
    if (!configured || !activeFarm?.id) return;

    const channel = supabase
      .channel(`farm_data_realtime_${activeFarm.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `farm_id=eq.${activeFarm.id}`,
        },
        () => {
          void refreshFarmData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_tasks",
          filter: `farm_id=eq.${activeFarm.id}`,
        },
        () => {
          void refreshFarmData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_task_completions",
          filter: `farm_id=eq.${activeFarm.id}`,
        },
        () => {
          void refreshFarmData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeFarm?.id, configured, refreshFarmData]);

  const effectiveItems = useMemo<EffectiveInventoryItem[]>(() => {
    return computeEffectiveInventoryItems(
      rawItems,
      scheduleTasks,
      now,
      scheduleCompletions,
    );
  }, [rawItems, scheduleTasks, now, scheduleCompletions]);

  const restockItem = useCallback(
    async (
      itemId: string,
      restockQty: number,
      extra?: { deliveredDate?: Date; expirationDate?: Date },
    ) => {
      if (!activeFarm?.id) return;

      const targetItem = rawItems.find((i) => i.id === itemId);
      if (!targetItem) return;

      const targetEffectiveItem = effectiveItems.find(
        (item) => item.id === itemId,
      );
      if (!targetEffectiveItem) return;

      const currentTotalQty = Number.isFinite(targetEffectiveItem.baseQty)
        ? targetEffectiveItem.baseQty
        : targetItem.totalQty;
      const currentRemainingQty = targetEffectiveItem.remainingQty;
      const newRemainingQty = currentRemainingQty + restockQty;
      const newTotalQty = Math.max(currentTotalQty, newRemainingQty);
      const newRestockCreditQty =
        targetItem.restockCreditQty + Math.max(0, restockQty);

      await updateInventoryItem(activeFarm.id, itemId, {
        totalQty: newTotalQty,
        restockCreditQty: newRestockCreditQty,
        statusPercent: restockQty > 0 ? 100 : undefined,
        deliveredDate: extra?.deliveredDate,
        expirationDate: extra?.expirationDate,
      });

      // Optimistically update local raw items state immediately
      setRawItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                totalQty: newTotalQty,
                restockCreditQty: newRestockCreditQty,
                statusPercent: restockQty > 0 ? 100 : item.statusPercent,
                deliveryDate: extra?.deliveredDate ?? item.deliveryDate,
                expirationDate: extra?.expirationDate ?? item.expirationDate,
              }
            : item,
        ),
      );

      // Trigger full sync to guarantee consistency
      void refreshFarmData();
    },
    [activeFarm?.id, effectiveItems, rawItems, refreshFarmData],
  );

  const completeTask = useCallback(
    async (task: SupabaseScheduleTask, dateKey: string) => {
      if (!activeFarm?.id) return;

      const savedCompletion = await completeScheduleTask(
        activeFarm.id,
        task.id,
        dateKey,
        task.time,
      );

      // Optimistically update local completions state
      setScheduleCompletions((prev) => [
        ...prev.filter(
          (c) => !(c.taskId === task.id && c.completionDate === dateKey),
        ),
        savedCompletion,
      ]);

      // Refresh farm data to update effective inventory stock immediately
      void refreshFarmData();

      return savedCompletion;
    },
    [activeFarm?.id, refreshFarmData],
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!activeFarm?.id) return;
      await deleteScheduleTask(activeFarm.id, taskId);
      setScheduleTasks((prev) => prev.filter((t) => t.id !== taskId));
      void refreshFarmData();
    },
    [activeFarm?.id, refreshFarmData],
  );

  const addTask = useCallback(
    async (input: Parameters<typeof createScheduleTask>[1]) => {
      if (!activeFarm?.id) throw new Error("No active farm");
      const created = await createScheduleTask(activeFarm.id, input);
      setScheduleTasks((prev) => [created, ...prev]);
      void refreshFarmData();
      return created;
    },
    [activeFarm?.id, refreshFarmData],
  );

  const addInventoryItem = useCallback(
    async (input: Parameters<typeof createInventoryItem>[1]) => {
      if (!activeFarm?.id) throw new Error("No active farm");
      const created = await createInventoryItem(activeFarm.id, input);
      setRawItems((prev) => [
        created,
        ...prev.filter((i) => i.id !== created.id),
      ]);
      void refreshFarmData();
      return created;
    },
    [activeFarm?.id, refreshFarmData],
  );

  const removeInventoryItem = useCallback(
    async (itemId: string) => {
      if (!activeFarm?.id) return;
      await deleteInventoryItem(activeFarm.id, itemId);
      setRawItems((prev) => prev.filter((i) => i.id !== itemId));
      void refreshFarmData();
    },
    [activeFarm?.id, refreshFarmData],
  );

  const value = useMemo(
    () => ({
      rawItems,
      effectiveItems,
      scheduleTasks,
      scheduleCompletions,
      loading,
      refreshFarmData,
      restockItem,
      completeTask,
      removeTask,
      addTask,
      addInventoryItem,
      removeInventoryItem,
    }),
    [
      rawItems,
      effectiveItems,
      scheduleTasks,
      scheduleCompletions,
      loading,
      refreshFarmData,
      restockItem,
      completeTask,
      removeTask,
      addTask,
      addInventoryItem,
      removeInventoryItem,
    ],
  );

  return (
    <FarmDataContext.Provider value={value}>
      {children}
    </FarmDataContext.Provider>
  );
}

export function useFarmData() {
  const context = useContext(FarmDataContext);
  if (!context) {
    throw new Error("useFarmData must be used within a FarmDataProvider");
  }
  return context;
}
