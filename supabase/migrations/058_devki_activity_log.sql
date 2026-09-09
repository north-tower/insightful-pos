-- ============================================================================
-- 058 - Devki website activity log
--
-- Backs the activity log for the devkigroup.co.ke marketing site, which is a
-- separate Next.js app deployed to Vercel. It shares this database but must
-- never be able to reach POS data, so the table has RLS on with NO policies
-- and every access path goes through the SECURITY DEFINER functions below.
--
-- The website holds only the anon key plus a read token; it never receives the
-- service role key.
-- ============================================================================

-- ─── Shared secret used by the privileged read/prune functions ──────────────
-- Populated once from the Supabase SQL editor, never committed:
--   INSERT INTO public.devki_activity_config (id, read_token_hash)
--   VALUES (1, encode(sha256(convert_to('<token>', 'UTF8')), 'hex'))
--   ON CONFLICT (id) DO UPDATE SET read_token_hash = EXCLUDED.read_token_hash;

CREATE TABLE IF NOT EXISTS public.devki_activity_config (
  id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  read_token_hash  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.devki_activity_config (id, read_token_hash)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.devki_activity_config ENABLE ROW LEVEL SECURITY;

-- ─── Event log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.devki_activity_events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  type            TEXT NOT NULL CHECK (type IN (
                    'enquiry_submitted',
                    'quote_requested',
                    'contact_click',
                    'page_view'
                  )),

  -- Where it happened
  path            TEXT,
  category_slug   TEXT,
  product_slug    TEXT,
  channel         TEXT CHECK (channel IS NULL OR channel IN ('whatsapp', 'phone', 'email')),

  -- Enquiry payload (enquiry_submitted only)
  name            TEXT,
  email           TEXT,
  phone           TEXT,
  message         TEXT,

  -- Attribution
  session_id      TEXT,
  referrer        TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,

  -- Request context. The raw IP is never stored, only a salted hash.
  country         TEXT,
  city            TEXT,
  user_agent      TEXT,
  ip_hash         TEXT,

  -- Notification outcome
  notified_at     TIMESTAMPTZ,
  notify_error    TEXT,

  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_devki_activity_created_at
  ON public.devki_activity_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devki_activity_type_created_at
  ON public.devki_activity_events(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devki_activity_product
  ON public.devki_activity_events(product_slug, created_at DESC)
  WHERE product_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devki_activity_ip_hash
  ON public.devki_activity_events(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

-- RLS on with no policies: anon and authenticated get nothing at all.
-- Only the SECURITY DEFINER functions below can touch this table.
ALTER TABLE public.devki_activity_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.devki_activity_events IS
  'Visitor activity log for the devkigroup.co.ke marketing site. Unrelated to POS data. Access only via devki_* SECURITY DEFINER functions.';

-- ─── Token helper ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.devki_check_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN FALSE;
  END IF;

  SELECT read_token_hash INTO v_hash
  FROM public.devki_activity_config
  WHERE id = 1;

  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.devki_check_token(TEXT) FROM PUBLIC;

-- ─── Ingest ─────────────────────────────────────────────────────────────────
--
-- Called by the website with the anon key. Validates and truncates input,
-- drops writes from an IP that is flooding, and decides whether the event
-- warrants an SMS alert (the caller cannot make that call safely because it
-- has no view of history).

CREATE OR REPLACE FUNCTION public.devki_log_event(
  p_type          TEXT,
  p_path          TEXT DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_product_slug  TEXT DEFAULT NULL,
  p_channel       TEXT DEFAULT NULL,
  p_name          TEXT DEFAULT NULL,
  p_email         TEXT DEFAULT NULL,
  p_phone         TEXT DEFAULT NULL,
  p_message       TEXT DEFAULT NULL,
  p_session_id    TEXT DEFAULT NULL,
  p_referrer      TEXT DEFAULT NULL,
  p_utm_source    TEXT DEFAULT NULL,
  p_utm_medium    TEXT DEFAULT NULL,
  p_utm_campaign  TEXT DEFAULT NULL,
  p_country       TEXT DEFAULT NULL,
  p_city          TEXT DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_ip_hash       TEXT DEFAULT NULL,
  p_metadata      JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Per-IP flood guard
  c_ip_limit         CONSTANT INT := 60;
  -- Ceiling on alertable events per hour so a bot cannot run up an SMS bill
  c_alert_limit      CONSTANT INT := 20;
  -- A visitor clicking the same product CTA repeatedly is one lead, not many
  c_quote_dedupe     CONSTANT INTERVAL := INTERVAL '30 minutes';

  v_id               BIGINT;
  v_recent_from_ip   INT;
  v_recent_alerts    INT;
  v_duplicate_quote  BOOLEAN := FALSE;
  v_should_notify    BOOLEAN := FALSE;
BEGIN
  IF p_type IS NULL OR p_type NOT IN (
    'enquiry_submitted', 'quote_requested', 'contact_click', 'page_view'
  ) THEN
    RAISE EXCEPTION 'Unknown activity type: %', p_type;
  END IF;

  IF p_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_recent_from_ip
    FROM public.devki_activity_events
    WHERE ip_hash = p_ip_hash
      AND created_at > now() - INTERVAL '1 minute';

    IF v_recent_from_ip >= c_ip_limit THEN
      RETURN jsonb_build_object('id', NULL, 'should_notify', FALSE, 'throttled', TRUE);
    END IF;
  END IF;

  INSERT INTO public.devki_activity_events (
    type, path, category_slug, product_slug, channel,
    name, email, phone, message,
    session_id, referrer, utm_source, utm_medium, utm_campaign,
    country, city, user_agent, ip_hash, metadata
  )
  VALUES (
    p_type,
    left(p_path, 512),
    left(p_category_slug, 128),
    left(p_product_slug, 128),
    nullif(p_channel, ''),
    left(p_name, 200),
    left(p_email, 320),
    left(p_phone, 40),
    left(p_message, 4000),
    left(p_session_id, 64),
    left(p_referrer, 1024),
    left(p_utm_source, 128),
    left(p_utm_medium, 128),
    left(p_utm_campaign, 128),
    left(p_country, 8),
    left(p_city, 128),
    left(p_user_agent, 512),
    left(p_ip_hash, 64),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  IF p_type IN ('enquiry_submitted', 'quote_requested') THEN
    SELECT count(*) INTO v_recent_alerts
    FROM public.devki_activity_events
    WHERE type IN ('enquiry_submitted', 'quote_requested')
      AND created_at > now() - INTERVAL '1 hour'
      AND id <> v_id;

    v_should_notify := v_recent_alerts < c_alert_limit;

    IF v_should_notify AND p_type = 'quote_requested' AND p_session_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.devki_activity_events
        WHERE type = 'quote_requested'
          AND session_id = p_session_id
          AND product_slug IS NOT DISTINCT FROM p_product_slug
          AND created_at > now() - c_quote_dedupe
          AND id < v_id
      ) INTO v_duplicate_quote;

      v_should_notify := NOT v_duplicate_quote;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'should_notify', v_should_notify,
    'throttled', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.devki_log_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.devki_log_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO anon, authenticated;

-- ─── Record the outcome of an alert ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.devki_mark_notified(
  p_id    BIGINT,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.devki_activity_events
  SET notified_at = CASE WHEN p_error IS NULL THEN now() ELSE notified_at END,
      notify_error = left(p_error, 1000)
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.devki_mark_notified(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.devki_mark_notified(BIGINT, TEXT) TO anon, authenticated;

-- ─── Dashboard read ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.devki_list_events(
  p_token  TEXT,
  p_type   TEXT DEFAULT NULL,
  p_from   TIMESTAMPTZ DEFAULT NULL,
  p_to     TIMESTAMPTZ DEFAULT NULL,
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS SETOF public.devki_activity_events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.devki_check_token(p_token) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.devki_activity_events e
  WHERE (p_type IS NULL OR e.type = p_type)
    AND (p_from IS NULL OR e.created_at >= p_from)
    AND (p_to   IS NULL OR e.created_at <  p_to)
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.devki_list_events(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.devki_list_events(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO anon, authenticated;

-- ─── Dashboard headline numbers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.devki_activity_stats(
  p_token TEXT,
  p_type  TEXT DEFAULT NULL,
  p_from  TIMESTAMPTZ DEFAULT NULL,
  p_to    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.devki_check_token(p_token) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT jsonb_build_object(
    'today', (
      SELECT count(*) FROM public.devki_activity_events
      WHERE created_at >= date_trunc('day', now())
    ),
    'last_7_days', (
      SELECT count(*) FROM public.devki_activity_events
      WHERE created_at >= now() - INTERVAL '7 days'
    ),
    'last_30_days', (
      SELECT count(*) FROM public.devki_activity_events
      WHERE created_at >= now() - INTERVAL '30 days'
    ),
    'enquiries_last_30_days', (
      SELECT count(*) FROM public.devki_activity_events
      WHERE type = 'enquiry_submitted' AND created_at >= now() - INTERVAL '30 days'
    ),
    'by_type', COALESCE((
      SELECT jsonb_object_agg(t.type, t.n)
      FROM (
        SELECT type, count(*) AS n
        FROM public.devki_activity_events
        WHERE created_at >= now() - INTERVAL '30 days'
        GROUP BY type
      ) t
    ), '{}'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_agg(p)
      FROM (
        SELECT jsonb_build_object(
                 'product_slug', product_slug,
                 'category_slug', max(category_slug),
                 'views', count(*) FILTER (WHERE type = 'page_view'),
                 'quotes', count(*) FILTER (WHERE type = 'quote_requested'),
                 'total', count(*)
               ) AS p
        FROM public.devki_activity_events
        WHERE product_slug IS NOT NULL
          AND created_at >= now() - INTERVAL '30 days'
        GROUP BY product_slug
        ORDER BY count(*) DESC
        LIMIT 8
      ) s
    ), '[]'::jsonb),
    'matching', (
      SELECT count(*) FROM public.devki_activity_events e
      WHERE (p_type IS NULL OR e.type = p_type)
        AND (p_from IS NULL OR e.created_at >= p_from)
        AND (p_to   IS NULL OR e.created_at <  p_to)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.devki_activity_stats(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.devki_activity_stats(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

-- ─── Retention ──────────────────────────────────────────────────────────────
-- Page views are the only high-volume type; leads are kept indefinitely.

CREATE OR REPLACE FUNCTION public.devki_prune_activity(p_token TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT public.devki_check_token(p_token) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  DELETE FROM public.devki_activity_events
  WHERE type = 'page_view'
    AND created_at < now() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.devki_prune_activity(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.devki_prune_activity(TEXT) TO anon, authenticated;
