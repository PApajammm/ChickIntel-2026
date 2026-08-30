import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.round(Math.min(SCREEN_WIDTH * 0.46, 175)); // Decreased by 30% from 250
const RADIUS_X = SCREEN_WIDTH * 0.31;
const RADIUS_Y = 12;
const DRAG_SENSITIVITY = 110;

const NAV_BTN_SIZE = 44;
const CONTACT_BTN_SIZE = Math.round(NAV_BTN_SIZE * 0.88); // Decreased by 30% from original 55px

const DEVELOPERS = [
  {
    id: "1",
    name: "CANLAS, HANNA JEAN",
    role: "Document/Analyst",
    avatar: require("@/assets/images/team/CANLAS.png"),
  },
  {
    id: "2",
    name: "ESGUERRA, ANGEL ROSE",
    role: "Document/Tester",
    avatar: require("@/assets/images/team/ESGUERRA.png"),
  },
  {
    id: "3",
    name: "MADERA, JO ANN",
    role: "FrontEnd Dev/UXUI",
    avatar: require("@/assets/images/team/MADERA.png"),
  },
  {
    id: "4",
    name: "REYES, RALPH ZAIMON JAE",
    role: "BackEnd Dev",
    avatar: require("@/assets/images/team/REYES.png"),
  },
];

