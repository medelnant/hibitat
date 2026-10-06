CREATE TABLE "edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"label" text NOT NULL,
	"curates" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"sub" text DEFAULT '' NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"kind" text,
	"legacy" boolean DEFAULT false NOT NULL,
	"curated_by" text,
	"curated_since" text,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_nodes_id_fk" FOREIGN KEY ("source") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_nodes_id_fk" FOREIGN KEY ("target") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "edges_pair_idx" ON "edges" USING btree ("source","target");