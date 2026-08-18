PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credential_references (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('windows-credential-manager', 'macos-keychain', 'linux-secret-service', 'external', 'none')),
    reference_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22 CHECK (port BETWEEN 1 AND 65535),
    username TEXT NOT NULL DEFAULT '',
    server_model TEXT NOT NULL DEFAULT '',
    operating_system TEXT NOT NULL DEFAULT '',
    architecture TEXT NOT NULL DEFAULT 'unknown' CHECK (architecture IN ('x86_64', 'aarch64', 'unknown')),
    environment TEXT NOT NULL CHECK (environment IN ('development', 'test', 'staging', 'production', 'demo')),
    connection_mode TEXT NOT NULL DEFAULT 'manual' CHECK (connection_mode IN ('manual', 'read-only-planned')),
    credential_reference_id TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (credential_reference_id) REFERENCES credential_references(id) ON DELETE SET NULL,
    UNIQUE (project_id, host, port)
);

CREATE TABLE IF NOT EXISTS environment_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    asset_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('complete', 'missing', 'conflict', 'uncollected')),
    collected_by TEXT NOT NULL DEFAULT '',
    collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    raw_output_redacted TEXT NOT NULL DEFAULT '',
    parsed_facts_json TEXT NOT NULL DEFAULT '{}',
    missing_facts_json TEXT NOT NULL DEFAULT '[]',
    conflicting_facts_json TEXT NOT NULL DEFAULT '[]',
    checksum TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deployment_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    title TEXT NOT NULL,
    task_type TEXT NOT NULL,
    environment TEXT NOT NULL,
    workflow_phase TEXT NOT NULL DEFAULT 'DISCOVER' CHECK (
        workflow_phase IN ('DISCOVER', 'DEFINE', 'RETRIEVE', 'PLAN', 'APPROVE', 'MANUAL_EXECUTE', 'VERIFY', 'KNOWLEDGE')
    ),
    risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    target_definition_json TEXT NOT NULL DEFAULT '{}',
    acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
    rollback_requirements TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'blocked', 'partially_verified', 'verified', 'failed', 'human_exempt', 'archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS change_plans (
    id TEXT PRIMARY KEY NOT NULL,
    deployment_task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    confirmed_facts_json TEXT NOT NULL DEFAULT '[]',
    missing_facts_json TEXT NOT NULL DEFAULT '[]',
    impact_scope TEXT NOT NULL DEFAULT '',
    config_diff TEXT NOT NULL DEFAULT '',
    backup_plan TEXT NOT NULL DEFAULT '',
    verification_plan TEXT NOT NULL DEFAULT '',
    rollback_plan TEXT NOT NULL DEFAULT '',
    source_summary_json TEXT NOT NULL DEFAULT '[]',
    approval_required INTEGER NOT NULL DEFAULT 1 CHECK (approval_required IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deployment_task_id) REFERENCES deployment_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS change_steps (
    id TEXT PRIMARY KEY NOT NULL,
    change_plan_id TEXT NOT NULL,
    step_order INTEGER NOT NULL CHECK (step_order > 0),
    objective TEXT NOT NULL,
    prerequisites_json TEXT NOT NULL DEFAULT '[]',
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    command_preview TEXT NOT NULL DEFAULT '',
    expected_result TEXT NOT NULL DEFAULT '',
    evidence_required_json TEXT NOT NULL DEFAULT '[]',
    validation_commands TEXT NOT NULL DEFAULT '',
    rollback_commands TEXT NOT NULL DEFAULT '',
    network_required INTEGER NOT NULL DEFAULT 0 CHECK (network_required IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (change_plan_id) REFERENCES change_plans(id) ON DELETE CASCADE,
    UNIQUE (change_plan_id, step_order)
);

CREATE TABLE IF NOT EXISTS approval_records (
    id TEXT PRIMARY KEY NOT NULL,
    change_plan_id TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approved_for_manual_execution', 'rejected', 'returned_for_revision')),
    reviewed_target INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_target IN (0, 1)),
    reviewed_commands INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_commands IN (0, 1)),
    reviewed_diff INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_diff IN (0, 1)),
    reviewed_validation INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_validation IN (0, 1)),
    reviewed_rollback INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_rollback IN (0, 1)),
    comment TEXT NOT NULL DEFAULT '',
    decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (change_plan_id) REFERENCES change_plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS manual_execution_evidence (
    id TEXT PRIMARY KEY NOT NULL,
    deployment_task_id TEXT NOT NULL,
    change_step_id TEXT NOT NULL,
    executor TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    actual_command_redacted TEXT NOT NULL DEFAULT '',
    exit_code INTEGER,
    stdout_redacted TEXT NOT NULL DEFAULT '',
    stderr_redacted TEXT NOT NULL DEFAULT '',
    related_logs_redacted TEXT NOT NULL DEFAULT '',
    human_actions TEXT NOT NULL DEFAULT '',
    evidence_status TEXT NOT NULL DEFAULT 'unverified' CHECK (evidence_status IN ('unverified', 'partial', 'passed', 'failed', 'human_exempt')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deployment_task_id) REFERENCES deployment_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (change_step_id) REFERENCES change_steps(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS skill_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'reviewed', 'verified', 'deprecated')),
    owner TEXT NOT NULL DEFAULT '',
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    source_scope TEXT NOT NULL CHECK (source_scope IN ('inner', 'public')),
    metadata_yaml TEXT NOT NULL DEFAULT '',
    prompt_markdown TEXT NOT NULL DEFAULT '',
    precheck_template TEXT NOT NULL DEFAULT '',
    action_template TEXT NOT NULL DEFAULT '',
    verification_template TEXT NOT NULL DEFAULT '',
    rollback_template TEXT NOT NULL DEFAULT '',
    requires_human_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_human_approval IN (0, 1)),
    last_verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, version)
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    deployment_task_id TEXT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    body_markdown TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    source_scope TEXT NOT NULL CHECK (source_scope IN ('inner', 'public')),
    source_type TEXT NOT NULL CHECK (source_type IN ('skill', 'sop', 'incident', 'official_doc', 'web_result')),
    verification_status TEXT NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft', 'reviewed', 'verified', 'deprecated')),
    environment_scope TEXT NOT NULL DEFAULT 'general' CHECK (environment_scope IN ('development', 'test', 'staging', 'production', 'general')),
    risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    applicable_versions_json TEXT NOT NULL DEFAULT '{}',
    validation_evidence_redacted TEXT NOT NULL DEFAULT '',
    rollback_plan TEXT NOT NULL DEFAULT '',
    maintainer TEXT NOT NULL DEFAULT '',
    last_verified_at TEXT,
    requires_human_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_human_approval IN (0, 1)),
    contains_sensitive_data INTEGER NOT NULL DEFAULT 0 CHECK (contains_sensitive_data IN (0, 1)),
    web_source_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (web_source_reviewed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (deployment_task_id) REFERENCES deployment_tasks(id) ON DELETE SET NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    knowledge_id UNINDEXED,
    title,
    summary,
    body,
    tags,
    tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS knowledge_entries_ai
AFTER INSERT ON knowledge_entries BEGIN
    INSERT INTO knowledge_fts (knowledge_id, title, summary, body, tags)
    VALUES (new.id, new.title, new.summary, new.body_markdown, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_entries_au
AFTER UPDATE ON knowledge_entries BEGIN
    DELETE FROM knowledge_fts WHERE knowledge_id = old.id;
    INSERT INTO knowledge_fts (knowledge_id, title, summary, body, tags)
    VALUES (new.id, new.title, new.summary, new.body_markdown, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_entries_ad
AFTER DELETE ON knowledge_entries BEGIN
    DELETE FROM knowledge_fts WHERE knowledge_id = old.id;
END;

CREATE TABLE IF NOT EXISTS generated_artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    deployment_task_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL CHECK (artifact_type IN ('deployment_ticket', 'deployment_report', 'knowledge_draft', 'asset_inventory')),
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed', 'archived')),
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    FOREIGN KEY (deployment_task_id) REFERENCES deployment_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    deployment_task_id TEXT,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    detail_redacted_json TEXT NOT NULL DEFAULT '{}',
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (deployment_task_id) REFERENCES deployment_tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_environment ON assets(environment);
CREATE INDEX IF NOT EXISTS idx_snapshots_asset_time ON environment_snapshots(asset_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_phase ON deployment_tasks(project_id, workflow_phase);
CREATE INDEX IF NOT EXISTS idx_tasks_asset_status ON deployment_tasks(asset_id, status);
CREATE INDEX IF NOT EXISTS idx_change_plans_task ON change_plans(deployment_task_id);
CREATE INDEX IF NOT EXISTS idx_change_steps_plan_order ON change_steps(change_plan_id, step_order);
CREATE INDEX IF NOT EXISTS idx_evidence_task ON manual_execution_evidence(deployment_task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_project_status ON knowledge_entries(project_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_scope_type ON knowledge_entries(source_scope, source_type);
CREATE INDEX IF NOT EXISTS idx_audit_task_time ON audit_events(deployment_task_id, occurred_at DESC);
