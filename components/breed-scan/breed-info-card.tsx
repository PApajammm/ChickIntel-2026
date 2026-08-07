import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { BlurCard } from "@/components/ui/blur-card";
import type { BreedScanAttributes } from "@/constants/breed-scan";
import { BREED_DETECTION_NOTE } from "@/constants/breed-scan";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";

import { AttributeList, type BreedAttributeRow } from "./attribute-list";

type BreedInfoCardProps = {
    attributes: BreedScanAttributes;
};

function toRows(a: BreedScanAttributes): BreedAttributeRow[] {
    return [
        { label: "Breed Name:", value: a.breedName },
        { label: "Temperament:", value: a.temperament },
        { label: "Type:", value: a.type },
    ];
}

/**
 * Single mint-wash container: AI detection header, disclaimer note, breed KV grid.
 */
export function BreedInfoCard({ attributes }: BreedInfoCardProps) {
    return (
        <BlurCard style={styles.card} borderRadius={24} intensity={18}>
            <View style={styles.inner}>
                <View style={styles.badge}>
                    <MaterialCommunityIcons
                        name="scan-helper"
                        size={16}
                        color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.badgeText}>Image-based detection</Text>
                </View>

                <Text style={styles.aiTitle}>Breed identified</Text>
                <Text style={styles.breedName} numberOfLines={2}>
                    {attributes.breedName}
                </Text>
                <Text style={styles.note}>{BREED_DETECTION_NOTE}</Text>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Breed information</Text>
                <AttributeList rows={toRows(attributes)} />

                <View style={styles.flexSpacer} />
            </View>
        </BlurCard>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
    },
    inner: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 22,
        minHeight: 320,
        gap: 10,
    },
    badge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(202, 227, 221, 0.76)",
        borderWidth: 1,
        borderColor: "rgba(67, 139, 123, 0.22)",
    },
    badgeText: {
        fontFamily: ChickFont.sans,
        fontSize: 12,
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    aiTitle: {
        fontFamily: ChickFont.display,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "700",
        letterSpacing: -0.25,
        color: ChickIntelPalette.gray1,
    },
    breedName: {
        fontFamily: ChickFont.display,
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "800",
        letterSpacing: -0.6,
        color: ChickIntelPalette.gray1,
    },
    note: {
        ...HealthTypography.meta,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 2,
        color: "#5E6665",
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(67, 139, 123, 0.22)",
        marginVertical: 14,
    },
    sectionTitle: {
        fontFamily: ChickFont.display,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: "700",
        letterSpacing: -0.2,
        color: ChickIntelPalette.gray1,
        marginBottom: 4,
    },
    flexSpacer: {
        flexGrow: 1,
        minHeight: 24,
    },
});
