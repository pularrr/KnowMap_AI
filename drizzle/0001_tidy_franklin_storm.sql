CREATE TABLE "runtime_states" (
	"id" text PRIMARY KEY NOT NULL,
	"content_revision" bigint NOT NULL,
	"state" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
