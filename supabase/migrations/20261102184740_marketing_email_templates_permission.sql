-- Staff who can see campaigns can also inspect the read-only email catalog.
update public.commerce_admin_users
set allowed_paths = array_append(allowed_paths, '/marketing/email-templates')
where allowed_paths is not null
  and '/marketing/campanas' = any(allowed_paths)
  and not '/marketing/email-templates' = any(allowed_paths);
