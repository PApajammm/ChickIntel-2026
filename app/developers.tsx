import React, { useRef, useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  Modal,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.64, 250);
const RADIUS_X = SCREEN_WIDTH * 0.33;
const RADIUS_Y = 14;
const DRAG_SENSITIVITY = 130;

const NAV_BTN_SIZE = 44;
const CONTACT_BTN_SIZE = Math.round(NAV_BTN_SIZE * 0.88); // Decreased by 30% from original 55px

const DEVELOPERS = [
  { id: "1", name: "CANLAS, HANNA JEAN", avatar: require("@/assets/images/team/CANLAS.jpg") },
  { id: "2", name: "ESGUERRA, ANGEL ROSE", avatar: require("@/assets/images/team/ESGUERRA.jpg") },
  { id: "3", name: "MADERA, JO ANN", avatar: require("@/assets/images/team/MADERA.jpg") },
  { id: "4", name: "REYES, RALPH ZAIMON JAE", avatar: require("@/assets/images/team/REYES.jpg") },
];

type ContactChannel = {
  id: string;
  name: string;
  icon: string;
  library: "material" | "fa6";
  title: string;
  handle: string;
  prompt: string;
  actionText: string;
  url: string;
};

const CONTACT_CHANNELS: ContactChannel[] = [
  {
    id: "google",
    name: "Gmail",
    icon: "google",
    library: "material",
    title: "Email Us",
    handle: "chickenmanok2026@gmail.com",
    prompt: "For collaborations or any concerns, email us on:",
    actionText: "Send Email",
    url: "mailto:chickenmanok2026@gmail.com",
  },
  {
    id: "phone",
    name: "Mobile Contact",
    icon: "phone",
    library: "material",
    title: "Call or Text Us",
    handle: "0917-1234567",
    prompt: "Call or Text us on:",
    actionText: "Call / Text",
    url: "tel:09171234567",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "instagram",
    library: "material",
    title: "Instagram",
    handle: "@chickintel_app",
    prompt: "Follow or DM us on:",
    actionText: "Open Instagram",
    url: "https://instagram.com/chickintel_app",
  },
  {
    id: "facebook",
    name: "Facebook / Messenger",
    icon: "facebook",
    library: "material",
    title: "Facebook / Messenger",
    handle: "chickenmanok2026@gmail.com",
    prompt: "Follow or DM us on:",
    actionText: "Open Facebook",
    url: "https://www.facebook.com/search/top?q=chickenmanok2026%40gmail.com",
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: "x-twitter",
    library: "fa6",
    title: "X (Twitter)",
    handle: "@chickintelapp",
    prompt: "Follow or DM us on:",
    actionText: "Open X",
    url: "https://x.com/chickintelapp",
  },
];

const NUM_ITEMS = DEVELOPERS.length;

function create3DInterpolations(cardIndex: number, animValue: Animated.Value) {
  const steps = 160;
  const rangeMin = -20;
  const rangeMax = 20;
  const stepSize = (rangeMax - rangeMin) / steps;

  const inputRange: number[] = [];
  const translateXRange: number[] = [];
  const translateYRange: number[] = [];
  const scaleRange: number[] = [];
  const opacityRange: number[] = [];
  const rotateYRange: string[] = [];
  const darkOverlayRange: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const val = rangeMin + i * stepSize;
    inputRange.push(val);

    const theta = (val - cardIndex) * ((2 * Math.PI) / NUM_ITEMS);
    const cosTheta = Math.cos(theta); // +1 = front, -1 = back
    const sinTheta = Math.sin(theta); // +1 = right, -1 = left

    translateXRange.push(RADIUS_X * sinTheta);
    translateYRange.push(RADIUS_Y * -cosTheta);

    const normalizedDepth = (cosTheta + 1) / 2;
    scaleRange.push(0.68 + 0.38 * normalizedDepth);
    opacityRange.push(0.35 + 0.65 * normalizedDepth);

    // Front card has 0 dark overlay; non-centered / background cards ramp up to 0.76 darkness
    const darkAmount = Math.max(0, 1 - Math.pow(normalizedDepth, 2)) * 0.76;
    darkOverlayRange.push(darkAmount);

    const deg = Math.round(sinTheta * -22);
    rotateYRange.push(`${deg}deg`);
  }

  return {
    cardStyle: {
      transform: [
        {
          translateX: animValue.interpolate({
            inputRange,
            outputRange: translateXRange,
            extrapolate: "extend",
          }),
        },
        {
          translateY: animValue.interpolate({
            inputRange,
            outputRange: translateYRange,
            extrapolate: "extend",
          }),
        },
        {
          scale: animValue.interpolate({
            inputRange,
            outputRange: scaleRange,
            extrapolate: "extend",
          }),
        },
        {
          rotateY: animValue.interpolate({
            inputRange,
            outputRange: rotateYRange,
            extrapolate: "extend",
          }),
        },
      ],
      opacity: animValue.interpolate({
        inputRange,
        outputRange: opacityRange,
        extrapolate: "extend",
      }),
    },
    darkOverlayOpacity: animValue.interpolate({
      inputRange,
      outputRange: darkOverlayRange,
      extrapolate: "extend",
    }),
  };
}

