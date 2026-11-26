-- FIX50 factuurregister: eigen nummerreeks per gebruiker per jaar plus een
-- bevroren momentopname per factuur. Eerder gedeelde facturen blijven daardoor
-- exact reproduceerbaar, ook als onderhoud later wordt aangepast of verwijderd.

create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Factuur blijft bestaan als de scooter wordt verwijderd: de snapshot is leidend.
  scooter_id uuid references public.scooters (id) on delete set null,
  sequence_year integer not null,
  sequence_no integer not null check (sequence_no > 0),
  invoice_number text not null,
  issued_at timestamptz not null default now(),
  -- Gekozen periode of losse beurt, zoals de gebruiker hem koos.
  selection jsonb not null,
  -- Volledig documentsnapshot: scooter, eigenaar, regels, bedragen.
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint invoices_user_number_unique unique (user_id, invoice_number),
  constraint invoices_user_sequence_unique unique (user_id, sequence_year, sequence_no)
);
create index if not exists idx_invoices_scooter
  on public.invoices (scooter_id, issued_at desc);
create index if not exists idx_invoices_user
  on public.invoices (user_id, issued_at desc);

-- Tellers per gebruiker en jaar. Alleen via register_invoice() te wijzigen,
-- zodat twee gelijktijdige aanvragen nooit hetzelfde nummer krijgen.
create table if not exists public.invoice_sequences (
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null,
  last_no integer not null default 0,
  primary key (user_id, year)
);

alter table public.invoices enable row level security;
alter table public.invoice_sequences enable row level security;

drop policy if exists "invoices eigen rijen" on public.invoices;
create policy "invoices eigen rijen" on public.invoices
  for select using (auth.uid() = user_id);
-- Geen insert/update/delete-policy: rijen ontstaan uitsluitend via de functie
-- hieronder, die het nummer atomair uitgeeft.

grant select on public.invoices to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Nummer uitgeven + snapshot vastleggen in één transactie
-- ─────────────────────────────────────────────────────────────
create or replace function public.register_invoice(
  p_scooter_id uuid,
  p_selection jsonb,
  p_snapshot jsonb,
  p_issued_at timestamptz default now()
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_issued_at timestamptz := coalesce(p_issued_at, now());
  v_year integer := extract(year from v_issued_at)::int;
  v_no integer;
  v_row public.invoices;
begin
  if v_uid is null then
    raise exception 'Log eerst in om een factuur te registreren.'
      using errcode = '42501';
  end if;

  -- Alleen een scooter van dezelfde gebruiker mag aan de factuur hangen.
  if p_scooter_id is not null and not exists (
    select 1 from public.scooters s
    where s.id = p_scooter_id and s.user_id = v_uid
  ) then
    raise exception 'Onbekende scooter voor deze gebruiker.'
      using errcode = '42501';
  end if;

  if p_snapshot is null or p_snapshot->'lines' is null then
    raise exception 'Factuursnapshot ontbreekt.'
      using errcode = '22023';
  end if;

  -- Rij-lock op de teller: gelijktijdige aanvragen krijgen na elkaar een nummer.
  insert into public.invoice_sequences (user_id, year, last_no)
  values (v_uid, v_year, 1)
  on conflict (user_id, year) do update
    set last_no = public.invoice_sequences.last_no + 1
  returning last_no into v_no;

  insert into public.invoices (
    user_id, scooter_id, sequence_year, sequence_no, invoice_number,
    issued_at, selection, snapshot
  )
  values (
    v_uid, p_scooter_id, v_year, v_no,
    format('F50-%s-%s', v_year, lpad(v_no::text, 4, '0')),
    v_issued_at, p_selection, p_snapshot
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_invoice(uuid, jsonb, jsonb, timestamptz) from public;
grant execute on function public.register_invoice(uuid, jsonb, jsonb, timestamptz) to authenticated;
