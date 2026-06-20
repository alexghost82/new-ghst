-- Ghost Character — structured per-conversation persona / role / response
-- guidance, replacing the single free-text system_prompt box with a layered
-- model (Identity / Focus / Style / Operational+Escalation / Rules) that
-- mirrors how the leading agent platforms configure an agent.
--
-- All columns are additive + nullable / defaulted so every legacy conversation
-- stays valid (empty character == today's behaviour). The existing
-- ``system_prompt`` column is REUSED as the free-text "additional site rules"
-- layer, so it is intentionally NOT touched here.
--
--   * agent_name              — what the operator calls Ghost in this channel.
--   * role_mission            — one line: Ghost's job for this site.
--   * site_type               — environment class (drives industry context).
--   * focus_priorities        — newline-separated "pay attention to" list.
--   * ignore_scope            — newline-separated "treat as routine" list.
--   * site_baseline           — what "normal" looks like here (cuts false flags).
--   * persona_tone            — terse | friendly | formal (communication style).
--   * dry_humor               — 0/1, allow the rare dry side-comment.
--   * proactivity             — on_demand | flag_anomalies | continuous.
--   * operator_profile        — guard | shift_manager | owner (depth + terms).
--   * critical_event_definition — what warrants immediate escalation here.
--   * escalation_contacts     — JSON array of {name, role, phone, min_severity}.
--   * quiet_hours             — optional "HH:MM-HH:MM" no-non-critical window.

ALTER TABLE conversations ADD COLUMN agent_name TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN role_mission TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN site_type TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN focus_priorities TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN ignore_scope TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN site_baseline TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN persona_tone TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN dry_humor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN proactivity TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN operator_profile TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN critical_event_definition TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN escalation_contacts TEXT DEFAULT '[]';
ALTER TABLE conversations ADD COLUMN quiet_hours TEXT DEFAULT '';
