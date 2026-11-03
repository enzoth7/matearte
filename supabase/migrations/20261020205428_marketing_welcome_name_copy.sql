alter table public.marketing_subscription_settings
  alter column description set default 'Dejanos tu nombre y correo para activar el 10% en tu primera compra.';

update public.marketing_subscription_settings
set description = 'Dejanos tu nombre y correo para activar el 10% en tu primera compra.'
where description = 'Dejanos tu correo y activá tu beneficio para tu primera compra.';
