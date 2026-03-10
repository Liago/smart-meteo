-- Migration 015: Tabella source_accuracy
-- Tabella per calcolare il peso dinamico delle fonti in base al Mean Absolute Error (MAE)
-- rispetto alla media di "consenso" (l'aggregato "Smart" calcolato dall'engine)

create table if not exists source_accuracy (
    id uuid primary key default uuid_generate_v4(),
    source_id text not null references sources(id) on delete cascade,
    metric text not null,       -- es. 'temperature', 'precipitation_prob', 'wind_speed', 'overall'
    mae numeric(10,4) not null default 0.0,
    sample_count integer not null default 0,
    last_computed_at timestamptz not null default now(),
    unique(source_id, metric)
);

comment on table source_accuracy is 'Mean Absolute Error per identificare storicamente l''accuratezza rispetto al consenso';

-- Enable Row Level Security (RLS)
alter table source_accuracy enable row level security;

-- Policies for anon/authenticated (Read-only for users, service_role can write)
create policy "Anyone can read source accuracy" 
on source_accuracy for select 
to public 
using (true);

create policy "Service role can insert source accuracy"
on source_accuracy for insert
to service_role
with check (true);

create policy "Service role can update source accuracy"
on source_accuracy for update
to service_role
using (true);

-- Funzione per aggiornare incrementale MAE al volo dal server
create or replace function update_source_accuracy(
    p_source_id text, 
    p_metric text, 
    p_error numeric
) returns void
language plpgsql security definer
as $$
declare
    v_mae numeric;
    v_count integer;
begin
    -- Seleziona il record corrente se esiste
    select mae, sample_count into v_mae, v_count 
    from source_accuracy 
    where source_id = p_source_id and metric = p_metric;

    if found then
        -- Cumulative Moving Average: NewAvg = OldAvg + (NewValue - OldAvg)/NewCount
        update source_accuracy
        set 
            mae = v_mae + (abs(p_error) - v_mae) / (v_count + 1),
            sample_count = v_count + 1,
            last_computed_at = now()
        where source_id = p_source_id and metric = p_metric;
    else
        -- Primo inserimento
        insert into source_accuracy (source_id, metric, mae, sample_count)
        values (p_source_id, p_metric, abs(p_error), 1);
    end if;
end;
$$;
