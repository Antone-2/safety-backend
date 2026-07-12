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

export const aiIndexes = `
CREATE INDEX IF NOT EXISTS idx_ai_predictions_feature ON ai_predictions(feature);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created_at ON ai_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_documents_category ON ai_documents(category);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_feature ON ai_feedback(feature);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_source ON ai_knowledge_base(source_document_id);
`;

export const aiMigrations = [
  { name: "040_create_ai_predictions", sql: aiPredictionsTable },
  { name: "041_create_ai_documents", sql: aiDocumentsTable },
  { name: "042_create_ai_knowledge_base", sql: aiKnowledgeBaseTable },
  { name: "043_create_ai_feedback", sql: aiFeedbackTable },
  { name: "044_create_ai_indexes", sql: aiIndexes },
];
