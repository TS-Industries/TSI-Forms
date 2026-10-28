-- TSI I466 V2 additive migration. Apply only after independent D1 backup.
-- Existing overhaul_data and overhaul_data_history are not altered.
CREATE TABLE IF NOT EXISTS i466_workflow_events (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('torque','measurement','nonconformance','signoff','part','step')),
 component TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_i466_events_job_time ON i466_workflow_events(job_id,created_at);
CREATE TABLE IF NOT EXISTS i466_workflow_state (
 job_id TEXT NOT NULL,
 step_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','in_progress','completed','blocked')),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(job_id,step_id)
);
CREATE TABLE IF NOT EXISTS i466_job_access (
 job_id TEXT NOT NULL,
 principal_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('viewer','mechanic','verifier','admin')),
 PRIMARY KEY(job_id,principal_id)
);
