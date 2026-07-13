import { CheckCircle2, Heart, ThumbsUp, type LucideIcon } from "lucide-react-native";
import type { QuickReaction } from "./types";

export const QUICK_REACTIONS: Array<{
  payload: QuickReaction;
  label: string;
  icon: LucideIcon;
}> = [
  { payload: "LIKE", label: "Like", icon: ThumbsUp },
  { payload: "HEART", label: "Love", icon: Heart },
  { payload: "DONE", label: "Done", icon: CheckCircle2 },
];
