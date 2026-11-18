CREATE TYPE "public"."finance_approver_kind" AS ENUM('team_lead', 'role');--> statement-breakpoint
CREATE TYPE "public"."finance_step_status" AS ENUM('pending', 'approved', 'rejected', 'needs_info');--> statement-breakpoint
CREATE TABLE "finance_policy_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"policy_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"approver_kind" "finance_approver_kind" NOT NULL,
	"role_id" uuid,
	CONSTRAINT "finance_policy_steps_role_ck" CHECK (("finance_policy_steps"."approver_kind" = 'role') = ("finance_policy_steps"."role_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "finance_request_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spend_request_id" uuid NOT NULL,
	"round" smallint NOT NULL,
	"position" smallint NOT NULL,
	"approver_kind" "finance_approver_kind" NOT NULL,
	"role_id" uuid,
	"status" "finance_step_status" DEFAULT 'pending' NOT NULL,
	"requester_person_id" uuid NOT NULL,
	"decided_by_person_id" uuid,
	"comment" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_request_steps_role_ck" CHECK (("finance_request_steps"."approver_kind" = 'role') = ("finance_request_steps"."role_id" is not null)),
	CONSTRAINT "finance_request_steps_decided_ck" CHECK (("finance_request_steps"."status" = 'pending') = ("finance_request_steps"."decided_by_person_id" is null and "finance_request_steps"."decided_at" is null)),
	CONSTRAINT "finance_request_steps_not_self_ck" CHECK ("finance_request_steps"."decided_by_person_id" is null or "finance_request_steps"."decided_by_person_id" <> "finance_request_steps"."requester_person_id")
);
--> statement-breakpoint
ALTER TABLE "finance_policy_steps" ADD CONSTRAINT "finance_policy_steps_policy_id_finance_approval_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."finance_approval_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_policy_steps" ADD CONSTRAINT "finance_policy_steps_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_request_steps" ADD CONSTRAINT "finance_request_steps_spend_request_id_finance_spend_requests_id_fk" FOREIGN KEY ("spend_request_id") REFERENCES "public"."finance_spend_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_request_steps" ADD CONSTRAINT "finance_request_steps_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_request_steps" ADD CONSTRAINT "finance_request_steps_requester_person_id_people_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_request_steps" ADD CONSTRAINT "finance_request_steps_decided_by_person_id_people_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_policy_steps_position_uq" ON "finance_policy_steps" USING btree ("policy_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_request_steps_position_uq" ON "finance_request_steps" USING btree ("spend_request_id","round","position");--> statement-breakpoint
CREATE INDEX "finance_request_steps_pending_idx" ON "finance_request_steps" USING btree ("status","created_at");--> statement-breakpoint
-- Data: policy steps out of required_steps JSON ("team_lead" or "role:<key>").
INSERT INTO "finance_policy_steps" ("id", "policy_id", "position", "approver_kind", "role_id")
SELECT gen_random_uuid(), p."id", (s.ord - 1)::smallint,
	CASE WHEN s.step->>'approver' = 'team_lead' THEN 'team_lead' ELSE 'role' END::"finance_approver_kind",
	ro."id"
FROM "finance_approval_policies" p
CROSS JOIN LATERAL jsonb_array_elements(p."required_steps") WITH ORDINALITY AS s(step, ord)
LEFT JOIN "roles" ro ON 'role:' || ro."key" = s.step->>'approver'
WHERE s.step->>'approver' = 'team_lead' OR ro."id" IS NOT NULL;--> statement-breakpoint
-- Data: every past decision becomes a decided step. Each "needs info" ends a round, so a
-- decision's round is 1 + the send-backs before it on that request.
INSERT INTO "finance_request_steps" ("id", "spend_request_id", "round", "position", "approver_kind", "role_id", "status", "requester_person_id", "decided_by_person_id", "comment", "decided_at", "created_at")
SELECT gen_random_uuid(), a."spend_request_id",
	(1 + count(*) FILTER (WHERE a."decision" = 'needs_info') OVER w - CASE WHEN a."decision" = 'needs_info' THEN 1 ELSE 0 END)::smallint,
	a."step",
	CASE WHEN r."steps"->(a."step"::int)->>'approver' = 'team_lead' OR ro."id" IS NULL THEN 'team_lead' ELSE 'role' END::"finance_approver_kind",
	CASE WHEN r."steps"->(a."step"::int)->>'approver' = 'team_lead' THEN NULL ELSE ro."id" END,
	a."decision"::text::"finance_step_status", a."requester_person_id", a."approver_person_id", a."comment", a."decided_at", a."decided_at"
FROM "finance_approvals" a
JOIN "finance_spend_requests" r ON r."id" = a."spend_request_id"
LEFT JOIN "roles" ro ON 'role:' || ro."key" = r."steps"->(a."step"::int)->>'approver'
WINDOW w AS (PARTITION BY a."spend_request_id" ORDER BY a."decided_at", a."id" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
ON CONFLICT ("spend_request_id", "round", "position") DO NOTHING;--> statement-breakpoint
-- Data: the snapshot's undecided steps become pending steps of the latest round.
INSERT INTO "finance_request_steps" ("id", "spend_request_id", "round", "position", "approver_kind", "role_id", "status", "requester_person_id", "created_at")
SELECT gen_random_uuid(), r."id",
	(1 + (SELECT count(*) FROM "finance_approvals" a WHERE a."spend_request_id" = r."id" AND a."decision" = 'needs_info' AND r."status" <> 'needs_info'))::smallint,
	(s.ord - 1)::smallint,
	CASE WHEN s.step->>'approver' = 'team_lead' THEN 'team_lead' ELSE 'role' END::"finance_approver_kind",
	ro."id", 'pending', r."requester_person_id", coalesce(r."submitted_at", r."created_at")
FROM "finance_spend_requests" r
CROSS JOIN LATERAL jsonb_array_elements(r."steps") WITH ORDINALITY AS s(step, ord)
LEFT JOIN "roles" ro ON 'role:' || ro."key" = s.step->>'approver'
WHERE r."status" = 'submitted' AND (s.step->>'approver' = 'team_lead' OR ro."id" IS NOT NULL)
ON CONFLICT ("spend_request_id", "round", "position") DO NOTHING;--> statement-breakpoint
DROP TABLE "finance_approvals" CASCADE;--> statement-breakpoint
ALTER TABLE "finance_approval_policies" DROP COLUMN "required_steps";--> statement-breakpoint
ALTER TABLE "finance_spend_requests" DROP COLUMN "steps";--> statement-breakpoint
ALTER TABLE "finance_spend_requests" DROP COLUMN "current_step";--> statement-breakpoint
DROP TYPE "public"."finance_decision";