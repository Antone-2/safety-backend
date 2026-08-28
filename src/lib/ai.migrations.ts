export const aiPredictionsTable = `
CREATE TABLE IF NOT EXISTS ai_predictions (
  id TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_json TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'v1.0.0',
  confidence REAL NOT NULL DEFAULT 0,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
)`;

export const aiDocumentsTable = `
CREATE TABLE IF NOT EXISTS ai_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  updated_at TEXT NOT NULL DEFAULT datetime('now')
)`;

export const aiKnowledgeBaseTable = `
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id TEXT PRIMARY KEY,
  chunk_text TEXT NOT NULL,
  embedding TEXT,
  source_document_id TEXT,
  section TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
)`;

export const aiFeedbackTable = `
CREATE TABLE IF NOT EXISTS ai_feedback (
  id TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  prediction_id TEXT,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  feedback_text TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now')
)`;

export const aiChatSessionsTable = `
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  conversation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  history_json TEXT NOT NULL,
  latest_response_json TEXT,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  updated_at TEXT NOT NULL DEFAULT datetime('now')
)`;

export const aiChatSessionTitleColumn = `
ALTER TABLE ai_chat_sessions ADD COLUMN title TEXT
`;

export const aiChatSessionPinnedColumn = `
ALTER TABLE ai_chat_sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0
`;

export const aiIndexes = `
CREATE INDEX IF NOT EXISTS idx_ai_predictions_feature ON ai_predictions(feature);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created_at ON ai_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_documents_category ON ai_documents(category);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_feature ON ai_feedback(feature);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_updated ON ai_chat_sessions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_source ON ai_knowledge_base(source_document_id);
`;

export const aiMigrations = [
  { name: "040_create_ai_predictions", sql: aiPredictionsTable },
  { name: "041_create_ai_documents", sql: aiDocumentsTable },
  { name: "042_create_ai_knowledge_base", sql: aiKnowledgeBaseTable },
  { name: "043_create_ai_feedback", sql: aiFeedbackTable },
  { name: "044_create_ai_chat_sessions", sql: aiChatSessionsTable },
  { name: "045_create_ai_indexes", sql: aiIndexes },
  { name: "046_add_ai_chat_session_title", sql: aiChatSessionTitleColumn },
  { name: "047_add_ai_chat_session_pinned", sql: aiChatSessionPinnedColumn },
];
