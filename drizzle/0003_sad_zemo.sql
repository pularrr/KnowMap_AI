CREATE TABLE "agent_job_results" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb,
	"object_key" text NOT NULL,
	"checksum" text NOT NULL,
	"bytes" bigint NOT NULL
);
