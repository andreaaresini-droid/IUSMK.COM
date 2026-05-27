import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { coursesTable } from "./courses";
import { accessCodesTable } from "./accessCodes";

export const studentCourseAccessTable = pgTable("student_course_access", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  accessCodeId: integer("access_code_id").notNull().references(() => accessCodesTable.id),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type StudentCourseAccess = typeof studentCourseAccessTable.$inferSelect;
