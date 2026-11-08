import type { GroupSpec } from "../registry/types";
import { accountCommands } from "./account";
import { cliGroup } from "./cli";
import { sessionsGroup } from "./sessions";
import { helpGroup } from "./help";

export function createRootCommand(): GroupSpec {
  return {
    kind: "group",
    name: "",
    summary: "Use IA App from your terminal",
    children: [...accountCommands, sessionsGroup, helpGroup, cliGroup],
  };
}
