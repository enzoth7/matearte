-- Count confirmed retail purchases within each advertising report's inclusive dates.
-- Return only aggregates to staff who can access /marketing/pauta.
create function public.gestion_ad_report_retail_purchases()
returns table(report_id uuid, purchases bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_ad_reports() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  select report.id,
    (
      select count(*)
      from public.orders sale
      where (
        sale.channel = 'Web'
        and sale.paid_at is not null
        and sale.customer_snapshot ->> 'purchaseFlow' is distinct from 'wholesale_bank_transfer'
        and (sale.paid_at at time zone 'America/Montevideo')::date
          between report.period_start and report.period_end
      ) or (
        sale.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
        and sale.status = 'internal_completed'
        and sale.sold_on between report.period_start and report.period_end
      )
    ) as purchases
  from public.ad_reports report;
end;
$$;

revoke all on function public.gestion_ad_report_retail_purchases() from public, anon;
grant execute on function public.gestion_ad_report_retail_purchases() to authenticated;
