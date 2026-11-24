// Meetings: the one shared session type for exchange collaborations. A
// mentorship schedules through its own room rules instead.
import { scheduleInstant } from "./selectors.js";

export const meetingDurations = [15, 30, 45, 60, 90, 120];
export const meetingNoteLimit = 500;

// Exchange rooms take meetings; mentorship rooms keep their own scheduling.
export const takesMeetings = (room) =>
  Boolean(room) && room.type !== "mentorship";

export const meetingInstant = (meeting) => scheduleInstant(meeting);

// Meetings that still stand, soonest first.
export function roomMeetings(room) {
  return (room?.meetings || [])
    .filter((meeting) => !meeting.cancelledAt)
    .sort((a, b) => meetingInstant(a) - meetingInstant(b));
}
