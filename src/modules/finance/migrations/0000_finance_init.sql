CREATE TYPE "public"."finance_budget_status" AS ENUM('draft', 'approved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."finance_decision" AS ENUM('approved', 'rejected', 'needs_info');--> statement-breakpoint
CREATE TYPE "public"."finance_paid_with" AS ENUM('personal', 'camp_card', 'camp_cash', 'supplier_invoice');--> statement-breakpoint
CREATE TYPE "public"."finance_reimbursement_status" AS ENUM('owed', 'paid', 'declined');--> statement-breakpoint
CREATE TYPE "public"."finance_spend_status" AS ENUM('draft', 'submitted', 'needs_info', 'approved', 'rejected', 'cancelled', 'purchased', 'closed');--> statement-breakpoint
CREATE TABLE "finance_approval_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_cents" bigint DEFAULT 0 NOT NULL,
	"max_cents" bigint,
	"within_budget_only" boolean DEFAULT false NOT NULL,
	"required_steps" jsonb NOT NULL,
	"sort_order" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spend_request_id" uuid NOT NULL,
	"step" smallint NOT NULL,
	"approver_person_id" uuid NOT NULL,
	"requester_person_id" uuid NOT NULL,
	"decision" "finance_decision" NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_approvals_not_self_ck" CHECK ("finance_approvals"."approver_person_id" <> "finance_approvals"."requester_person_id")
);
--> statement-breakpoint
CREATE TABLE "finance_budgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"team_id" uuid,
	"name" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'ZAR' NOT NULL,
	"status" "finance_budget_status" DEFAULT 'approved' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "finance_budgets_amount_ck" CHECK ("finance_budgets"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"spend_request_id" uuid,
	"team_id" uuid NOT NULL,
	"payer_person_id" uuid NOT NULL,
	"paid_with" "finance_paid_with" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'ZAR' NOT NULL,
	"spent_on" date NOT NULL,
	"description" text NOT NULL,
	"receipt_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "finance_expenses_amount_ck" CHECK ("finance_expenses"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance_reimbursements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"payee_person_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'ZAR' NOT NULL,
	"status" "finance_reimbursement_status" DEFAULT 'owed' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by_person_id" uuid,
	"method_note" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_spend_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"ref_seq" integer NOT NULL,
	"ref_code" varchar(20) NOT NULL,
	"budget_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"requester_person_id" uuid NOT NULL,
	"title" text NOT NULL,
	"justification" text,
	"estimated_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'ZAR' NOT NULL,
	"supplier_name" text,
	"needed_by" date,
	"status" "finance_spend_status" DEFAULT 'draft' NOT NULL,
	"policy_id" uuid,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_step" smallint DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"task_id" uuid,
	"source_ref_type" varchar(40),
	"source_ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "finance_spend_requests_amount_ck" CHECK ("finance_spend_requests"."estimated_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance_approval_policies" ADD CONSTRAINT "finance_approval_policies_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_approvals" ADD CONSTRAINT "finance_approvals_spend_request_id_finance_spend_requests_id_fk" FOREIGN KEY ("spend_request_id") REFERENCES "public"."finance_spend_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_approvals" ADD CONSTRAINT "finance_approvals_approver_person_id_people_id_fk" FOREIGN KEY ("approver_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_approvals" ADD CONSTRAINT "finance_approvals_requester_person_id_people_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_spend_request_id_finance_spend_requests_id_fk" FOREIGN KEY ("spend_request_id") REFERENCES "public"."finance_spend_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_payer_person_id_people_id_fk" FOREIGN KEY ("payer_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reimbursements" ADD CONSTRAINT "finance_reimbursements_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reimbursements" ADD CONSTRAINT "finance_reimbursements_expense_id_finance_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."finance_expenses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reimbursements" ADD CONSTRAINT "finance_reimbursements_payee_person_id_people_id_fk" FOREIGN KEY ("payee_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reimbursements" ADD CONSTRAINT "finance_reimbursements_paid_by_person_id_people_id_fk" FOREIGN KEY ("paid_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_spend_requests" ADD CONSTRAINT "finance_spend_requests_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_spend_requests" ADD CONSTRAINT "finance_spend_requests_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_spend_requests" ADD CONSTRAINT "finance_spend_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_spend_requests" ADD CONSTRAINT "finance_spend_requests_requester_person_id_people_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_spend_requests" ADD CONSTRAINT "finance_spend_requests_policy_id_finance_approval_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."finance_approval_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_spend_requests" ADD CONSTRAINT "finance_spend_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_approvals_request_idx" ON "finance_approvals" USING btree ("spend_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_budgets_edition_team_uq" ON "finance_budgets" USING btree ("edition_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_expenses_request_uq" ON "finance_expenses" USING btree ("spend_request_id");--> statement-breakpoint
CREATE INDEX "finance_expenses_team_idx" ON "finance_expenses" USING btree ("edition_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_reimbursements_expense_uq" ON "finance_reimbursements" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "finance_reimbursements_status_idx" ON "finance_reimbursements" USING btree ("edition_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_spend_requests_ref_uq" ON "finance_spend_requests" USING btree ("ref_code");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_spend_requests_seq_uq" ON "finance_spend_requests" USING btree ("edition_id","ref_seq");--> statement-breakpoint
CREATE INDEX "finance_spend_requests_status_idx" ON "finance_spend_requests" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "finance_spend_requests_team_idx" ON "finance_spend_requests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "finance_spend_requests_requester_idx" ON "finance_spend_requests" USING btree ("requester_person_id");