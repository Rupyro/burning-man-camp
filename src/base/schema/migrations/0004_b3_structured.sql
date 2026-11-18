ALTER TABLE "alert_rules" ADD COLUMN "remind_days_before" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "remind_again_days_before" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "escalate_lead_after_days" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "escalate_camp_after_days" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "within_days" smallint;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "escalate_within_days" smallint;--> statement-breakpoint
ALTER TABLE "camp_settings" DROP COLUMN "settings";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "required_skill_ids";--> statement-breakpoint
-- Data: copy valid thresholds out of the old params JSON (invalid ones fall back to defaults).
UPDATE "alert_rules" SET
	"remind_days_before" = (SELECT v::smallint FROM (SELECT "params" #>> '{days_before,0}' AS v) x WHERE v ~ '^[0-9]{1,2}$' AND v::int BETWEEN 0 AND 60),
	"remind_again_days_before" = (SELECT v::smallint FROM (SELECT "params" #>> '{days_before,1}' AS v) x WHERE v ~ '^[0-9]{1,2}$' AND v::int BETWEEN 0 AND 60),
	"escalate_lead_after_days" = (SELECT v::smallint FROM (SELECT "params" #>> '{escalate_after_days,0}' AS v) x WHERE v ~ '^[0-9]{1,2}$' AND v::int BETWEEN 0 AND 60),
	"escalate_camp_after_days" = (SELECT v::smallint FROM (SELECT "params" #>> '{escalate_after_days,1}' AS v) x WHERE v ~ '^[0-9]{1,2}$' AND v::int BETWEEN 0 AND 60),
	"within_days" = (SELECT v::smallint FROM (SELECT "params" #>> '{within_days}' AS v) x WHERE v ~ '^[0-9]{1,2}$' AND v::int BETWEEN 1 AND 60),
	"escalate_within_days" = (SELECT v::smallint FROM (SELECT "params" #>> '{escalate_within_days}' AS v) x WHERE v ~ '^[0-9]{1,2}$' AND v::int BETWEEN 0 AND 60);--> statement-breakpoint
ALTER TABLE "alert_rules" DROP COLUMN "params";--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_days_ck" CHECK (coalesce("alert_rules"."remind_days_before", 0) between 0 and 60 and coalesce("alert_rules"."remind_again_days_before", 0) between 0 and 60 and coalesce("alert_rules"."escalate_lead_after_days", 0) between 0 and 60 and coalesce("alert_rules"."escalate_camp_after_days", 0) between 0 and 60 and coalesce("alert_rules"."within_days", 1) between 1 and 60 and coalesce("alert_rules"."escalate_within_days", 0) between 0 and 60);