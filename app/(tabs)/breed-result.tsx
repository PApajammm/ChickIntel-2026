import {
  moderateScale,
  responsiveFontSize,
  scale,
  verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
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

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { AttributeList } from "@/components/breed-scan/attribute-list";
import {
  BREED_DETECTION_NOTE,
  type BreedScanAttributes,
} from "@/constants/breed-scan";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import {
  inferBreedFromImage,
  mapBreedPredictionToAttributes,
  resolveBestBreedPrediction,
} from "@/utils/breed-image-inference";

export default function BreedResultScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ photoUri?: string }>();

  const photoUri = params.photoUri || "";
  const photoUriRef = useRef(photoUri);
  photoUriRef.current = photoUri;

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(true);
  const [attributes, setAttributes] = useState<BreedScanAttributes | null>(
    null,
  );
  const [isNonChicken, setIsNonChicken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically delete the temporary captured photo when the user leaves this screen
  useEffect(() => {
    return () => {
      const uriToDelete = photoUriRef.current;
      if (uriToDelete) {
        FileSystem.deleteAsync(uriToDelete, { idempotent: true }).catch(
          (err) => {
            // Silently ignore if already deleted or not accessible
          },
        );
      }
    };
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    if (!photoUri) {
      router.replace("/(tabs)/scanner");
      return;
    }

    let active = true;
    setIsAnalyzingImage(true);
    setError(null);
    setIsNonChicken(false);
    setAttributes(null);

    inferBreedFromImage(photoUri)
      .then((inference) => {
        if (!active) return;

        const resolved = resolveBestBreedPrediction(inference);

        if (resolved.isNonChicken) {
          setIsNonChicken(true);
          if (isFocused) {
            Alert.alert(
              "Non-chicken detected",
              "The captured image does not appear to contain a chicken. Retake the photo with the chicken clearly inside the frame.",
            );
          }
          return;
        }

        const validPrediction = resolved.prediction;
        if (!validPrediction) {
          setError(
            "We couldn't identify a breed from this photo. Please try again.",
          );
          if (isFocused) {
            Alert.alert(
              "Breed detection unavailable",
              "We couldn't identify a breed from this photo. Please try again with a clearer view of the chicken.",
            );
          }
          return;
        }

        const breed = mapBreedPredictionToAttributes(validPrediction);
        setAttributes(breed);
      })
      .catch((err) => {
        if (!active) return;
        setError("Unable to process the image. Please try again.");
        if (isFocused) {
          Alert.alert(
            "Scan failed",
            "Unable to capture a breed photo right now.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsAnalyzingImage(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isFocused, photoUri, router]);

  const attributeRows = useMemo(() => {
    if (!attributes) return [];
    return [
      { label: "Breed Name:", value: attributes.breedName },
      { label: "Temperament:", value: attributes.temperament },
      { label: "Type:", value: attributes.type },
    ];
  }, [attributes]);

  return (
    <View style={styles.screen}>
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
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/scanner")
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 18 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleCard}>
          <View style={styles.kickerRow}>
            <Text style={styles.cardTitle}>Breed Result</Text>
          </View>
        </View>

        <View style={styles.summaryChipRow}>
          <View style={styles.summaryChip}>
            <MaterialCommunityIcons
              name="camera-outline"
              size={12}
              color={ChickIntelPalette.green1}
            />
            <Text style={styles.summaryChipText}>Scan frame</Text>
          </View>
          <View style={styles.summaryChip}>
            <MaterialCommunityIcons
              name="bird"
              size={12}
              color={ChickIntelPalette.green1}
            />
            <Text style={styles.summaryChipText} numberOfLines={1}>
              {isNonChicken
                ? "Review"
                : attributes?.breedName ||
                  (isAnalyzingImage ? "Analyzing" : "Review")}
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={12}
              color={ChickIntelPalette.green1}
            />
            <Text style={styles.summaryChipText}>
              {isNonChicken || error ? "Retry" : "Ready"}
            </Text>
          </View>
        </View>

        <View style={styles.resultCard}>
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

            {!isAnalyzingImage && attributes && !isNonChicken && (
              <>
                <View style={styles.divider} />
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.sectionTitle}>Breed information</Text>
                </View>
                <AttributeList rows={attributeRows} />
                <Text style={styles.note}>{BREED_DETECTION_NOTE}</Text>
              </>
            )}

            {!isAnalyzingImage && isNonChicken && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Guidance</Text>
                <Text style={styles.guidanceText}>
                  The captured image does not appear to contain a chicken.
                  Please retake the photo with the chicken clearly centered
                  inside the viewfinder.
                </Text>
              </>
            )}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.doneBtn,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.replace("/(tabs)/scanner")}
        >
          <MaterialCommunityIcons
            name={isNonChicken || error ? "refresh" : "check"}
            size={18}
            color="#FFF"
          />
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
    paddingTop: verticalScale(10),
    gap: 18,
  },
  fixedHeader: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(8),
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRightPlaceholder: {
    width: scale(42),
  },
  headerSpacer: {
    flex: 1,
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
  titleCard: {
    marginTop: verticalScale(0),
    borderRadius: 10,
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    backgroundColor: ChickIntelPalette.green1,
    gap: 4,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cardTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  },
  summaryChipRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: verticalScale(-8),
  },
  summaryChip: {
    flex: 1,
    minHeight: verticalScale(30),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: moderateScale(6),
    backgroundColor: "rgba(254, 254, 254, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  summaryChipText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    backgroundColor: "rgba(254, 254, 254, 0.78)",
    padding: moderateScale(12),
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
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
    flexDirection: "row",
    gap: 8,
    backgroundColor: ChickIntelPalette.green1,
    height: verticalScale(52),
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#317667",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(5) },
    elevation: 3,
  },
  doneBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: "#FFF",
  },
});