export default function DevelopersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const animValue = useRef(new Animated.Value(0)).current;
  const currentStep = useRef(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedContact, setSelectedContact] = useState<ContactChannel | null>(null);

  const handleOpenContact = async (channel: ContactChannel) => {
    setSelectedContact(null);
    try {
      await Linking.openURL(channel.url);
    } catch (err) {
      console.warn("Could not open URL:", err);
    }
  };

  useEffect(() => {
    const listener = animValue.addListener(({ value }) => {
      const normalized = Math.round(value) % NUM_ITEMS;
      const positiveIndex = (normalized + NUM_ITEMS) % NUM_ITEMS;
      setActiveCardIndex(positiveIndex);
    });
    return () => animValue.removeListener(listener);
  }, [animValue]);

  const rotateToStep = (targetStep: number) => {
    currentStep.current = targetStep;
    Animated.spring(animValue, {
      toValue: targetStep,
      friction: 7,
      tension: 45,
      useNativeDriver: true,
    }).start();
  };

  const handlePrev = () => {
    rotateToStep(currentStep.current - 1);
  };

  const handleNext = () => {
    rotateToStep(currentStep.current + 1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 5,
      onPanResponderGrant: () => {
        animValue.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const deltaStep = gestureState.dx / DRAG_SENSITIVITY;
        animValue.setValue(currentStep.current + deltaStep);
      },
      onPanResponderRelease: (_, gestureState) => {
        const deltaStep = gestureState.dx / DRAG_SENSITIVITY;
        const projectedStep = currentStep.current + deltaStep + gestureState.vx * 0.4;
        const target = Math.round(projectedStep);
        rotateToStep(target);
      },
    })
  ).current;

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + verticalScale(8),
            paddingBottom: insets.bottom + verticalScale(14),
          },
        ]}
      >
        {/* Top Bar: Back Button (Fixed) & Title (Lowered by 4rem) */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.appTitle}>ChickIntel App 2026</Text>
            <Text style={styles.appVersion}>Version 1.0.5</Text>
          </View>
        </View>

        {/* 360-Degree Rotational 3D Carousel */}
        <View style={styles.carouselWrapper} {...panResponder.panHandlers}>
          {/* Section Title - Exactly 2.25rem above carousel stage */}
          <Text style={styles.sectionTitle}>Meet the Team</Text>

          <View style={styles.carouselStage}>
            {DEVELOPERS.map((dev, index) => {
              const animatedStyles = create3DInterpolations(index, animValue);
              const isFront = activeCardIndex === index;
              const zIndex = isFront ? 10 : 2;

              return (
                <Animated.View
                  key={dev.id}
                  style={[
                    styles.cardContainer,
                    {
                      zIndex,
                      elevation: isFront ? 10 : 2,
                    },
                    animatedStyles.cardStyle,
                  ]}
                >
                  {/* Glassmorphic Aesthetic Card */}
                  <View style={[styles.cardBox, isFront && styles.activeCardBox]}>
                    {/* Top Decorative Header Accent */}
                    <View style={styles.cardHeaderAccent}>
                      <View style={styles.accentDot} />
                      <View style={styles.accentLine} />
                      <MaterialCommunityIcons
                        name="star-four-points"
                        size={12}
                        color={ChickIntelPalette.green1}
                      />
                    </View>

                    {/* Framed Avatar Image - Anchored to TOP so hair/head is never cut */}
                    <View style={styles.imageWrapper}>
                      <Image
                        source={dev.avatar}
                        style={styles.avatarImage}
                        contentFit="cover"
                        contentPosition="top"
                      />
                      <View style={styles.imageInnerGlow} />
                    </View>

                    {/* Developer Name Capsule */}
                    <View style={styles.nameCapsule}>
                      <Text style={styles.devName} numberOfLines={2}>
                        {dev.name}
                      </Text>
                    </View>

                    {/* Non-centered defocus & darkening overlay */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.cardDarkOverlay,
                        { opacity: animatedStyles.darkOverlayOpacity },
                      ]}
                    />
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Carousel Rotation Controls & Indicators */}
          <View style={styles.controlsRow}>
          <Pressable
            onPress={handlePrev}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color="#FFFFFF" />
          </Pressable>

          {/* Dots */}
          <View style={styles.dotsContainer}>
            {DEVELOPERS.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  const currentMod = ((currentStep.current % NUM_ITEMS) + NUM_ITEMS) % NUM_ITEMS;
                  let diff = idx - currentMod;
                  if (diff > NUM_ITEMS / 2) diff -= NUM_ITEMS;
                  if (diff < -NUM_ITEMS / 2) diff += NUM_ITEMS;
                  rotateToStep(currentStep.current + diff);
                }}
              >
                <View
                  style={[
                    styles.dot,
                    activeCardIndex === idx ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="chevron-right" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
        </View>

        {/* Contact Details Channels (Dark Gray with Palette Orange Icons) */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>CONTACT US</Text>
          <View style={styles.contactRow}>
            {CONTACT_CHANNELS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedContact(item)}
                style={({ pressed }) => [
                  styles.contactBtn,
                  pressed && styles.contactBtnPressed,
                ]}
                hitSlop={8}
              >
                {item.library === "fa6" ? (
                  <FontAwesome6
                    name={item.icon}
                    size={17}
                    color="#F7B274"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={19}
                    color="#F7B274"
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Contact Channel Confirmation Modal */}
      <Modal
        visible={selectedContact !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedContact(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedContact(null)}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Top Icon Badge */}
            {selectedContact && (
              <View style={styles.modalIconBadge}>
                {selectedContact.library === "fa6" ? (
                  <FontAwesome6
                    name={selectedContact.icon}
                    size={22}
                    color="#F7B274"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={selectedContact.icon as any}
                    size={24}
                    color="#F7B274"
                  />
                )}
              </View>
            )}

            <Text style={styles.modalTitle}>{selectedContact?.title}</Text>

            <Text style={styles.modalPrompt}>{selectedContact?.prompt}</Text>

            {/* Pill with Handle / Address */}
            <View style={styles.modalHandlePill}>
              <Text style={styles.modalHandleText} numberOfLines={1}>
                {selectedContact?.handle}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setSelectedContact(null)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnSecondary,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => selectedContact && handleOpenContact(selectedContact)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {selectedContact?.actionText || "Proceed"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.lightGreen,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBar: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
    position: "relative",
    minHeight: scale(38),
  },
  backBtn: {
    position: "absolute",
    left: moderateScale(16),
    top: 0,
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
    zIndex: 10,
  },
  backBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  titleContainer: {
    alignItems: "center",
    marginTop: verticalScale(64), // Lowered by 4rem (64px)
    marginBottom: verticalScale(2),
  },
  appTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(17),
    fontWeight: "700",
    color: "#2b2b2b",
    marginBottom: 2,
  },
  appVersion: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#4a4a4a",
  },
  sectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: 0.8,
    marginTop: 0,
    marginBottom: verticalScale(36), // 2.25rem (36px) spacing above the carousel cards
  },
  carouselWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselStage: {
    width: SCREEN_WIDTH,
    height: verticalScale(296),
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardContainer: {
    position: "absolute",
    width: CARD_WIDTH,
    height: verticalScale(290),
    alignItems: "center",
    justifyContent: "center",
  },
  cardBox: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 24,
    padding: moderateScale(11),
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeCardBox: {
    borderColor: ChickIntelPalette.mediumGreen,
    borderWidth: 2,
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  cardDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 38, 33, 0.78)",
    borderRadius: 24,
  },
  cardHeaderAccent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(6),
    paddingBottom: moderateScale(4),
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ChickIntelPalette.green2,
  },
  accentLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "rgba(67, 139, 123, 0.2)",
    marginHorizontal: 8,
    borderRadius: 1,
  },
  imageWrapper: {
    width: "100%",
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1.5,
    borderColor: "rgba(202, 227, 221, 0.8)",
    position: "relative",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  imageInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  nameCapsule: {
    width: "100%",
    paddingVertical: moderateScale(9),
    paddingHorizontal: moderateScale(8),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.green1,
    borderRadius: 16,
    marginTop: moderateScale(8),
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  devName: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(18),
    marginTop: verticalScale(20),
    marginBottom: verticalScale(12),
  },
  navBtn: {
    width: NAV_BTN_SIZE,
    height: NAV_BTN_SIZE,
    borderRadius: NAV_BTN_SIZE / 2,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: ChickIntelPalette.green2,
  },
  navBtnPressed: {
    backgroundColor: ChickIntelPalette.green2,
    transform: [{ scale: 0.92 }],
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  activeDot: {
    width: 24,
    backgroundColor: ChickIntelPalette.green1,
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  inactiveDot: {
    width: 7,
    backgroundColor: "rgba(49, 118, 103, 0.28)",
  },
  contactSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(6),
    paddingHorizontal: moderateScale(16),
  },
  contactTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#2b2b2b",
    letterSpacing: 1.2,
    marginBottom: verticalScale(10),
    textAlign: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(14),
  },
  contactBtn: {
    width: CONTACT_BTN_SIZE,
    height: CONTACT_BTN_SIZE,
    borderRadius: CONTACT_BTN_SIZE / 2,
    backgroundColor: ChickIntelPalette.gray1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  contactBtnPressed: {
    backgroundColor: "#1f1f1f",
    transform: [{ scale: 0.92 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(30, 45, 40, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: scale(320),
    borderRadius: scale(20),
    padding: moderateScale(20),
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "rgba(49, 118, 103, 0.22)",
    shadowColor: ChickIntelPalette.green1,
    shadowOpacity: 0.2,
    shadowRadius: scale(18),
    shadowOffset: { width: 0, height: verticalScale(8) },
    elevation: 10,
    alignItems: "center",
  },
  modalIconBadge: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: ChickIntelPalette.gray1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    marginBottom: verticalScale(6),
  },
  modalPrompt: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13.5),
    lineHeight: responsiveFontSize(19),
    fontWeight: "500",
    color: "#555555",
    textAlign: "center",
    marginBottom: verticalScale(14),
  },
  modalHandlePill: {
    width: "100%",
    paddingVertical: verticalScale(8),
    paddingHorizontal: moderateScale(12),
    borderRadius: scale(12),
    backgroundColor: "rgba(202, 227, 221, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(18),
  },
  modalHandleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    letterSpacing: 0.3,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    minHeight: verticalScale(40),
    borderRadius: scale(12),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(14),
  },
  modalBtnSecondary: {
    backgroundColor: "#F0F2F2",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  modalBtnSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  modalBtnPrimary: {
    backgroundColor: ChickIntelPalette.green1,
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  modalBtnPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
