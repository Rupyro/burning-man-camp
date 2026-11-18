CREATE TYPE "public"."digest_frequency" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email_immediate', 'email_digest', 'off');--> statement-breakpoint
CREATE TYPE "public"."notification_urgency" AS ENUM('immediate', 'digest');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'suppressed');--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_person_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_states" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rule_key" varchar(60) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid NOT NULL,
	"level" smallint NOT NULL,
	"fingerprint" text NOT NULL,
	"first_fired_at" timestamp with time zone NOT NULL,
	"last_fired_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "alert_states_level_range" CHECK ("alert_states"."level" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"to_person_id" uuid,
	"to_email" text NOT NULL,
	"template" varchar(60) NOT NULL,
	"payload" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_message_id" text,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job" varchar(60) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "job_status" DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"person_id" uuid NOT NULL,
	"type" varchar(40) DEFAULT '*' NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'daily' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_person_id_type_pk" PRIMARY KEY("person_id","type")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient_person_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text NOT NULL,
	"urgency" "notification_urgency" NOT NULL,
	"read_at" timestamp with time zone,
	"digested_at" timestamp with time zone,
	"alert_state_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_updated_by_person_id_people_id_fk" FOREIGN KEY ("updated_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_to_person_id_people_id_fk" FOREIGN KEY ("to_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_person_id_people_id_fk" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_state_id_alert_states_id_fk" FOREIGN KEY ("alert_state_id") REFERENCES "public"."alert_states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_states_dedupe_uq" ON "alert_states" USING btree ("rule_key","entity_type","entity_id","level","fingerprint");--> statement-breakpoint
CREATE INDEX "alert_states_open_idx" ON "alert_states" USING btree ("entity_type","entity_id") WHERE "alert_states"."resolved_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedupe_uq" ON "email_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_outbox_status_next_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "job_runs_job_started_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_person_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_undigested_idx" ON "notifications" USING btree ("recipient_person_id","digested_at") WHERE "notifications"."digested_at" is null;