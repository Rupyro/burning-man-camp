CREATE TABLE "procurement_draft_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"draft_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procurement_draft_log_action_ck" CHECK ("procurement_draft_log"."action" in ('drafted', 'edited', 'discarded', 'sent', 'opened_whatsapp'))
);
--> statement-breakpoint
CREATE TABLE "procurement_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"ask" text NOT NULL,
	"to_text" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"writer" varchar(10) NOT NULL,
	"status" varchar(10) DEFAULT 'draft' NOT NULL,
	"ai_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procurement_drafts_kind_ck" CHECK ("procurement_drafts"."kind" in ('email', 'whatsapp')),
	CONSTRAINT "procurement_drafts_status_ck" CHECK ("procurement_drafts"."status" in ('draft', 'sent', 'discarded'))
);
--> statement-breakpoint
ALTER TABLE "procurement_draft_log" ADD CONSTRAINT "procurement_draft_log_draft_id_procurement_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."procurement_drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_draft_log" ADD CONSTRAINT "procurement_draft_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_drafts" ADD CONSTRAINT "procurement_drafts_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_drafts" ADD CONSTRAINT "procurement_drafts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_drafts" ADD CONSTRAINT "procurement_drafts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "procurement_draft_log_draft_ix" ON "procurement_draft_log" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "procurement_drafts_edition_ix" ON "procurement_drafts" USING btree ("edition_id","created_at");