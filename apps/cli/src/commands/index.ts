import type { GroupSpec } from "../registry/types";
import { accountCommands } from "./account";
import { announcementsGroup } from "./announcements";
import { auditGroup } from "./audit";
import { cliGroup } from "./cli";
import { eventsGroup } from "./events";
import { feedbackGroup } from "./feedback";
import { flexGroup } from "./flex";
import { helpGroup } from "./help";
import { moderationGroup } from "./moderation";
import { notificationsGroup } from "./notifications";
import { scheduleGroup, todayCommand } from "./schedule";
import { searchCommand } from "./search";
import { clubsGroup } from "./clubs";
import { sessionsGroup } from "./sessions";
import { usersGroup } from "./users";

export function createRootCommand(): GroupSpec {
  return {
    kind: "group",
    name: "",
    summary: "Use IA App from your terminal",
    children: [
      todayCommand,
      scheduleGroup,
      notificationsGroup,
      announcementsGroup,
      eventsGroup,
      flexGroup,
      clubsGroup,
      searchCommand,
      usersGroup,
      auditGroup,
      feedbackGroup,
      moderationGroup,
      sessionsGroup,
      helpGroup,
      cliGroup,
      ...accountCommands,
    ],
  };
}
