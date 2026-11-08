import type { GroupSpec } from "../registry/types";
import { cliGroup } from "./cli";
import { helpGroup } from "./help";

export function createRootCommand(): GroupSpec {
  return {
    kind: "group",
    name: "",
    summary: "Use IA App from your terminal",
    children: [helpGroup, cliGroup],
  };
}
