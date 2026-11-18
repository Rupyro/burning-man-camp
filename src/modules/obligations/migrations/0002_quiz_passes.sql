CREATE TABLE "obligation_quiz_passes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"quiz_key" varchar(40) NOT NULL,
	"passed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "obligation_quiz_passes" ADD CONSTRAINT "obligation_quiz_passes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation_quiz_passes" ADD CONSTRAINT "obligation_quiz_passes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "obligation_quiz_passes_uq" ON "obligation_quiz_passes" USING btree ("edition_id","person_id","quiz_key");