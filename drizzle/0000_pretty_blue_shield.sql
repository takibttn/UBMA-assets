CREATE TYPE "public"."account_type" AS ENUM('INTERNAL_STUDENT', 'EXTERNAL_LEARNER');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('PENDING_PAYMENT', 'ENROLLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."formation_teacher_role" AS ENUM('MAIN_TEACHER', 'ASSISTANT');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'APPRENANT');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('SCHEDULED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"certificate_number" varchar(50) NOT NULL,
	"verification_code" varchar(64) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"pdf_url" varchar(500),
	CONSTRAINT "certificates_enrollment_id_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number"),
	CONSTRAINT "certificates_verification_code_unique" UNIQUE("verification_code")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"formation_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'ENROLLED' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_student_formation_unique" UNIQUE("student_id","formation_id")
);
--> statement-breakpoint
CREATE TABLE "formation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "formation_feedback_formation_student_unique" UNIQUE("formation_id","student_id"),
	CONSTRAINT "formation_feedback_rating_check" CHECK (rating >= 0 AND rating <= 5)
);
--> statement-breakpoint
CREATE TABLE "formation_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "formation_levels_language_code_unique" UNIQUE("language_id","code")
);
--> statement-breakpoint
CREATE TABLE "formation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formation_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" "session_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formation_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formation_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"role" "formation_teacher_role" DEFAULT 'MAIN_TEACHER' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "formation_teachers_formation_teacher_unique" UNIQUE("formation_id","teacher_id")
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"language_id" uuid,
	"level_id" uuid,
	"creator_id" uuid,
	"price" numeric(10, 2) DEFAULT '0',
	"capacity" integer,
	"is_sale_open" boolean DEFAULT false NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"formation_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_checkout_id" varchar(255),
	"provider_payment_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'DZD' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"checkout_url" text,
	"failure_reason" text,
	"metadata" jsonb,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"capacity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"marked_at" timestamp,
	"marked_by_teacher_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_attendance_session_enrollment_unique" UNIQUE("session_id","enrollment_id")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"bac_year" integer,
	"matricule" varchar(50),
	"password" varchar(255) NOT NULL,
	"dob" date,
	"role" "role" DEFAULT 'APPRENANT' NOT NULL,
	"account_type" "account_type" DEFAULT 'INTERNAL_STUDENT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_bac_year_matricule_unique" UNIQUE("bac_year","matricule"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_feedback" ADD CONSTRAINT "formation_feedback_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_feedback" ADD CONSTRAINT "formation_feedback_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_feedback" ADD CONSTRAINT "formation_feedback_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_levels" ADD CONSTRAINT "formation_levels_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_sessions" ADD CONSTRAINT "formation_sessions_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_sessions" ADD CONSTRAINT "formation_sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_sessions" ADD CONSTRAINT "formation_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_teachers" ADD CONSTRAINT "formation_teachers_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_teachers" ADD CONSTRAINT "formation_teachers_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formation_teachers" ADD CONSTRAINT "formation_teachers_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formations" ADD CONSTRAINT "formations_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formations" ADD CONSTRAINT "formations_level_id_formation_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."formation_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formations" ADD CONSTRAINT "formations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_formation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."formation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_marked_by_teacher_id_teachers_id_fk" FOREIGN KEY ("marked_by_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "formation_feedback_formation_id_idx" ON "formation_feedback" USING btree ("formation_id");--> statement-breakpoint
CREATE INDEX "formation_sessions_formation_id_idx" ON "formation_sessions" USING btree ("formation_id");--> statement-breakpoint
CREATE INDEX "formation_sessions_room_id_idx" ON "formation_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "formation_sessions_status_idx" ON "formation_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "formation_sessions_start_at_idx" ON "formation_sessions" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "formation_sessions_room_time_idx" ON "formation_sessions" USING btree ("room_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "formation_teachers_teacher_id_idx" ON "formation_teachers" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "formation_teachers_formation_id_idx" ON "formation_teachers" USING btree ("formation_id");--> statement-breakpoint
CREATE INDEX "payments_enrollment_id_idx" ON "payments" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "payments_student_id_idx" ON "payments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payments_formation_id_idx" ON "payments" USING btree ("formation_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_provider_checkout_id_idx" ON "payments" USING btree ("provider_checkout_id");--> statement-breakpoint
CREATE INDEX "payments_provider_checkout_compound_idx" ON "payments" USING btree ("provider","provider_checkout_id");--> statement-breakpoint
CREATE INDEX "rooms_is_active_idx" ON "rooms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "session_attendance_session_id_idx" ON "session_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_attendance_enrollment_id_idx" ON "session_attendance" USING btree ("enrollment_id");