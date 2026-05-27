import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import accessRouter from "./access.js";
import coursesRouter from "./courses.js";
import academyRouter from "./academy.js";
import galleryRouter from "./gallery.js";
import testimonialsRouter from "./testimonials.js";
import contactRouter from "./contact.js";
import adminRouter from "./admin.js";
import uploadRouter from "./upload.js";
import studentRouter from "./student.js";
import videoRouter from "./video.js";
import stripeRouter from "./stripe.js";
import customerRouter from "./customer.js";
import aiRouter from "./ai.js";
import adminAiRouter from "./admin-ai.js";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/access", accessRouter);
router.use("/student", studentRouter);
router.use("/customer", customerRouter);
router.use("/courses", coursesRouter);
router.use("/academy-categories", academyRouter);
router.use("/gallery", galleryRouter);
router.use("/testimonials", testimonialsRouter);
router.use("/contact", contactRouter);
router.use("/admin", adminRouter);
router.use("/upload", uploadRouter);
router.use("/video", videoRouter);
router.use("/stripe", stripeRouter);
router.use("/ai", aiRouter);
router.use("/admin/ai", adminAiRouter);

export default router;
