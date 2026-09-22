import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export type ChickenIconProps = {
  size?: number;
  color?: string;
  style?: any;
};

/**
 * Authentic chicken / rooster icon with comb, beak, wattle, body, wing and tail feathers.
 */
export function ChickenIcon({
  size = 16,
  color = "#317667",
  style,
}: ChickenIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {/* Comb on head */}
      <Path
        d="M13.2 2.2C12.4 2.2 11.8 2.8 11.8 3.5C11.8 3.7 11.9 3.9 12 4.1C11.4 4.3 10.9 4.9 10.9 5.6C10.9 5.8 11 6 11.1 6.2C10.3 6.6 9.8 7.4 9.8 8.3C9.8 9.5 10.8 10.5 12 10.5C12.3 10.5 12.6 10.4 12.8 10.3C13.2 11.3 14 12 15 12.2V13C15 13.6 14.6 14 14 14.5C12.8 13.6 11.2 13 9.5 13C6.2 13 3.5 15.5 3 18.7C4.1 17.6 5.5 17 7 17C7.8 17 8.5 17.2 9.2 17.5C8.8 18.2 8.5 19 8.5 20H6.5C6.2 20 6 20.2 6 20.5C6 20.8 6.2 21 6.5 21H9.8C10.5 21 11.1 20.6 11.4 20H13.6C13.9 20.6 14.5 21 15.2 21H17.5C17.8 21 18 20.8 18 20.5C18 20.2 17.8 20 17.5 20H15.5C15.5 19.2 15.2 18.5 14.8 17.8C17.2 17.1 19 14.9 19 12.2C19 11.8 18.9 11.4 18.8 11C19.4 10.6 19.8 9.9 19.8 9.2C19.8 8.2 19 7.4 18 7.4C17.8 7.4 17.6 7.4 17.4 7.5C17.2 6.3 16.2 5.3 15 5.3C14.7 5.3 14.4 5.4 14.2 5.5C13.9 4.3 13.2 3.4 12.2 2.8C12.5 2.4 12.8 2.2 13.2 2.2Z"
        fill={color}
      />
      {/* Beak */}
      <Path
        d="M19 7.8L22 9.2L19 10.4V7.8Z"
        fill={color}
      />
      {/* Wattle under beak */}
      <Path
        d="M17.8 11.5C17.8 12.6 17 13.5 16 13.5C15.2 13.5 14.6 12.9 14.6 12.2C14.6 11.8 14.8 11.5 15.1 11.2L17.8 11.5Z"
        fill={color}
      />
      {/* Eye */}
      <Circle
        cx={16.2}
        cy={7.8}
        r={0.9}
        fill="#FFFFFF"
      />
      {/* Tail feathers sweep */}
      <Path
        d="M3 13.5C3.8 11.2 5.5 9.5 8 9C6.8 10.2 6 11.8 6 13.5H3Z"
        fill={color}
      />
      <Path
        d="M4.5 10C5.8 7.8 8 6.5 10.8 6.5C9.2 7.8 8.2 9.8 8 12C6.5 11.8 5.3 11.1 4.5 10Z"
        fill={color}
      />
      {/* Wing detail */}
      <Path
        d="M10.5 14C11.8 14 13.2 14.6 14.2 15.5C13.2 16.5 11.8 17 10.5 17C9.5 17 8.6 16.7 7.8 16.2C8.4 14.9 9.3 14 10.5 14Z"
        fill="#FFFFFF"
        opacity={0.35}
      />
    </Svg>
  );
}
