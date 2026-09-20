import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateAccount } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  async function saveAccountChanges() {
    const trimmedName = displayName.trim();
    setSaving(true);
    try {
      await updateAccount(trimmedName, password || undefined);
      setPassword("");
      setConfirmPassword("");
      Alert.alert("Account updated", "Your farmer account details were saved.");
    } catch (error) {
      Alert.alert(
        "Unable to update account",
        error instanceof Error
          ? error.message
          : "Please try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Enter the farmer name for this account.");
      return;
    }

    if (password && password.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Re-enter the same password.");
      return;
    }

    if (password) {
      Alert.alert(
        "Change password?",
        "You will use the new password the next time you sign in.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Change password",
            onPress: () => void saveAccountChanges(),
          },
        ],
      );
      return;
    }

    void saveAccountChanges();
  }

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.08 }] }]}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={[styles.header, { paddingTop: verticalScale(8) }]}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>My Account</Text>
            <Text style={styles.headerSubtitle}>Farmer profile settings</Text>
          </View>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top + verticalScale(8)}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + verticalScale(28) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
          >
            <View style={styles.accountCard}>
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(displayName.trim() || "F").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.identityCopy}>
                  <Text style={styles.identityName} numberOfLines={1}>
                    {displayName.trim() || "Farmer account"}
                  </Text>
                  <Text style={styles.identityEmail} numberOfLines={1}>
                    {profile?.email || "Signed-in farmer"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="shield-account-outline"
                  size={23}
                  color={ChickIntelPalette.green1}
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="account-edit-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Profile details</Text>
                  <Text style={styles.sectionSubtitle}>
                    Update the name shown across your farm workspace.
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Farmer name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor={ChickIntelPalette.gray2}
                autoCapitalize="words"
                style={styles.input}
              />

              <View style={styles.divider} />

              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Change password</Text>
                  <Text style={styles.sectionSubtitle}>
                    Leave these fields blank to keep your current password.
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>New password</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={ChickIntelPalette.gray2}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  style={styles.passwordInput}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    passwordVisible ? "Hide password" : "Show password"
                  }
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                    size={21}
                    color={ChickIntelPalette.gray2}
                  />
                </Pressable>
              </View>
              <Text style={styles.label}>Confirm new password</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={ChickIntelPalette.gray2}
                  secureTextEntry={!confirmPasswordVisible}
                  autoCapitalize="none"
                  style={styles.passwordInput}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() =>
                    setConfirmPasswordVisible((visible) => !visible)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    confirmPasswordVisible
                      ? "Hide password confirmation"
                      : "Show password confirmation"
                  }
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={
                      confirmPasswordVisible ? "eye-off-outline" : "eye-outline"
                    }
                    size={21}
                    color={ChickIntelPalette.gray2}
                  />
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  saving && styles.saveButtonDisabled,
                  { opacity: pressed ? 0.86 : 1 },
                ]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons
                    name="content-save-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Save account changes"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(12),
    gap: 10,
  },
  headerButton: {
    width: scale(42),
    height: verticalScale(42),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
  },
  headerButtonPlaceholder: {
    width: scale(42),
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  headerSubtitle: {
    marginTop: 2,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.textMuted,
  },
  content: {
    paddingHorizontal: moderateScale(16),
    paddingTop: verticalScale(8),
    gap: 12,
  },
  accountCard: {
    gap: 8,
    padding: moderateScale(16),
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: scale(48),
    height: verticalScale(48),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: ChickIntelPalette.green1,
  },
  avatarText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(21),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  identityEmail: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#40524B",
  },
  cardDivider: {
    width: "100%",
    height: 1,
    marginVertical: 3,
    backgroundColor: "rgba(49, 118, 103, 0.14)",
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 3,
  },
  sectionIcon: {
    width: scale(32),
    height: verticalScale(32),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(49, 118, 103, 0.11)",
  },
  sectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  sectionSubtitle: {
    marginTop: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#40524B",
  },
  label: {
    marginTop: 4,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: "#30443C",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    minHeight: verticalScale(46),
    paddingHorizontal: moderateScale(12),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    backgroundColor: "rgba(248, 252, 250, 0.9)",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: ChickIntelPalette.gray1,
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: verticalScale(46),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    backgroundColor: "rgba(248, 252, 250, 0.9)",
  },
  passwordInput: {
    flex: 1,
    minHeight: verticalScale(44),
    paddingHorizontal: moderateScale(12),
    paddingVertical: 0,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: ChickIntelPalette.gray1,
  },
  eyeButton: {
    width: scale(42),
    height: verticalScale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    marginVertical: 8,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
  },
  saveButton: {
    minHeight: verticalScale(46),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 8,
    borderRadius: 11,
    backgroundColor: ChickIntelPalette.green1,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
