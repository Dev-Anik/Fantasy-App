-- Runs the live-alerts worker every minute. The worker returns at once when
-- no match is close, so this costs almost nothing most of the week.
--
-- The project's address and secret key are read from Vault on each call,
-- so no key is ever written here or in git. Before this works, add them
-- once (see docs/live-alerts-setup.md):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<sb_secret_... key>', 'secret_key');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Replace an older copy of the job, if any.
select cron.unschedule(jobid) from cron.job where jobname = 'skippr-live-worker';

select cron.schedule(
  'skippr-live-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/live-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
