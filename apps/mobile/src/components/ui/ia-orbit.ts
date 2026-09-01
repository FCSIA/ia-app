import type { ImageSourcePropType } from "react-native";
import type { ThemeName } from "@ia/design-tokens";

const defaultOrbit = require("../../../assets/ia-orbit-default.png");
const darkOrbit = require("../../../assets/ia-orbit-dark.png");

/** The authored IA Orbit appearance matched to the current in-app theme. */
export function iaOrbitForTheme(theme: ThemeName): ImageSourcePropType {
  return theme === "dark" || theme === "high-contrast" || theme === "bubblegum-dark" || theme === "custom"
    ? darkOrbit
    : defaultOrbit;
}
