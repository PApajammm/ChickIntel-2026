import { StyleSheet, Text, View } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";

type ChipListProps = {
    labels: string[];
    compact?: boolean;
};

export function ChipList({ labels, compact = false }: ChipListProps) {
    if (labels.length === 0) return null;

    return (
        <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
            {labels.map((label) => (
                <View
                    key={label}
                    style={[styles.chip, compact ? styles.chipCompact : null]}
                >
                    <Text
                        style={[
                            styles.text,
                            compact ? styles.textCompact : null,
                        ]}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    wrapCompact: {
        gap: 6,
    },
    chip: {
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(6),
        borderRadius: 999,
        backgroundColor: "rgba(202, 227, 221, 0.75)",
        borderWidth: 1,
        borderColor: "rgba(67, 139, 123, 0.24)",
    },
    chipCompact: {
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(5),
    },
    text: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 16,
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    textCompact: {
        fontSize: responsiveFontSize(11),
        lineHeight: 14,
    },
});
