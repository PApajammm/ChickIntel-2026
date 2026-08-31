import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";

const UPDATE_MESSAGE =
  "A new version of ChickIntel is available with improvements and new features.";

export function OtaUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const hasChecked = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasChecked.current || !Updates.isEnabled) {
      return;
    }

    hasChecked.current = true;

    Updates.checkForUpdateAsync()
      .then((result) => {
        if (isMounted.current && result.isAvailable) {
          setUpdateAvailable(true);
        }
      })
      .catch(() => {
        // Update checks are optional and must never block app startup.
      });
  }, []);

  async function installUpdate() {
    setIsUpdating(true);

    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew && Updates.isEnabled) {
        await Updates.reloadAsync();
      } else if (isMounted.current) {
        setIsUpdating(false);
        setUpdateAvailable(false);
      }
    } catch {
      if (isMounted.current) {
        setIsUpdating(false);
        setUpdateAvailable(false);
      }
    }
  }

  return (
    <Modal
      visible={updateAvailable}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isUpdating) {
          setUpdateAvailable(false);
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>New Update Available</Text>
          <Text style={styles.message}>{UPDATE_MESSAGE}</Text>

          {isUpdating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={ChickIntelPalette.green1} />
              <Text style={styles.loadingText}>Downloading update...</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => setUpdateAvailable(false)}
                style={({ pressed }) => [
                  styles.button,
                  styles.laterButton,
                  { opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <Text style={styles.laterText}>Later</Text>
              </Pressable>
              <Pressable
                onPress={installUpdate}
                style={({ pressed }) => [
                  styles.button,
                  styles.updateButton,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Text style={styles.updateText}>Update Now</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(30, 45, 40, 0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontFamily: ChickFont.display,
    fontSize: 19,
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontFamily: ChickFont.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: ChickIntelPalette.gray2,
    textAlign: "center",
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  laterButton: {
    backgroundColor: "#F0F2F2",
  },
  updateButton: {
    backgroundColor: ChickIntelPalette.green1,
  },
  laterText: {
    fontFamily: ChickFont.sans,
    fontSize: 14,
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  updateText: {
    fontFamily: ChickFont.sans,
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loadingRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: ChickFont.sans,
    fontSize: 14,
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
  },
});
