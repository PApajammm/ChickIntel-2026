import { StyleSheet, Text, View } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";

export type BreedAttributeRow = {
    label: string;
    value: string;
};

type AttributeListProps = {
    rows: BreedAttributeRow[];
};

/**
 * Two-column key–value rows for breed metadata (labels left, values right).
 */
export function AttributeList({ rows }: AttributeListProps) {
    return (
        <View style={styles.wrap}>
            {rows.map((row) => (
                <View key={row.label} style={styles.row}>
                    <Text style={styles.label}>{row.label}</Text>
                    <Text style={styles.value}>{row.value}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        gap: 10,
        paddingTop: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: "rgba(254, 254, 254, 0.72)",
        borderWidth: 1,
        borderColor: "rgba(67, 139, 123, 0.16)",
    },
    label: {
        ...HealthTypography.bodyMedium,
        fontWeight: "600",
        color: ChickIntelPalette.gray1,
        flexShrink: 0,
        maxWidth: "42%",
    },
    value: {
        ...HealthTypography.bodyMedium,
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
        flex: 1,
        textAlign: "right",
    },
});
