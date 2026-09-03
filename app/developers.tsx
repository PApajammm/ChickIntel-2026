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
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
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
const CARD_WIDTH = Math.round(Math.min(SCREEN_WIDTH * 0.46, 175));
const RADIUS_X = SCREEN_WIDTH * 0.31;
const RADIUS_Y = 12;
const DRAG_SENSITIVITY = 110;

const NAV_BTN_SIZE = 44;
const CONTACT_BTN_SIZE = Math.round(NAV_BTN_SIZE * 0.88);

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
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    translateXRange.push(RADIUS_X * sinTheta);
    translateYRange.push(RADIUS_Y * -cosTheta);

    const normalizedDepth = (cosTheta + 1) / 2;
    const baseScale = 0.68 + 0.38 * normalizedDepth;
    const unhoveredDimFactor = 0.9 + 0.1 * Math.pow(normalizedDepth, 3);
    scaleRange.push(baseScale * unhoveredDimFactor);
    opacityRange.push(0.2 + 0.8 * normalizedDepth);

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
  const [activeTab, setActiveTab] = useState<"about-app" | "about-us">("about-app");

  // Carousel & 3D state for "About Us" tab
  const animValue = useRef(new Animated.Value(0)).current;
  const currentStep = useRef(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedContact, setSelectedContact] = useState<ContactChannel | null>(null);

  // Slow, smooth upward entrance animation for "About App" tab
  const aboutAnim = useRef(new Animated.Value(0)).current;

  // Auto slow scroll up and down in About App
  const aboutScrollRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const containerHeightRef = useRef(0);
  const currentScrollYRef = useRef(0);
  const isUserInteractingRef = useRef(false);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationFrameRef.current) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
    if (autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  const smoothScrollYTo = useCallback(
    (targetY: number, duration = 4500, onComplete?: () => void) => {
      if (isUserInteractingRef.current) return;
      const maxScroll = Math.max(0, contentHeightRef.current - containerHeightRef.current);
      const clampedTarget = Math.max(0, Math.min(targetY, maxScroll));
      const startY = currentScrollYRef.current;
      const distance = clampedTarget - startY;
      if (Math.abs(distance) < 2) {
        onComplete?.();
        return;
      }

      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
      }

      const startTime = Date.now();
      const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

      const step = () => {
        if (isUserInteractingRef.current) return;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutSine(progress);
        const nextY = startY + distance * eased;
        currentScrollYRef.current = nextY;
        aboutScrollRef.current?.scrollTo({ y: nextY, animated: false });

        if (progress < 1) {
          scrollAnimationFrameRef.current = requestAnimationFrame(step);
        } else {
          scrollAnimationFrameRef.current = null;
          onComplete?.();
        }
      };

      scrollAnimationFrameRef.current = requestAnimationFrame(step);
    },
    []
  );

  // Starts the slow continuous scroll down and then up cycle
  const startSlowScrollCycle = useCallback(() => {
    stopAutoScroll();
    if (isUserInteractingRef.current || activeTab !== "about-app") return;

    const maxScroll = Math.max(0, contentHeightRef.current - containerHeightRef.current);
    if (maxScroll <= 30) return;

    // Wait a brief moment after entrance, then slowly scroll down (halved speed = 12s)
    autoScrollTimerRef.current = setTimeout(() => {
      if (isUserInteractingRef.current || activeTab !== "about-app") return;
      smoothScrollYTo(maxScroll, 12000, () => {
        // Pauses at the bottom, then slowly scrolls back up (halved speed = 10s)
        autoScrollTimerRef.current = setTimeout(() => {
          if (isUserInteractingRef.current || activeTab !== "about-app") return;
          smoothScrollYTo(0, 10000, () => {
            // Pauses at top and loops
            autoScrollTimerRef.current = setTimeout(() => {
              startSlowScrollCycle();
            }, 3000);
          });
        }, 2200);
      });
    }, 1800);
  }, [activeTab, smoothScrollYTo, stopAutoScroll]);

  useEffect(() => {
    if (activeTab === "about-app") {
      isUserInteractingRef.current = false;
      currentScrollYRef.current = 0;
      aboutScrollRef.current?.scrollTo({ y: 0, animated: false });

      aboutAnim.setValue(0);
      Animated.timing(aboutAnim, {
        toValue: 1,
        duration: 950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        startSlowScrollCycle();
      });
    } else {
      stopAutoScroll();
    }

    return () => {
      stopAutoScroll();
    };
  }, [activeTab, aboutAnim, startSlowScrollCycle, stopAutoScroll]);

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
    [animValue]
  );

  useEffect(() => {
    if (activeTab !== "about-us") {
      stopAutoPlay();
      return;
    }

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
  }, [activeTab, stopAutoPlay, rotateToStep]);

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
          styles.mainContainer,
          {
            paddingTop: insets.top + verticalScale(8),
            paddingBottom: insets.bottom + verticalScale(6),
          },
        ]}
      >
        {/* Fixed Top Header */}
        <View style={styles.fixedHeader}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
            </Pressable>
            <Text style={styles.headerTitle}>
              {activeTab === "about-app" ? "About ChickIntel" : "The Developers"}
            </Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          {/* Sticky Tab Segments (Styled from Batch Profile page) */}
          <View style={styles.segmentStickyHeader}>
            <View style={styles.segmentWrap}>
              <Pressable
                onPress={() => setActiveTab("about-app")}
                style={[
                  styles.segment,
                  activeTab === "about-app" ? styles.segmentActive : styles.segmentInactive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === "about-app"
                      ? styles.segmentTextActive
                      : styles.segmentTextInactive,
                  ]}
                >
                  About App
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab("about-us")}
                style={[
                  styles.segment,
                  activeTab === "about-us" ? styles.segmentActive : styles.segmentInactive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === "about-us"
                      ? styles.segmentTextActive
                      : styles.segmentTextInactive,
                  ]}
                >
                  About Us
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tab 1: About App */}
        {activeTab === "about-app" ? (
          <Animated.View
            style={[
              styles.aboutAppContainer,
              {
                opacity: aboutAnim,
                transform: [
                  {
                    translateY: aboutAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [36, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScrollView
              ref={aboutScrollRef}
              contentContainerStyle={styles.aboutAppScrollContent}
              showsVerticalScrollIndicator={false}
              onLayout={(e) => {
                containerHeightRef.current = e.nativeEvent.layout.height;
              }}
              onContentSizeChange={(_, h) => {
                contentHeightRef.current = h;
              }}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                currentScrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                isUserInteractingRef.current = true;
                stopAutoScroll();
              }}
              onTouchStart={() => {
                isUserInteractingRef.current = true;
                stopAutoScroll();
              }}
            >
              {/* App Identity Banner */}
              <View style={styles.appBannerCard}>
                <View style={styles.appIconWrapper}>
                  <Image
                    source={require("@/assets/images/icon.png")}
                    style={styles.appLogoImage}
                    contentFit="cover"
                  />
                </View>

                {/* "ChickIntel App 2026" & "Version 1.0.9" */}
                <Text style={styles.appTitle}>ChickIntel App 2026</Text>
                <View style={styles.versionBadge}>
                  <Text style={styles.appVersion}>Version 1.0.9</Text>
                </View>

                {/* Darkened font color for clarity */}
                <Text style={styles.appTagline}>
                  Smart Poultry Management, Health & Diagnostics Screening
                </Text>
              </View>

              {/* Mission & Overview */}
              <View style={styles.infoCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="information" size={18} color={ChickIntelPalette.green1} />
                  </View>
                  <Text style={styles.infoCardTitle}>Overview & Purpose</Text>
                </View>
                <Text style={styles.infoCardBody}>
                  ChickIntel is an integrated smart poultry management platform tailored for backyard raisers, commercial farm technicians, and poultry farm managers. It streamlines daily operations by unifying batch profiles, inventory tracking, routine task schedules, egg production metrics, and AI-assisted health screening.
                </Text>
              </View>

              {/* Key Capabilities & Features */}
              <View style={styles.infoCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="star-shooting" size={18} color={ChickIntelPalette.green1} />
                  </View>
                  <Text style={styles.infoCardTitle}>Key Capabilities</Text>
                </View>

                <View style={styles.featureList}>
                  {/* Capability 1: Health & Behavior Diagnostics */}
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet}>
                      <MaterialCommunityIcons name="stethoscope" size={16} color={ChickIntelPalette.green1} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>AI Health & Behavior Diagnostics</Text>
                      <Text style={styles.featureDesc}>
                        Visual symptom scanning combined with behavioral observations to screen poultry condition status, assess severity levels, and generate biosecurity guidance.
                      </Text>
                    </View>
                  </View>

                  {/* Capability 2: Fertility Rate Analysis */}
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet}>
                      <MaterialCommunityIcons name="egg-outline" size={16} color={ChickIntelPalette.green1} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>Egg Batch & Fertility Rate Analysis</Text>
                      <Text style={styles.featureDesc}>
                        Batch-level monitoring of egg collection, fertile vs. infertile distribution, unhatched/damaged records, and computed fertility percentages for incubator efficiency.
                      </Text>
                    </View>
                  </View>

                  {/* Capability 3: Inventory & Smart Scheduling */}
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet}>
                      <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={ChickIntelPalette.green1} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>
                        Poultry Inventory & Task Scheduling Smart Management
                      </Text>
                      <Text style={styles.featureDesc}>
                        Real-time tracking of feed stocks, biologics, medicines, and equipment supplies alongside customizable repeat schedules for feeding, watering, and flock vaccinations.
                      </Text>
                    </View>
                  </View>

                  {/* Capability 4: Production Insights */}
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet}>
                      <MaterialCommunityIcons name="chart-areaspline" size={16} color={ChickIntelPalette.green1} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>Poultry Production Insights & Reports</Text>
                      <Text style={styles.featureDesc}>
                        Automated summaries of flock mortality rates, egg production trends, feed utilization, and exportable PDF audit reports for farm decision-making.
                      </Text>
                    </View>
                  </View>

                  {/* Capability 5: Breed Identification */}
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet}>
                      <MaterialCommunityIcons name="tag-outline" size={16} color={ChickIntelPalette.green1} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>Chicken Breed Identification</Text>
                      <Text style={styles.featureDesc}>
                        Visual morphological identification and attribute profiling for supported pure chicken breeds: Silkie and Rhode Island Red.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Solid Warning Card: AI Health & Breed Detection Limitations (No Glassmorphism) */}
              <View style={styles.solidLimitationCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.warningIconCircle}>
                    <MaterialCommunityIcons name="alert-decagram" size={18} color="#B45309" />
                  </View>
                  <Text style={styles.limitationHeaderTitle}>
                    AI Health, Behavior & Breed Detection Limitations
                  </Text>
                </View>

                <View style={styles.limitationsList}>
                  {/* Condition Scope */}
                  <View style={styles.limitationItem}>
                    <View style={styles.limitationBullet}>
                      <MaterialCommunityIcons name="virus-outline" size={16} color="#B45309" />
                    </View>
                    <View style={styles.limitationTextWrap}>
                      <Text style={styles.limitationTitleText}>Limited Illness Detection Scope:</Text>
                      <Text style={styles.limitationDesc}>
                        The AI model is specifically trained to detect and screen for{" "}
                        <Text style={styles.boldInlineText}>Healthy</Text>,{" "}
                        <Text style={styles.boldInlineText}>Infectious Coryza</Text>, and{" "}
                        <Text style={styles.boldInlineText}>Fowlpox (Dry/Wet)</Text>. It does NOT detect general avian influenza, internal parasites, systemic bacterial septicemia, or nutritional deficiencies.
                      </Text>
                    </View>
                  </View>

                  {/* Breed Scope: Silkie, Rhode Island Red only */}
                  <View style={styles.limitationItem}>
                    <View style={styles.limitationBullet}>
                      <MaterialCommunityIcons name="feather" size={16} color="#B45309" />
                    </View>
                    <View style={styles.limitationTextWrap}>
                      <Text style={styles.limitationTitleText}>Supported Breeds: Silkie, Rhode Island Red only</Text>
                      <Text style={styles.limitationDesc}>
                        Breed recognition is currently trained and optimized strictly for Silkie and Rhode Island Red. Other breeds, native mixed crosses, or juvenile chicks cannot be reliably identified.
                      </Text>
                    </View>
                  </View>

                  {/* Advisory Disclaimer */}
                  <View style={styles.limitationItem}>
                    <View style={styles.limitationBullet}>
                      <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#B45309" />
                    </View>
                    <View style={styles.limitationTextWrap}>
                      <Text style={styles.limitationTitleText}>Advisory Screening Only:</Text>
                      <Text style={styles.limitationDesc}>
                        Outputs provide early decision-support and must never replace diagnostic verification, laboratory bacterial/viral culture, or treatment prescription by a licensed veterinarian.
                      </Text>
                    </View>
                  </View>

                  {/* Capture Requirements */}
                  <View style={styles.limitationItem}>
                    <View style={styles.limitationBullet}>
                      <MaterialCommunityIcons name="camera-iris" size={16} color="#B45309" />
                    </View>
                    <View style={styles.limitationTextWrap}>
                      <Text style={styles.limitationTitleText}>Image Quality Requirement:</Text>
                      <Text style={styles.limitationDesc}>
                        Accurate inference depends on clear natural lighting, focused close-up shots of facial features (comb, eyes, wattle), and unobstructed plumage.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Footer Attribution with Semi-Bold Maroon BPSU Text */}
              <View style={styles.aboutFooter}>
                <Text style={styles.footerBpsuText}>
                  Developed for BPSU BSCS CS4A Capstone Project 2026
                </Text>
                <Text style={styles.footerSubText}>
                  ChickIntel · Smart Poultry Management & Diagnostics
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        ) : (
          /* Tab 2: About Us (Original Developer Carousel & Logic Preserved) */
          <View style={styles.aboutUsContent}>
            {/* 360-Degree Rotational 3D Carousel */}
            <View style={styles.carouselWrapper} {...panResponder.panHandlers}>
              {/* Section Title */}
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
                            intensity={
                              isFront
                                ? Platform.OS === "ios"
                                  ? 45
                                  : 32
                                : Platform.OS === "ios"
                                ? 28
                                : 18
                            }
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

                        {/* Framed Avatar Image - Anchored to TOP */}
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

              {/* Pagination Indicators */}
              <View style={styles.paginationRow}>
                <View style={styles.dotsContainer}>
                  {DEVELOPERS.map((_, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        stopAutoPlay();
                        const currentMod =
                          ((currentStep.current % NUM_ITEMS) + NUM_ITEMS) % NUM_ITEMS;
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
                          activeCardIndex === idx
                            ? styles.activeDot
                            : styles.inactiveDot,
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Contact Details Channels */}
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
        )}
      </View>

      {/* Contact Channel Confirmation Modal */}
      <Modal
        visible={selectedContact !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedContact(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedContact(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
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

            <View style={styles.modalHandlePill}>
              <Text style={styles.modalHandleText} numberOfLines={1}>
                {selectedContact?.handle}
              </Text>
            </View>

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
  mainContainer: {
    flex: 1,
  },
  fixedHeader: {
    width: "100%",
    backgroundColor: "transparent",
    zIndex: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    minHeight: verticalScale(44),
    marginBottom: verticalScale(6),
  },
  backBtn: {
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
  },
  backBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  headerTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.3,
  },
  headerRightPlaceholder: {
    width: scale(42),
  },

  // Segment Tabs (from Batch Profile page)
  segmentStickyHeader: {
    backgroundColor: "transparent",
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(4),
    marginBottom: verticalScale(6),
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 10,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.12)",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(38),
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
  },
  segmentActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  segmentInactive: {
    backgroundColor: "transparent",
  },
  segmentText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    lineHeight: 18,
    color: "#4A5452",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  segmentTextInactive: {
    color: "#4A5452",
  },

  // About App Tab Styles
  aboutAppContainer: {
    flex: 1,
  },
  aboutAppScrollContent: {
    paddingHorizontal: moderateScale(16),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(32),
    gap: verticalScale(14),
  },
  appBannerCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 18,
    paddingVertical: verticalScale(18),
    paddingHorizontal: moderateScale(16),
    borderWidth: 1.5,
    borderColor: "rgba(49, 118, 103, 0.5)",
  },
  appIconWrapper: {
    width: scale(68),
    height: scale(68),
    borderRadius: scale(18),
    overflow: "hidden",
    marginBottom: verticalScale(10),
    borderWidth: 1.5,
    borderColor: "rgba(49, 118, 103, 0.35)",
    backgroundColor: "#FFFFFF",
  },
  appLogoImage: {
    width: "100%",
    height: "100%",
  },
  appTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.3,
    marginBottom: verticalScale(4),
    textAlign: "center",
  },
  versionBadge: {
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.28)",
    marginBottom: verticalScale(8),
  },
  appVersion: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    letterSpacing: 0.3,
  },
  appTagline: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12.8),
    lineHeight: responsiveFontSize(18),
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    maxWidth: scale(310),
  },
  infoCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: moderateScale(16),
    borderWidth: 1.5,
    borderColor: "rgba(49, 118, 103, 0.5)",
    gap: verticalScale(10),
  },

  // Limitation Card (Transparent Background)
  solidLimitationCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: moderateScale(16),
    borderWidth: 1.5,
    borderColor: "rgba(217, 119, 6, 0.38)",
    gap: verticalScale(12),
  },
  limitationHeaderTitle: {
    flex: 1,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14.5),
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: -0.2,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },
  iconCircle: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  warningIconCircle: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.2,
  },
  infoCardBody: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: responsiveFontSize(19),
    color: "#475569",
  },
  featureList: {
    gap: verticalScale(12),
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: moderateScale(10),
  },
  featureBullet: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
    backgroundColor: "rgba(49, 118, 103, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureTextWrap: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  featureDesc: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(17),
    color: "#525252",
  },
  limitationsList: {
    gap: verticalScale(12),
  },
  limitationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: moderateScale(10),
  },
  limitationBullet: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  limitationTextWrap: {
    flex: 1,
    gap: 3,
  },
  limitationTitleText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "800",
    color: "#78350F",
    letterSpacing: -0.2,
    lineHeight: responsiveFontSize(18),
  },
  limitationDesc: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(17.5),
    color: "#78350F",
    textAlign: "left",
  },
  boldInlineText: {
    fontFamily: ChickFont.sans,
    fontWeight: "700",
    color: "#78350F",
  },
  aboutFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(14),
    gap: 4,
  },
  footerBpsuText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12.5),
    fontWeight: "600",
    color: "#800000",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  footerSubText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    color: "rgba(51, 51, 51, 0.6)",
    textAlign: "center",
  },

  // About Us Tab Styles
  aboutUsContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: 0.8,
    marginTop: 0,
    paddingBottom: 6,
    marginBottom: verticalScale(12),
  },
  carouselWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselStage: {
    width: SCREEN_WIDTH,
    height: verticalScale(266),
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardContainer: {
    position: "absolute",
    width: CARD_WIDTH,
    height: verticalScale(260),
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
    marginTop: verticalScale(14),
    marginBottom: verticalScale(8),
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
    marginTop: verticalScale(4),
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(28),
  },
  contactTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#2b2b2b",
    letterSpacing: 1.2,
    marginBottom: verticalScale(8),
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
