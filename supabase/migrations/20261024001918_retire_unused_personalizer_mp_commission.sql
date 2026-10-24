-- The checkout does not charge this historical customizer rule. Keep past
-- catalog versions intact while removing it from future pricing edits.
update public.pricing_rule_definitions
set active = false,
    required = false
where rule_key = 'commission:mercado_pago';
