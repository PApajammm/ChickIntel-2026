import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PropsWithChildren } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TextStyle,
    View,
    ViewStyle,
} from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useResponsiveMetrics, useResponsiveScale } from "@/utils/responsive";

export const ChickForm = {
  label: StyleSheet.create({
    base: {
      fontFamily: ChickFont.sans,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.65,
      textTransform: "uppercase",
      color: ChickIntelPalette.gray2,
    },
  }).base,
  inputBase: StyleSheet.create({
    base: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(67, 139, 123, 0.22)",
      backgroundColor: "rgba(254, 254, 254, 0.72)",
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: ChickFont.sans,
      fontSize: 15,
      fontWeight: "500",
      color: ChickIntelPalette.gray1,
    },
  }).base,
};

export function ChickTextInput({
  style,
  placeholderTextColor = "rgba(51, 51, 51, 0.45)",
  ...props
}: TextInputProps) {
  const { moderateScale, verticalScale, responsiveFontSize } =
    useResponsiveMetrics();

  return (
    <TextInput
      {...props}
      style={[
        ChickForm.inputBase,
        {
          minHeight: verticalScale(48),
          paddingHorizontal: moderateScale(14),
          paddingVertical: verticalScale(12),
          fontSize: Math.max(14, responsiveFontSize(15)),
        },
        style,
      ]}
      placeholderTextColor={placeholderTextColor}
    />
  );
}

type ChickSelectRowProps = {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  selectedColor?: string;
  style?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function ChickSelectRow({
  label,
  value,
  placeholder,
  onPress,
  selectedColor,
  style,
  rowStyle,
  labelStyle,
}: ChickSelectRowProps) {
  const display = placeholder && value === placeholder ? placeholder : value;
  const isPlaceholder = !!placeholder && value === placeholder;
  const responsiveScale = useResponsiveScale();

  return (
    <View style={[styles.field, style]}>
      <Text style={[ChickForm.label, labelStyle]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.selectRow,
          rowStyle,
          {
            minHeight: Math.round(48 * responsiveScale),
            paddingHorizontal: Math.round(14 * responsiveScale),
            paddingVertical: Math.round(12 * responsiveScale),
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.selectValueWrap}>
          {selectedColor ? (
            <View
              style={[
                styles.optionColorDot,
                { backgroundColor: selectedColor },
              ]}
            />
          ) : null}
          <Text
            style={[
              styles.selectText,
              isPlaceholder ? styles.placeholderText : null,
              { fontSize: Math.max(14, Math.round(15 * responsiveScale)) },
            ]}
            numberOfLines={1}
          >
            {display}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={ChickIntelPalette.gray1}
        />
      </Pressable>
    </View>
  );
}

type ChickFieldProps = PropsWithChildren<{
  label: string;
  style?: StyleProp<ViewStyle>;
}>;

export function ChickField({ label, children, style }: ChickFieldProps) {
  const responsiveScale = useResponsiveScale();

  return (
    <View style={[styles.field, style]}>
      <Text
        style={[
          ChickForm.label,
          { fontSize: Math.max(11, Math.round(12 * responsiveScale)) },
        ]}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

type ChickSelectionModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  optionColors?: Record<string, string>;
  onSelect: (val: string) => void;
  onClose: () => void;
};

export function ChickSelectionModal({
  visible,
  title,
  options,
  value,
  optionColors,
  onSelect,
  onClose,
}: ChickSelectionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.modalCard}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView
            style={{ maxHeight: 360 }}
            showsVerticalScrollIndicator={false}
          >
            {options.map((opt) => {
              const selected = opt === value;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    selected ? styles.optionRowSelected : null,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={styles.optionContent}>
                    {optionColors?.[opt] ? (
                      <View
                        style={[
                          styles.optionColorDot,
                          {
                            backgroundColor: optionColors[opt],
                          },
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.optionText,
                        selected ? styles.optionTextSelected : null,
                      ]}
                    >
                      {opt}
                    </Text>
                  </View>
                  {selected ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={ChickIntelPalette.green1}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  selectRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
    backgroundColor: "rgba(254, 254, 254, 0.72)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectText: {
    fontFamily: ChickFont.sans,
    fontSize: 15,
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  selectValueWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  placeholderText: {
    color: "rgba(51, 51, 51, 0.5)",
    fontWeight: "500",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(51, 51, 51, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: ChickIntelPalette.light1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  optionRowSelected: {
    backgroundColor: "rgba(202, 227, 221, 0.65)",
  },
  optionText: {
    fontFamily: ChickFont.sans,
    fontSize: 15,
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  optionTextSelected: {
    color: ChickIntelPalette.green1,
  },
});
