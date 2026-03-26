alter table public.product_variants
  add column if not exists updated_at timestamptz;

update public.product_variants
set updated_at = coalesce(updated_at, created_at::timestamptz, timezone('utc', now()))
where updated_at is null;

alter table public.product_variants
  alter column updated_at set default timezone('utc', now());

alter table public.product_variants
  alter column updated_at set not null;

create or replace function public.set_product_variants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_product_variants_updated_at on public.product_variants;

create trigger trg_product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_product_variants_updated_at();
