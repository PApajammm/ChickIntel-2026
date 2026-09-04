import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import {
  moderateScale,
  responsiveFontSize,
  scale,
  verticalScale,
} from "@/utils/responsive";

const MONTH_NAMES = [
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

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// =============================================================================
// ChickDatePickerModal
// =============================================================================

export interface ChickDatePickerModalProps {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minDate?: Date;
  maxDate?: Date;
  title?: string;
}

export function ChickDatePickerModal({
  visible,
  value,
  onConfirm,
  onCancel,
  minDate,
  maxDate,
  title,
}: ChickDatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(value || new Date());
  const [viewYear, setViewYear] = useState<number>(
    (value || new Date()).getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState<number>(
    (value || new Date()).getMonth(),
  );

  useEffect(() => {
    if (visible) {
      const d = value || new Date();
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  const changeMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    } else if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  };

  const calendarDays = useMemo(() => {
    // Determine the first day of the month (0 = Sunday, 1 = Monday, ...)
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    // Adjust to Monday-first (0 = Monday ... 6 = Sunday)
    const startOffset = (firstDayIndex + 6) % 7;
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }
    // Pad end of grid to complete the last row
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  }, [viewYear, viewMonth]);

  const headerDayOfWeek = useMemo(() => {
    return DAY_NAMES_SHORT[selectedDate.getDay()];
  }, [selectedDate]);

  const headerMonthName = useMemo(() => {
    return MONTH_NAMES_SHORT[selectedDate.getMonth()];
  }, [selectedDate]);

  const handleSelectDay = (day: number) => {
    const next = new Date(
      viewYear,
      viewMonth,
      day,
      selectedDate.getHours(),
      selectedDate.getMinutes(),
    );
    setSelectedDate(next);
  };

  const isDaySelected = (day: number) => {
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  const isDayDisabled = (day: number) => {
    const dateToCheck = new Date(viewYear, viewMonth, day, 23, 59, 59);
    if (minDate && dateToCheck < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0)) {
      return true;
    }
    if (maxDate && dateToCheck > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59)) {
      return true;
    }
    return false;
  };

  const handleOk = () => {
    onConfirm(selectedDate);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Green Top Header */}
          <View style={styles.header}>
            <Text style={styles.headerYear}>{selectedDate.getFullYear()}</Text>
            <Text style={styles.headerDate}>
              {headerDayOfWeek} {selectedDate.getDate()} {headerMonthName}
            </Text>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {/* Month / Year Navigator */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                style={styles.navBtn}
                activeOpacity={0.7}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color={ChickIntelPalette.gray1}
                />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>

              <TouchableOpacity
                onPress={() => changeMonth(1)}
                style={styles.navBtn}
                activeOpacity={0.7}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={ChickIntelPalette.gray1}
                />
              </TouchableOpacity>
            </View>

            {/* Weekday Labels (M T W T F S S) */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((wd, idx) => (
                <View key={`wd-${idx}`} style={styles.dayCol}>
                  <Text style={styles.weekdayText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.daysGrid}>
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }

                const selected = isDaySelected(day);
                const today = isToday(day);
                const disabled = isDayDisabled(day);

                return (
                  <View key={`day-${day}-${idx}`} style={styles.dayCell}>
                    <TouchableOpacity
                      onPress={() => !disabled && handleSelectDay(day)}
                      disabled={disabled}
                      style={[
                        styles.dayButton,
                        selected && styles.dayButtonSelected,
                        today && !selected && styles.dayButtonToday,
                        disabled && styles.dayButtonDisabled,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                          today && !selected && styles.dayTextToday,
                          disabled && styles.dayTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Bottom Actions */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                onPress={onCancel}
                style={styles.actionButton}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOk}
                style={styles.actionButton}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={styles.okText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// ChickTimePickerModal
// =============================================================================

export interface ChickTimePickerModalProps {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  title?: string;
}

export function ChickTimePickerModal({
  visible,
  value,
  onConfirm,
  onCancel,
  title,
}: ChickTimePickerModalProps) {
  const [selectedHour, setSelectedHour] = useState<number>(8);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [isAm, setIsAm] = useState<boolean>(true);

  useEffect(() => {
    if (visible) {
      const d = value || new Date();
      const rawHour = d.getHours();
      const mins = d.getMinutes();
      setIsAm(rawHour < 12);
      setSelectedHour(rawHour % 12 === 0 ? 12 : rawHour % 12);
      setSelectedMinute(mins);
    }
  }, [visible, value]);

  const handleHourChange = (delta: number) => {
    let next = selectedHour + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    setSelectedHour(next);
  };

  const handleMinuteChange = (delta: number) => {
    let next = selectedMinute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    setSelectedMinute(next);
  };

  const handleOk = () => {
    let finalHour = selectedHour % 12;
    if (!isAm) finalHour += 12;

    const base = value ? new Date(value) : new Date();
    base.setHours(finalHour, selectedMinute, 0, 0);
    onConfirm(base);
  };

  const displayTime = useMemo(() => {
    const h = selectedHour.toString().padStart(2, "0");
    const m = selectedMinute.toString().padStart(2, "0");
    return `${h} : ${m} ${isAm ? "AM" : "PM"}`;
  }, [selectedHour, selectedMinute, isAm]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Green Top Header */}
          <View style={styles.header}>
            <Text style={styles.headerYear}>{title || "SELECT TIME"}</Text>
            <Text style={styles.headerTimeText}>{displayTime}</Text>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.timePickerContainer}>
              {/* Hours Column */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>HOUR</Text>
                <TouchableOpacity
                  onPress={() => handleHourChange(1)}
                  style={styles.timeArrowBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="chevron-up"
                    size={28}
                    color={ChickIntelPalette.green1}
                  />
                </TouchableOpacity>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValueText}>
                    {selectedHour.toString().padStart(2, "0")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleHourChange(-1)}
                  style={styles.timeArrowBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={28}
                    color={ChickIntelPalette.green1}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minutes Column */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>MINUTE</Text>
                <TouchableOpacity
                  onPress={() => handleMinuteChange(5)}
                  style={styles.timeArrowBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="chevron-up"
                    size={28}
                    color={ChickIntelPalette.green1}
                  />
                </TouchableOpacity>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timeValueText}>
                    {selectedMinute.toString().padStart(2, "0")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleMinuteChange(-5)}
                  style={styles.timeArrowBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={28}
                    color={ChickIntelPalette.green1}
                  />
                </TouchableOpacity>
              </View>

              {/* AM/PM Toggle */}
              <View style={styles.amPmContainer}>
                <TouchableOpacity
                  onPress={() => setIsAm(true)}
                  style={[styles.amPmButton, isAm && styles.amPmButtonActive]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.amPmText, isAm && styles.amPmTextActive]}
                  >
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsAm(false)}
                  style={[styles.amPmButton, !isAm && styles.amPmButtonActive]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.amPmText, !isAm && styles.amPmTextActive]}
                  >
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                onPress={onCancel}
                style={styles.actionButton}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOk}
                style={styles.actionButton}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={styles.okText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: scale(330),
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(20),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(16),
  },
  headerYear: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerDate: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(26),
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  headerTimeText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(28),
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: moderateScale(16),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(12),
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(12),
    paddingHorizontal: moderateScale(4),
  },
  navBtn: {
    width: scale(36),
    height: verticalScale(36),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  monthTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  weekdaysRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  dayCol: {
    flex: 1,
    alignItems: "center",
  },
  weekdayText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#8E9494",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: verticalScale(4),
  },
  dayCell: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
    height: verticalScale(38),
  },
  dayButton: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    alignItems: "center",
    justifyContent: "center",
  },
  dayButtonSelected: {
    backgroundColor: ChickIntelPalette.green1,
    shadowColor: ChickIntelPalette.green1,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayButtonToday: {
    borderWidth: 1.5,
    borderColor: ChickIntelPalette.green1,
  },
  dayButtonDisabled: {
    opacity: 0.25,
  },
  dayText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  dayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dayTextToday: {
    color: ChickIntelPalette.green1,
    fontWeight: "800",
  },
  dayTextDisabled: {
    color: "#B0B7B5",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: moderateScale(16),
    marginTop: verticalScale(16),
    paddingTop: verticalScale(8),
  },
  actionButton: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(6),
  },
  cancelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray2,
    letterSpacing: 0.6,
  },
  okText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    letterSpacing: 0.6,
  },

  // Time Picker specific
  timePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(16),
    gap: moderateScale(8),
  },
  timeColumn: {
    alignItems: "center",
    gap: 6,
  },
  timeColumnLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: "#8E9494",
    letterSpacing: 0.5,
  },
  timeArrowBtn: {
    width: scale(36),
    height: verticalScale(32),
    alignItems: "center",
    justifyContent: "center",
  },
  timeValueBox: {
    width: scale(58),
    height: verticalScale(50),
    borderRadius: 12,
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(49, 118, 103, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  timeValueText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  timeSeparator: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    marginHorizontal: moderateScale(4),
    marginTop: verticalScale(12),
  },
  amPmContainer: {
    marginLeft: moderateScale(12),
    gap: verticalScale(8),
    marginTop: verticalScale(14),
  },
  amPmButton: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(8),
    borderRadius: 10,
    backgroundColor: "rgba(244, 248, 247, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  amPmButtonActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  amPmText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  amPmTextActive: {
    color: "#FFFFFF",
  },
});
