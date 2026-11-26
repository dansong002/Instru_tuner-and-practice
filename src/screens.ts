import { groovesScreen } from "./features/grooves";
import { logScreen } from "./features/log";
import { metronomeScreen } from "./features/metronome";
import { rudimentsScreen } from "./features/rudiments";
import { tunerScreen } from "./features/tuner";
import type { AppServices, Screen } from "./ui/app";

export interface ScreenFactory {
  id: string;
  label: string;
  icon: string;
  create(services: AppServices): Screen;
}

export const screens: ScreenFactory[] = [
  { id: "tuner", label: "Tuner", icon: "♪", create: () => tunerScreen() },
  { id: "metronome", label: "Metronome", icon: "◷", create: metronomeScreen },
  { id: "rudiments", label: "Rudiments", icon: "RL", create: rudimentsScreen },
  { id: "grooves", label: "Drum set", icon: "▦", create: groovesScreen },
  { id: "log", label: "Log", icon: "≡", create: logScreen },
];
