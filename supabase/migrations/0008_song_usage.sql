-- "Make a song": count song lyrics toward the daily AI budget (lib/ai/budget.ts).
-- Run after 0007_highlight_summaries.sql. The songs themselves are never stored.
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('prayer', 'explain', 'highlight', 'song'));
