import { StyleSheet, Text, type TextProps } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: ChickFont.sans,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "400",
  },
  defaultSemiBold: {
    fontFamily: ChickFont.sans,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "600",
  },
  title: {
    fontFamily: ChickFont.display,
    fontSize: 36,
    fontWeight: "600",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: ChickFont.display,
    fontSize: 23,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  link: {
    fontFamily: ChickFont.sans,
    lineHeight: 32,
    fontSize: 19,
    fontWeight: "500",
    color: "#0a7ea4",
  },
});
