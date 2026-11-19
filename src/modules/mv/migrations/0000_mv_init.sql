CREATE TABLE "mv_drivers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"cleared" boolean DEFAULT false NOT NULL,
	"note" varchar(200) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mv_drivers" ADD CONSTRAINT "mv_drivers_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mv_drivers" ADD CONSTRAINT "mv_drivers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mv_drivers_person_uq" ON "mv_drivers" USING btree ("edition_id","person_id");