ALTER TABLE "alert_rules" ADD COLUMN "remind_hours_before" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "remind_again_hours_before" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "escalate_lead_hours_before" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_hours_ck" CHECK (coalesce("alert_rules"."remind_hours_before", 1) between 1 and 720 and coalesce("alert_rules"."remind_again_hours_before", 1) between 1 and 720 and coalesce("alert_rules"."escalate_lead_hours_before", 1) between 1 and 720);