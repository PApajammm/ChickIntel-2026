import React, { useRef, useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { moderateScale, responsiveFontSize, verticalScale } from "@/utils/responsive";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.64, 250);
const RADIUS_X = SCREEN_WIDTH * 0.33;
const RADIUS_Y = 14;
const DRAG_SENSITIVITY = 130;

const DEVELOPERS = [
  { id: "1", name: "CANLAS, HANNA JEAN", avatar: require("@/assets_imported/dev_avatar/CANLAS.jpg") },
  { id: "2", name: "ESGUERRA, ANGEL ROSE", avatar: require("@/assets_imported/dev_avatar/ESGUERRA.jpg") },
  { id: "3", name: "MADERA, JO ANN", avatar: require("@/assets_imported/dev_avatar/MADERA.jpg") },
  { id: "4", name: "REYES, RALPH ZAIMON JAE", avatar: require("@/assets_imported/dev_avatar/REYES.jpg") },
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
  const insets = useSafeAreaInsets();
  const animValue = useRef(new Animated.Value(0)).current;
  const currentStep = useRef(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

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

      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        {/* Header Titles */}
        <View style={styles.titleContainer}>
          <Text style={styles.appTitle}>ChickIntel App 2026</Text>
          <Text style={styles.appVersion}>Version 1.4.6</Text>
        </View>

        {/* 360-Degree Rotational 3D Carousel */}
        <View style={styles.carouselWrapper} {...panResponder.panHandlers}>
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
                      elevation: isFront ? 12 : 3,
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

                    {/* Framed Avatar Image */}
                    <View style={styles.imageWrapper}>
                      <Image source={dev.avatar} style={styles.avatarImage} />
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
        </View>

        {/* Carousel Rotation Controls & Indicators */}
        <View style={styles.controlsRow}>
          <Pressable
            onPress={handlePrev}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={ChickIntelPalette.green1} />
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
            <MaterialCommunityIcons name="chevron-right" size={28} color={ChickIntelPalette.green1} />
          </Pressable>
        </View>
      </View>
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
  titleContainer: {
    alignItems: "center",
    marginTop: verticalScale(4),
    marginBottom: verticalScale(10),
  },
  appTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "700",
    color: "#2b2b2b",
    marginBottom: 3,
  },
  appVersion: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: "#4a4a4a",
  },
  sectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(24),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: 1,
    marginBottom: verticalScale(20),
    marginTop: 0,
  },
  carouselWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselStage: {
    width: SCREEN_WIDTH,
    height: verticalScale(335),
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardContainer: {
    position: "absolute",
    width: CARD_WIDTH,
    height: verticalScale(300),
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
    paddingBottom: moderateScale(6),
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
    resizeMode: "cover",
  },
  imageInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  nameCapsule: {
    width: "100%",
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(8),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.green1,
    borderRadius: 16,
    marginTop: moderateScale(10),
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  devName: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(22),
    marginTop: verticalScale(6),
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ChickIntelPalette.green1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: "rgba(156, 213, 201, 0.7)",
  },
  navBtnPressed: {
    backgroundColor: ChickIntelPalette.lightGreen,
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
});
