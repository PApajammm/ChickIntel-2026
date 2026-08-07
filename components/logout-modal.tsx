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
        backgroundColor: "rgba(51,51,51,0.38)",
        alignItems: "center",
        justifyContent: "center",
        padding: moderateScale(24),
    },
    card: {
        width: "100%",
        borderRadius: scale(16),
        padding: moderateScale(16),
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(49,118,103,0.18)",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: scale(16),
        shadowOffset: { width: 0, height: verticalScale(8) },
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
        color: ChickIntelPalette.gray2,
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
        backgroundColor: "#F0F2F2",
        borderWidth: 1,
        borderColor: "transparent",
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
        color: ChickIntelPalette.light1,
    },
});
