CREATE TABLE "import_batch_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"line" integer NOT NULL,
	"label" varchar(20) NOT NULL,
	"issues" jsonb NOT NULL,
	"changes" jsonb NOT NULL,
	"raw" jsonb NOT NULL,
	"cleaned" jsonb NOT NULL,
	"duplicate_of_line" integer,
	"decision" varchar(10) DEFAULT 'pending' NOT NULL,
	"fix" jsonb,
	"set_responsible" boolean DEFAULT false NOT NULL,
	"decided_by_person_id" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"file_name" text NOT NULL,
	"status" varchar(20) DEFAULT 'review' NOT NULL,
	"summary" jsonb NOT NULL,
	"headers" jsonb NOT NULL,
	"uploaded_by_person_id" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_person_id" uuid,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_decided_by_person_id_people_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_person_id_people_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_approved_by_person_id_people_id_fk" FOREIGN KEY ("approved_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batch_rows_line_uq" ON "import_batch_rows" USING btree ("batch_id","line");--> statement-breakpoint
CREATE INDEX "import_batches_uploaded_idx" ON "import_batches" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "people_import_batch_idx" ON "people" USING btree ("import_batch_id");