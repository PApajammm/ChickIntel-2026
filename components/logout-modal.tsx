import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

type LogoutModalProps = {
    visible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export function LogoutModal({
    visible,
    onCancel,
    onConfirm,
}: LogoutModalProps) {
    const { width } = useWindowDimensions();
    const maxW = Math.min(width - moderateScale(48), scale(340));

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={styles.backdrop} onPress={onCancel}>
                <Pressable
                    style={[styles.card, { maxWidth: maxW }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <Text style={styles.title}>Logout</Text>
                    <Text style={styles.message}>
                        Are you sure you want to logout?
                    </Text>
                    <View style={styles.row}>
                        <Pressable
                            onPress={onCancel}
                            style={({ pressed }) => [
                                styles.btn,
                                styles.btnSecondary,
                                { opacity: pressed ? 0.85 : 1 },
                            ]}
                        >
                            <Text style={styles.btnSecondaryText} numberOfLines={1}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={onConfirm}
                            style={({ pressed }) => [
                                styles.btn,
                                styles.btnPrimary,
                                { opacity: pressed ? 0.92 : 1 },
                            ]}
                        >
                            <Text style={styles.btnPrimaryText} numberOfLines={1}>Ok</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(31, 46, 43, 0.45)",
        alignItems: "center",
        justifyContent: "center",
        padding: moderateScale(24),
    },
    card: {
        width: "100%",
        borderRadius: scale(16),
        padding: moderateScale(18),
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
        shadowColor: "#161E1A",
        shadowOpacity: 0.12,
        shadowRadius: scale(16),
        shadowOffset: { width: 0, height: verticalScale(6) },
        elevation: 8,
    },
    title: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(18),
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
        textAlign: "center",
        marginBottom: verticalScale(8),
    },
    message: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        lineHeight: responsiveFontSize(20),
        fontWeight: "500",
        color: ChickIntelPalette.textMuted,
        textAlign: "center",
        marginBottom: verticalScale(16),
    },
    row: {
        flexDirection: "row",
        gap: moderateScale(12),
        justifyContent: "center",
    },
    btn: {
        flex: 1,
        minHeight: verticalScale(42),
        borderRadius: scale(10),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: moderateScale(16),
    },
    btnSecondary: {
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    btnSecondaryText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
        color: ChickIntelPalette.gray1,
    },
    btnPrimary: {
        backgroundColor: ChickIntelPalette.green1,
    },
    btnPrimaryText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
        color: "#FFFFFF",
    },
});
