CREATE TABLE "team_notice_reads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"notice_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_notices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"author_person_id" uuid NOT NULL,
	"body" text NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_notice_reads" ADD CONSTRAINT "team_notice_reads_notice_id_team_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."team_notices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notice_reads" ADD CONSTRAINT "team_notice_reads_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notices" ADD CONSTRAINT "team_notices_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notices" ADD CONSTRAINT "team_notices_author_person_id_people_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_notice_reads_notice_person_uq" ON "team_notice_reads" USING btree ("notice_id","person_id");--> statement-breakpoint
CREATE INDEX "team_notices_team_ends_idx" ON "team_notices" USING btree ("team_id","ends_at");