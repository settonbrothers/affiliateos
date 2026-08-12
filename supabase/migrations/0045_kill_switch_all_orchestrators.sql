-- 0045_kill_switch_all_orchestrators.sql
--
-- The Discovery admin page states "Every stage is kill-switch guarded". It is
-- not. 0014 seeded five orchestrator rows and deliberately allowed no INSERT
-- policy ("New orchestrators get added by a future migration") — this is that
-- migration, eleven orchestrators late.
--
-- assertNotPaused() reads the row with .maybeSingle(): no row means null, which
-- means the guard silently passes. So every orchestrator added since 0014 —
-- including BOTH discovery orchestrators and the entire execute layer — cannot
-- be stopped from the admin UI at all. That matters more now that a discovery
-- scan chains itself across invocations and can spend real money unattended.

insert into agent_kill_switches (orchestrator_name) values
  -- discovery
  ('DiscoveryTriageOrchestrator'),
  ('DiscoveryDeepOrchestrator'),
  ('DiscoveryMineOrchestrator'),
  ('DiscoveryNetworkOrchestrator'),
  -- execute layer
  ('DeepBriefOrchestrator'),
  ('AvatarBuilderOrchestrator'),
  ('SpyAnalysisOrchestrator'),
  ('AdCopyOrchestrator'),
  ('CreativeEngineOrchestrator'),
  ('DiagnosisV2Orchestrator'),
  ('TranslateOrchestrator')
on conflict (orchestrator_name) do nothing;
