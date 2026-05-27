import { pgTable, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { coursesTable } from "./courses";

export const videoDisclaimerAcksTable = pgTable(
  "video_disclaimer_acks",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
    courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
    acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.studentId, t.courseId)]
);

export type VideoDisclaimerAck = typeof videoDisclaimerAcksTable.$inferSelect;
