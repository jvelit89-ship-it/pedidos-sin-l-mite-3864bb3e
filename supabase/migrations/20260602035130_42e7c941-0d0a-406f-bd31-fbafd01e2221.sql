-- Add promotion_days column to volume_pricing_rules
ALTER TABLE public.volume_pricing_rules 
ADD COLUMN promotion_days INTEGER[] DEFAULT '{}';

-- Add is_online_exclusive column to volume_pricing_rules
ALTER TABLE public.volume_pricing_rules 
ADD COLUMN is_online_exclusive BOOLEAN DEFAULT FALSE;

-- Add index for better performance
CREATE INDEX idx_volume_pricing_promotion_days ON public.volume_pricing_rules USING GIN(promotion_days);
