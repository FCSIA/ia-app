import { schema } from "../schema";

export const clubValidator = schema.doc("clubs").omit("_creationTime");

export const memberValidator = schema.doc("clubMembers").omit("_creationTime");

export const channelValidator = schema.doc("clubChannels");