const getRoleIcon = (role: string) => {
  if (role.includes("FrontEnd")) return "laptop";
  if (role.includes("BackEnd")) return "server-network";
  return "file-document-outline";
};

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
    const baseScale = 0.68 + 0.38 * normalizedDepth;
    // Reduce dimension of unhovered avatar cards by 10%, smoothly easing to 1.0 at front
    const unhoveredDimFactor = 0.90 + 0.10 * Math.pow(normalizedDepth, 3);
    scaleRange.push(baseScale * unhoveredDimFactor);
    opacityRange.push(0.20 + 0.80 * normalizedDepth);

    // Front card has 0 dark overlay; non-centered / background cards ramp up to 0.96 darkness (10% darker)
    const darkAmount = Math.max(0, 1 - Math.pow(normalizedDepth, 2)) * 0.96;
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

  // Auto-hover / auto-swipe state: 5 loops of 4 cards = 20 steps
  const autoStepCount = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoPlay = useCallback(() => {
    if (initialTimerRef.current) {
      clearTimeout(initialTimerRef.current);
      initialTimerRef.current = null;
    }
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const rotateToStep = useCallback(
    (targetStep: number, isAuto = false) => {
      currentStep.current = targetStep;
      if (isAuto) {
        // Fast, fluid cinematic deceleration for auto-carousel
        Animated.timing(animValue, {
          toValue: targetStep,
          duration: 600,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(animValue, {
          toValue: targetStep,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }).start();
      }
    },
    [animValue],
  );

  // Automatic swiping: faster initial trigger (~900ms), brisk interval (~1.8s), max 5 full loops (20 steps)
  useEffect(() => {
    const MAX_AUTO_STEPS = NUM_ITEMS * 5;
    const INITIAL_DELAY_MS = 900;
    const AUTO_INTERVAL_MS = 1800;

    initialTimerRef.current = setTimeout(() => {
      if (autoStepCount.current >= MAX_AUTO_STEPS) return;
      autoStepCount.current += 1;
      rotateToStep(currentStep.current + 1, true);

      autoTimerRef.current = setInterval(() => {
        if (autoStepCount.current >= MAX_AUTO_STEPS) {
          stopAutoPlay();
          return;
        }
        autoStepCount.current += 1;
        rotateToStep(currentStep.current + 1, true);
      }, AUTO_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      stopAutoPlay();
    };
  }, [stopAutoPlay, rotateToStep]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 5,
      onPanResponderGrant: () => {
        stopAutoPlay();
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
            <Text style={styles.appVersion}>Version 1.0.8</Text>
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
                  {/* Modern Glassmorphic Card */}
                  <View style={[styles.cardBox, isFront && styles.activeCardBox]}>
                    {/* Glassmorphism Frosted Blur Backdrop */}
                    <View style={styles.blurBackdropWrap} pointerEvents="none">
                      <BlurView
                        intensity={isFront ? (Platform.OS === "ios" ? 45 : 32) : (Platform.OS === "ios" ? 28 : 18)}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                      />
                    </View>

                    {/* Top Header: Position Title Badge */}
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.roleChip,
                          isFront && styles.roleChipActive,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={getRoleIcon(dev.role) as any}
                          size={10}
                          color={isFront ? "#6EE7B7" : "#A7F3D0"}
                        />
                        <Text
                          style={[
                            styles.roleText,
                            isFront && styles.roleTextActive,
                          ]}
                        >
                          {dev.role}
                        </Text>
                      </View>
                    </View>

                    {/* Framed Avatar Image - Anchored to TOP so hair/head is never cut */}
                    <View
                      style={[
                        styles.imageWrapper,
                        isFront && styles.imageWrapperActive,
                      ]}
                    >
                      <Image
                        source={dev.avatar}
                        style={styles.avatarImage}
                        contentFit="cover"
                        contentPosition="top"
                        blurRadius={
                          isFront ? 0 : Platform.OS === "ios" ? 14 : 10
                        }
                      />
                      <View style={styles.imageInnerGlow} />

                      {/* Extra Frosted Blur Overlay for Inactive Background Avatars */}
                      {!isFront && (
                        <BlurView
                          intensity={Platform.OS === "ios" ? 24 : 16}
                          tint="dark"
                          style={StyleSheet.absoluteFill}
                          pointerEvents="none"
                        />
                      )}
                    </View>

                    {/* Developer Name Plate */}
                    <View
                      style={[
                        styles.namePlate,
                        isFront && styles.activeNamePlate,
                      ]}
                    >
                      <Text
                        style={styles.devName}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
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

          {/* Pagination Indicators (Swipable Carousel) */}
          <View style={styles.paginationRow}>
            <View style={styles.dotsContainer}>
              {DEVELOPERS.map((_, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    stopAutoPlay();
                    const currentMod = ((currentStep.current % NUM_ITEMS) + NUM_ITEMS) % NUM_ITEMS;
                    let diff = idx - currentMod;
                    if (diff > NUM_ITEMS / 2) diff -= NUM_ITEMS;
                    if (diff < -NUM_ITEMS / 2) diff += NUM_ITEMS;
                    rotateToStep(currentStep.current + diff);
                  }}
                  hitSlop={8}
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
    fontSize: responsiveFontSize(20.4),
    fontWeight: "700",
    color: "#2b2b2b",
    marginBottom: 2,
  },
  appVersion: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14.4),
    fontWeight: "600",
    color: "#4a4a4a",
  },
  sectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: 0.8,
    marginTop: 0,
    paddingBottom: 10,
    marginBottom: verticalScale(22),
  },
  carouselWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselStage: {
    width: SCREEN_WIDTH,
    height: verticalScale(266), // Increased by 20% from 222
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardContainer: {
    position: "absolute",
    width: CARD_WIDTH,
    height: verticalScale(260), // Increased by 20% from 216
    alignItems: "center",
    justifyContent: "center",
  },
  blurBackdropWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: "hidden",
  },
  cardBox: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(16, 24, 21, 0.65)",
    borderRadius: 18,
    padding: moderateScale(8),
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeCardBox: {
    borderColor: "rgba(110, 231, 183, 0.6)",
    borderWidth: 1.8,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 12,
    backgroundColor: "rgba(10, 18, 15, 0.8)",
  },
  cardDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1, 4, 3, 0.94)",
    borderRadius: 18,
  },
  cardHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: moderateScale(2),
    paddingBottom: 5,
    zIndex: 4,
  },
  imageWrapper: {
    width: "100%",
    flex: 1,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    position: "relative",
  },
  imageWrapperActive: {
    borderColor: "rgba(110, 231, 183, 0.22)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  imageInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  namePlate: {
    width: "100%",
    paddingVertical: moderateScale(6),
    paddingHorizontal: moderateScale(6),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18, 30, 26, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    borderRadius: 12,
    marginTop: moderateScale(6),
    zIndex: 4,
  },
  activeNamePlate: {
    backgroundColor: "rgba(20, 38, 32, 0.92)",
    borderColor: "rgba(110, 231, 183, 0.35)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  devName: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(1.5),
    borderRadius: 6,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignSelf: "flex-start",
  },
  roleChipActive: {
    backgroundColor: "transparent",
    borderColor: "rgba(110, 231, 183, 0.25)",
  },
  roleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(8.5),
    fontWeight: "700",
    color: "#A7F3D0",
    letterSpacing: 0.2,
  },
  roleTextActive: {
    color: "#6EE7B7",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(18),
    marginBottom: verticalScale(12),
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
    backgroundColor: ChickIntelPalette.gray1,
    shadowColor: ChickIntelPalette.gray1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  inactiveDot: {
    width: 7,
    backgroundColor: "rgba(51, 51, 51, 0.28)",
  },
  contactSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(6),
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(65),
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
