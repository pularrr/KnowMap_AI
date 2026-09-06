CREATE TABLE "agent_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"node_id" text,
	"kind" text NOT NULL,
	"query" text NOT NULL,
	"state" text NOT NULL,
	"progress" text,
	"error" text,
	"result_object_key" text,
	"result_checksum" text,
	"result_bytes" bigint,
	"revision" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"worker_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "applied_patches" (
	"patch_id" text PRIMARY KEY NOT NULL,
	"base_revision" bigint NOT NULL,
	"applied_revision" bigint NOT NULL,
	"patch_hash" text NOT NULL,
	"applied_by" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" bigint NOT NULL,
	"actor" text NOT NULL,
	"kind" text NOT NULL,
	"content_revision" bigint NOT NULL,
	"summary" text NOT NULL,
	"details_hash" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "confirmation_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"patch_id" text NOT NULL,
	"session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"modality" text NOT NULL,
	"mime_type" text NOT NULL,
	"object_key" text NOT NULL,
	"checksum" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_cards" (
	"node_id" text PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"formula_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"visual_branch" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"rationale" text NOT NULL,
	"weight" numeric NOT NULL,
	"status" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legacy_label" text,
	"current_revision" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_formulas" (
	"id" text PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"name" text NOT NULL,
	"latex" text NOT NULL,
	"source_text" text NOT NULL,
	"meaning" text NOT NULL,
	"symbols" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"short_fact" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"node_type" text NOT NULL,
	"domain_id" text NOT NULL,
	"visual_branch" text NOT NULL,
	"primary_parent_id" text,
	"level" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"legacy_id" text,
	"legacy_snapshot" jsonb,
	"current_revision" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_revisions" (
	"revision" bigint PRIMARY KEY NOT NULL,
	"parent_revision" bigint,
	"actor" text NOT NULL,
	"summary" text NOT NULL,
	"checksum" text NOT NULL,
	"snapshot_object_key" text,
	"restored_from_revision" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_savepoints" (
	"id" text PRIMARY KEY NOT NULL,
	"content_revision" bigint NOT NULL,
	"label" text NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	"saved_by" text NOT NULL,
	"checksum" text NOT NULL,
	"snapshot_object_key" text
);
--> statement-breakpoint
CREATE TABLE "source_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"modality" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum" text NOT NULL,
	"object_key" text,
	"supplied_at" timestamp with time zone NOT NULL,
	"supplied_by" text NOT NULL
);
