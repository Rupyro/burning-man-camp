CREATE TABLE "procurement_ask_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"ask_id" uuid,
	"person_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"text" text,
	"router" varchar(10),
	"guessed" boolean DEFAULT false NOT NULL,
	"team_id" uuid,
	"task_id" uuid,
	"need_id" uuid,
	"owner_person_id" uuid,
	"due_on" date,
	"from_value" text,
	"to_value" text,
	"ai_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procurement_ask_log_action_ck" CHECK ("procurement_ask_log"."action" in ('asked', 'looks_right', 'change_owner', 'change_date'))
);
--> statement-breakpoint
ALTER TABLE "procurement_ask_log" ADD CONSTRAINT "procurement_ask_log_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_ask_log" ADD CONSTRAINT "procurement_ask_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_ask_log" ADD CONSTRAINT "procurement_ask_log_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_ask_log" ADD CONSTRAINT "procurement_ask_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_ask_log" ADD CONSTRAINT "procurement_ask_log_need_id_procurement_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."procurement_needs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_ask_log" ADD CONSTRAINT "procurement_ask_log_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "procurement_ask_log_edition_ix" ON "procurement_ask_log" USING btree ("edition_id","created_at");--> statement-breakpoint
CREATE INDEX "procurement_ask_log_ask_ix" ON "procurement_ask_log" USING btree ("ask_id");