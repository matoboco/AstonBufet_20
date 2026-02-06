-- Rollback: 007_shortage_contributions
-- Description: Remove shortage contributions tracking

DROP VIEW IF EXISTS shortage_summary;
DROP TABLE IF EXISTS shortage_contributions;
