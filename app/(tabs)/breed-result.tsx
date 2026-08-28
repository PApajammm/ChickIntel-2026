import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

import { AttributeList } from "@/components/breed-scan/attribute-list";
import { BlurCard } from "@/components/ui/blur-card";
import { BREED_DETECTION_NOTE, type BreedScanAttributes } from "@/constants/breed-scan";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import {
    inferBreedFromImage,
    isNonChickenClassifierLabel,
    mapBreedPredictionToAttributes,
} from "@/utils/breed-image-inference";
import { logStep } from "@/utils/logger";
import { addRecentBreedScan } from "@/utils/recent-breed-scans";

const TAB_BAR_OFFSET = 55;

export default function BreedResultScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ photoUri?: string }>();

    const photoUri = params.photoUri || "";
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(true);
    const [attributes, setAttributes] = useState<BreedScanAttributes | null>(null);
    const [isNonChicken, setIsNonChicken] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!photoUri) {
            router.replace("/(tabs)/scanner");
            return;
        }

        let active = true;
        setIsAnalyzingImage(true);
        setError(null);
        setIsNonChicken(false);

        inferBreedFromImage(photoUri)
            .then((inference) => {
                if (!active) return;

                const topPrediction = inference?.topPrediction;
                if (!topPrediction) {
                    setError("We couldn't identify a breed from this photo. Please try again.");
                    Alert.alert(
                        "Breed detection unavailable",
                        "We couldn't identify a breed from this photo. Please try again with a clearer view of the chicken.",
                    );
                    return;
                }

                if (isNonChickenClassifierLabel(topPrediction.className)) {
                    setIsNonChicken(true);
                    Alert.alert(
                        "Non-chicken detected",
                        "The captured image does not appear to contain a chicken. Retake the photo with the chicken clearly inside the frame.",
                    );
                    return;
                }

                const breed = mapBreedPredictionToAttributes(topPrediction);
                setAttributes(breed);

                addRecentBreedScan({
                    breedName: breed.breedName,
                    photoUri: photoUri,
                    attributes: breed,
                });

                try {
                    logStep("Breed scan added to in-memory featured cards", {
                        breedName: breed.breedName,
                        modelId: inference?.modelId ?? "unknown",
                        retentionWindow: "3_days",
                        storage: "runtime_memory_only",
                    });
                } catch {
                    // ignore
                }
            })
            .catch((err) => {
                if (!active) return;
                setError("Unable to process the image. Please try again.");
                Alert.alert("Scan failed", "Unable to capture a breed photo right now.");
            })
            .finally(() => {
                if (active) {
                    setIsAnalyzingImage(false);
                }
            });

        return () => {
            active = false;
        };
    }, [photoUri, router]);

    const attributeRows = useMemo(() => {
        if (!attributes) return [];
        return [
            { label: "Breed Name:", value: attributes.breedName },
            { label: "Temperament:", value: attributes.temperament },
            { label: "Type:", value: attributes.type },
        ];
    }, [attributes]);

    return (
        <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={[
                    styles.scroll,
                    { paddingBottom: insets.bottom + TAB_BAR_OFFSET + 28 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() =>
                      router.canGoBack() ? router.back() : router.replace("/(tabs)/scanner")
                    }
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
                  <Text style={styles.pageTitle}>Breed Result</Text>
                </View>
                <Text style={styles.pageSubtitle}>
                    {isAnalyzingImage
                        ? "Analyzing the captured image before displaying the profile."
                        : isNonChicken
                        ? "The scan did not identify a chicken in the frame."
                        : error
                        ? "Scan was unable to complete."
                        : "A quick profile of the detected breed, temperament, and type."}
                </Text>

                <BlurCard style={styles.card} borderRadius={24} intensity={18}>
                    <View style={styles.cardInner}>
                        <View style={styles.row}>
                            <View style={styles.imageContainer}>
                                {photoUri ? (
                                    <Image
                                        source={{ uri: photoUri }}
                                        style={styles.image}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <View style={styles.imageFallback}>
                                        <MaterialCommunityIcons
                                            name="image-off"
                                            size={28}
                                            color={ChickIntelPalette.green1}
                                        />
                                    </View>
                                )}
                            </View>

                            <View style={styles.infoColumn}>
                                {isAnalyzingImage ? (
                                    <View style={styles.loadingWrapper}>
                                        <ActivityIndicator
                                            size="small"
                                            color={ChickIntelPalette.green1}
                                        />
                                        <Text style={styles.loadingText}>Identifying breed...</Text>
                                    </View>
                                ) : isNonChicken ? (
                                    <View style={styles.warningWrapper}>
                                        <View style={styles.warningBadge}>
                                            <MaterialCommunityIcons
                                                name="alert-circle"
                                                size={12}
                                                color="#D32F2F"
                                            />
                                            <Text style={styles.warningBadgeText}>Warning</Text>
                                        </View>
                                        <Text style={styles.warningTitle}>Non-Chicken</Text>
                                        <Text style={styles.warningDesc}>Detected</Text>
                                    </View>
                                ) : error ? (
                                    <View style={styles.warningWrapper}>
                                        <Text style={styles.warningTitle}>Failed</Text>
                                        <Text style={styles.warningDesc}>Inference Error</Text>
                                    </View>
                                ) : attributes ? (
                                    <View style={styles.resultsWrapper}>
                                        <View style={styles.badge}>
                                            <MaterialCommunityIcons
                                                name="scan-helper"
                                                size={12}
                                                color={ChickIntelPalette.green1}
                                            />
                                            <Text style={styles.badgeText}>
                                                Image-based detection
                                            </Text>
                                        </View>
                                        <Text style={styles.aiTitle}>Breed identified</Text>
                                        <Text style={styles.breedName} numberOfLines={2}>
                                            {attributes.breedName}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        {!isAnalyzingImage && attributes && (
                            <>
                                <View style={styles.divider} />
                                <Text style={styles.sectionTitle}>Breed information</Text>
                                <AttributeList rows={attributeRows} />
                                <Text style={styles.note}>{BREED_DETECTION_NOTE}</Text>
                            </>
                        )}

                        {!isAnalyzingImage && isNonChicken && (
                            <>
                                <View style={styles.divider} />
                                <Text style={styles.sectionTitle}>Guidance</Text>
                                <Text style={styles.guidanceText}>
                                    The captured image does not appear to contain a chicken. Please retake the photo with the chicken clearly centered inside the viewfinder.
                                </Text>
                            </>
                        )}
                    </View>
                </BlurCard>

                <Pressable
                    style={styles.doneBtn}
                    onPress={() => router.replace("/(tabs)/scanner")}
                >
                    <Text style={styles.doneBtnText}>
                        {isNonChicken || error ? "Scan Again" : "Done"}
                    </Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: ChickIntelPalette.light1,
    },
    scroll: {
        paddingHorizontal: moderateScale(16),
        gap: 18,
    },
    pageTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(20),
        lineHeight: 28,
        fontWeight: "800",
        letterSpacing: -0.45,
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
        flexShrink: 0,
    },
    pageSubtitle: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 17,
        fontWeight: "600",
        color: ChickIntelPalette.gray2,
        textAlign: "center",
        marginBottom: 6,
    },
    card: {
        borderRadius: 24,
    },
    cardInner: {
        paddingHorizontal: moderateScale(18),
        paddingTop: 18,
        paddingBottom: 22,
        gap: 12,
    },
    row: {
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
    },
    imageContainer: {
        width: moderateScale(100),
        height: verticalScale(130),
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(67, 139, 123, 0.22)",
        backgroundColor: "rgba(67, 139, 123, 0.08)",
    },
    image: {
        width: "100%",
        height: "100%",
    },
    imageFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    infoColumn: {
        flex: 1,
        justifyContent: "center",
    },
    loadingWrapper: {
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: verticalScale(12),
    },
    loadingText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
        color: ChickIntelPalette.gray2,
        textAlign: "center",
    },
    resultsWrapper: {
        gap: 6,
    },
    badge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(4),
        borderRadius: 999,
        backgroundColor: "rgba(202, 227, 221, 0.76)",
        borderWidth: 1,
        borderColor: "rgba(67, 139, 123, 0.22)",
    },
    badgeText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    aiTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(14),
        lineHeight: 18,
        fontWeight: "700",
        color: ChickIntelPalette.gray2,
    },
    breedName: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(22),
        lineHeight: 28,
        fontWeight: "800",
        letterSpacing: -0.4,
        color: ChickIntelPalette.gray1,
    },
    warningWrapper: {
        gap: 4,
    },
    warningBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(4),
        borderRadius: 999,
        backgroundColor: "rgba(244, 67, 54, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(244, 67, 54, 0.25)",
    },
    warningBadgeText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        fontWeight: "700",
        color: "#D32F2F",
    },
    warningTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(18),
        lineHeight: 22,
        fontWeight: "800",
        color: "#D32F2F",
    },
    warningDesc: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "500",
        color: ChickIntelPalette.gray2,
    },
    divider: {
        height: verticalScale(1),
        backgroundColor: "rgba(67, 139, 123, 0.22)",
        marginVertical: verticalScale(12),
    },
    sectionTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(15),
        lineHeight: 20,
        fontWeight: "700",
        letterSpacing: -0.2,
        color: ChickIntelPalette.gray1,
        marginBottom: 4,
    },
    note: {
        ...HealthTypography.meta,
        fontSize: responsiveFontSize(11),
        lineHeight: 15,
        marginTop: 6,
        color: "#5E6665",
        textAlign: "center",
    },
    guidanceText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 18,
        color: ChickIntelPalette.gray2,
    },
    doneBtn: {
        backgroundColor: ChickIntelPalette.green1,
        paddingVertical: verticalScale(14),
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: scale(0), height: verticalScale(4) },
        elevation: 3,
    },
    doneBtnText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(16),
        fontWeight: "700",
        color: "#FFF",
    },
});
