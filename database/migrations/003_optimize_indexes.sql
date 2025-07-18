-- Optimization indexes for N+1 query performance improvement
-- These indexes support the batch loading optimization in DatabaseWishRepositoryAdapter

-- Index for main wishes query with ordering
CREATE INDEX IF NOT EXISTS idx_wishes_created_at_desc ON wishes (created_at DESC);

-- Index for efficient support counting by wish_id
CREATE INDEX IF NOT EXISTS idx_supports_wish_id ON supports (wish_id);

-- Composite index for support status checking (viewer support queries)
CREATE INDEX IF NOT EXISTS idx_supports_wish_session ON supports (wish_id, session_id);
CREATE INDEX IF NOT EXISTS idx_supports_wish_user ON supports (wish_id, user_id);

-- Index for session lookup by wish_id
CREATE INDEX IF NOT EXISTS idx_sessions_wish_id ON sessions (wish_id);

-- Composite index for efficient JOIN operations
CREATE INDEX IF NOT EXISTS idx_supports_wish_supporter ON supports (wish_id, session_id, user_id);

-- Index for wish lookup by user_id (used in repository)
CREATE INDEX IF NOT EXISTS idx_wishes_user_id ON wishes (user_id);

-- Performance monitoring: Log index creation
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('003_optimize_indexes', datetime('now'))
ON CONFLICT(version) DO UPDATE SET applied_at = datetime('now');

-- Index usage analysis (for PostgreSQL, adapt for SQLite if needed)
-- These comments document the expected query patterns:

/*
Optimized Query Pattern Analysis:

1. Main Query (findLatestWithSupportStatusOptimized):
   SELECT w.id, w.name, w.wish, w.user_id, w.created_at, w.support_count,
          CASE WHEN vs.wish_id IS NOT NULL THEN 1 ELSE 0 END as is_supported_by_viewer
   FROM wishes w
   LEFT JOIN supports vs ON (w.id = vs.wish_id AND (vs.session_id = ? OR vs.user_id = ?))
   ORDER BY w.created_at DESC
   LIMIT ? OFFSET ?
   
   Uses: idx_wishes_created_at_desc, idx_supports_wish_session, idx_supports_wish_user

2. Session Batch Query:
   SELECT wish_id, session_id FROM sessions WHERE wish_id IN (?, ?, ...)
   
   Uses: idx_sessions_wish_id

3. Supporters Batch Query:
   SELECT wish_id, session_id, user_id FROM supports WHERE wish_id IN (?, ?, ...)
   
   Uses: idx_supports_wish_id, idx_supports_wish_supporter

Performance Impact:
- Before: 61 queries for 20 wishes (1 + 20*3)
- After: 3 queries total
- Query reduction: ~95%
- Expected response time improvement: ~93%
*/