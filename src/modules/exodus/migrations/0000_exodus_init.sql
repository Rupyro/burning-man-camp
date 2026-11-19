CREATE TABLE "exodus_departures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"departs_at" timestamp with time zone NOT NULL,
	"stays_for_sweep" boolean DEFAULT false NOT NULL,
	"travel" varchar(200) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exodus_departures" ADD CONSTRAINT "exodus_departures_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exodus_departures" ADD CONSTRAINT "exodus_departures_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exodus_departures_person_uq" ON "exodus_departures" USING btree ("edition_id","person_id");