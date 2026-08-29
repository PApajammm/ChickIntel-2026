import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import type { HealthBehaviorItem } from "@/constants/health-scan-behaviors";
import type { BehaviorCategory } from "@/utils/supabase-behaviors";

type BehaviorChecklistProps = {
  items: HealthBehaviorItem[];
  categories: BehaviorCategory[];
  searchQuery: string;
  activeCategoryId: string;
  additionalObservation: string;
  loading?: boolean;
  selectedIds: Set<string>;
  onSearchChange: (value: string) => void;
  onCategoryChange: (id: string) => void;
  onObservationChange: (value: string) => void;
  onToggle: (id: string) => void;
};

/**
 * Multi-select behavior list with a light ChickIntel surface and high-contrast checks.
 */
export function BehaviorChecklist({
  items,
  categories,
  searchQuery,
  activeCategoryId,
  additionalObservation,
  loading = false,
  selectedIds,
  onSearchChange,
  onCategoryChange,
  onObservationChange,
  onToggle,
}: BehaviorChecklistProps) {
  const categoryOptions = [{ id: "all", name: "All" }, ...categories];
  const listRef = useRef<ScrollView | null>(null);
  const categoryRef = useRef<ScrollView | null>(null);

  // When the active category or search query changes, scroll the list to top
  useEffect(() => {
    listRef.current?.scrollTo({ y: 0, animated: true });

    // Try to make the active category pill visible in the horizontal scroll
    if (categoryRef.current) {
      let index = 0;
      if (activeCategoryId === "all") index = 0;
      else {
        const found = categories.findIndex((c) => c.id === activeCategoryId);
        index = found >= 0 ? found + 1 : 0;
      }

      if (index > -1) {
        categoryRef.current.scrollTo({
          x: Math.max(0, index * 100 - 40),
          animated: true,
        });
      }
    }
  }, [activeCategoryId, searchQuery, categories]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Select Additional Behavior</Text>
      <TextInput
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Search behavior"
        placeholderTextColor="rgba(51, 51, 51, 0.45)"
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ScrollView
        ref={categoryRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContent}
        style={styles.categoryScroll}
      >
        {categoryOptions.map((category) => {
          const active = activeCategoryId === category.id;

          return (
            <Pressable
              key={category.id}
              onPress={() => onCategoryChange(category.id)}
              style={[
                styles.categoryPill,
                active ? styles.categoryPillActive : null,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  active ? styles.categoryTextActive : null,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView
        ref={listRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {loading ? (
          <Text style={styles.emptyText}>Loading behaviors...</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>No behaviors found.</Text>
        ) : (
          items.map((item) => {
            const on = selectedIds.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => onToggle(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>
                  {on ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={16}
                      color={ChickIntelPalette.light1}
                    />
                  ) : null}
                </View>
                <View style={styles.labelStack}>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.description ? (
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Text style={styles.observationLabel}>Additional Observation</Text>
      <TextInput
        value={additionalObservation}
        onChangeText={onObservationChange}
        placeholder="Chicken keeps walking in circles."
        placeholderTextColor="rgba(51, 51, 51, 0.45)"
        style={styles.observationInput}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    paddingHorizontal: moderateScale(14),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(16),
    backgroundColor: "rgba(254, 254, 254, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.32)",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 4,
  },
  cardHeader: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
    color: ChickIntelPalette.gray1,
    marginBottom: verticalScale(10),
  },
  searchInput: {
    minHeight: verticalScale(40),
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(8),
    marginBottom: verticalScale(10),
    backgroundColor: "rgba(202, 227, 221, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: verticalScale(10),
  },
  categoryContent: {
    gap: 8,
    paddingRight: moderateScale(4),
  },
  categoryPill: {
    paddingHorizontal: moderateScale(11),
    paddingVertical: verticalScale(6),
    borderRadius: 999,
    backgroundColor: "rgba(202, 227, 221, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
  },
  categoryPillActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  categoryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  categoryTextActive: {
    color: ChickIntelPalette.light1,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: verticalScale(350),
  },
  scrollContent: {
    paddingBottom: verticalScale(16),
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: verticalScale(8),
  },
  box: {
    width: scale(20),
    height: verticalScale(20),
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: {
    backgroundColor: ChickIntelPalette.green1,
    borderWidth: 2,
    borderColor: ChickIntelPalette.green1,
  },
  boxOff: {
    backgroundColor: "rgba(202, 227, 221, 0.08)",
    borderWidth: 2,
    borderColor: ChickIntelPalette.gray2,
  },
  label: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  labelStack: {
    flex: 1,
    minWidth: scale(0),
  },
  description: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 15,
    fontWeight: "500",
    color: "rgba(51, 51, 51, 0.62)",
    marginTop: verticalScale(1),
  },
  emptyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
    fontWeight: "600",
    color: "rgba(51, 51, 51, 0.62)",
    paddingVertical: verticalScale(12),
  },
  observationLabel: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    lineHeight: 20,
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    marginTop: verticalScale(20),
    marginBottom: verticalScale(6),
  },
  observationInput: {
    minHeight: verticalScale(76),
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(9),
    backgroundColor: "rgba(202, 227, 221, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
  },
});
