-- Add dynamic color threshold columns to repair_settings
-- value_pct_thresholds: thresholds for % of product value
-- net_margin_thresholds: thresholds for net margin (%)
-- Structure:
-- {
--   "green": 45,   -- red if < green, yellow if >= green and < yellow
--   "yellow": 55   -- green if >= yellow
-- }

ALTER TABLE public.repair_settings
ADD COLUMN IF NOT EXISTS value_pct_thresholds JSONB NOT NULL DEFAULT jsonb_build_object('green', 45, 'yellow', 55);

ALTER TABLE public.repair_settings
ADD COLUMN IF NOT EXISTS net_margin_thresholds JSONB NOT NULL DEFAULT jsonb_build_object('green', 45, 'yellow', 55);

-- Ensure existing rows have defaults if null
UPDATE public.repair_settings
SET value_pct_thresholds = COALESCE(value_pct_thresholds, jsonb_build_object('green', 45, 'yellow', 55));

UPDATE public.repair_settings
SET net_margin_thresholds = COALESCE(net_margin_thresholds, jsonb_build_object('green', 45, 'yellow', 55));

-- Optional safety checks to enforce structure and ordering (yellow >= green)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repair_settings_value_pct_thresholds_check'
  ) THEN
    ALTER TABLE public.repair_settings
    ADD CONSTRAINT repair_settings_value_pct_thresholds_check
    CHECK (
      (value_pct_thresholds ? 'green')
      AND (value_pct_thresholds ? 'yellow')
      AND ((value_pct_thresholds->>'green')::numeric >= 0)
      AND ((value_pct_thresholds->>'yellow')::numeric >= 0)
      AND ((value_pct_thresholds->>'yellow')::numeric >= (value_pct_thresholds->>'green')::numeric)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repair_settings_net_margin_thresholds_check'
  ) THEN
    ALTER TABLE public.repair_settings
    ADD CONSTRAINT repair_settings_net_margin_thresholds_check
    CHECK (
      (net_margin_thresholds ? 'green')
      AND (net_margin_thresholds ? 'yellow')
      AND ((net_margin_thresholds->>'green')::numeric >= 0)
      AND ((net_margin_thresholds->>'yellow')::numeric >= 0)
      AND ((net_margin_thresholds->>'yellow')::numeric >= (net_margin_thresholds->>'green')::numeric)
    );
  END IF;
END$$;

COMMENT ON COLUMN public.repair_settings.value_pct_thresholds IS
'JSON thresholds for product value percentage coloring: red if < green; yellow if >= green and < yellow; green if >= yellow';

COMMENT ON COLUMN public.repair_settings.net_margin_thresholds IS
'JSON thresholds for net margin percentage coloring: red if < green; yellow if >= green and < yellow; green if >= yellow';
