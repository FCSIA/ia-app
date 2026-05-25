import { v } from "convex/values";
import {
  flexAttendanceStatusValidator,
  flexFridayTypeValidator,
  flexSessionTypeValidator,
  pathwayValidator,
} from "../validators";

export const flexFridayValidator = {
  date: v.number(),
  type: flexFridayTypeValidator,
  gradeLevel: v.optional(v.number()),
  pathway: v.optional(pathwayValidator),
  isSchoolDay: v.boolean(),
  notes: v.optional(v.string()),
};

export const flexSessionValidator = {
  flexFridayId: v.id("flexFridays"),
  title: v.string(),
  description: v.optional(v.string()),
  startTime: v.string(),
  endTime: v.string(),
  sessionType: flexSessionTypeValidator,
};

export const flexWorkshopValidator = {
  teacherId: v.optional(v.id("users")),
  title: v.string(),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  capacity: v.optional(v.number()),
  targetGrades: v.array(v.number()),
  targetMajorPathways: v.array(pathwayValidator),
  targetMinorPathways: v.array(pathwayValidator),
};

export const flexRegistrationValidator = {
  workshopId: v.id("flexWorkshops"),
  studentId: v.id("users"),
};

export const flexAssignmentValidator = {
  workshopId: v.id("flexWorkshops"),
  studentId: v.id("users"),
  assignedBy: v.id("users"),
};

export const flexAttendanceValidator = {
  workshopId: v.id("flexWorkshops"),
  studentId: v.id("users"),
  flexFridayId: v.id("flexFridays"),
  status: flexAttendanceStatusValidator,
  markedById: v.id("users"),
  markedAt: v.number(),
};
