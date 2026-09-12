-- Migration 023: accuratezza misurata sull'osservato, con finestra scorrevole
--
-- Problema che risolve
-- --------------------
-- `source_accuracy` conteneva la deviazione di ogni fonte dalla **media delle
-- altre** (il "consenso"), non l'errore rispetto a quello che è realmente
-- accaduto. Due conseguenze:
--
--   1. una fonte che ha ragione mentre le altre sbagliano veniva penalizzata,
--      perché premiare la conformità al gruppo non è misurare l'accuratezza;
--   2. `update_source_accuracy` aggiornava una media cumulativa senza finestra
--      temporale: `sample_count` cresceva all'infinito, quindi dopo qualche
--      migliaio di campioni il MAE era di fatto congelato e i pesi dinamici
--      non si muovevano più.
--
-- Cosa cambia
-- -----------
-- Ogni confronto fra una previsione archiviata in `raw_forecasts` e la
-- temperatura osservata (Open-Meteo Archive/ERA5, o Meteostat dove presente)
-- diventa una riga in `accuracy_samples`. Il MAE in `source_accuracy` viene
-- **ricalcolato** sui soli campioni degli ultimi N giorni, invece di essere
-- aggiornato in modo incrementale e irreversibile.

create table if not exists accuracy_samples (
    id uuid primary key default uuid_generate_v4(),
    source_id text not null references sources(id) on delete cascade,
    metric text not null,                       -- 'temperature' (altre metriche in seguito)

    -- Errore assoluto fra il valore dichiarato dalla fonte e quello osservato.
    abs_error numeric(10,4) not null,
    forecast_value numeric(10,4),
    observed_value numeric(10,4),

    -- Ora a cui si riferisce l'osservazione, e dove.
    observed_at timestamptz not null,
    latitude numeric(9,6),
    longitude numeric(9,6),

    -- Provider della verità osservata: 'archive' | 'meteostat'.
    observation_source text not null default 'archive',

    created_at timestamptz not null default now()
);

comment on table accuracy_samples is
    'Un confronto previsione/osservato per fonte e metrica. Il MAE in source_accuracy è la media di questi campioni su una finestra scorrevole.';
comment on column accuracy_samples.abs_error is
    'Errore assoluto: |valore dichiarato dalla fonte - valore osservato|';
comment on column accuracy_samples.observation_source is
    'Da dove viene la verità osservata: archive (ERA5) o meteostat (stazioni)';

-- La query di ricalcolo filtra per metrica e finestra temporale.
create index if not exists idx_accuracy_samples_window
    on accuracy_samples (metric, observed_at desc);
create index if not exists idx_accuracy_samples_source
    on accuracy_samples (source_id, metric, observed_at desc);

-- Evita di contare due volte lo stesso confronto se il job viene rieseguito
-- sulla stessa giornata.
create unique index if not exists idx_accuracy_samples_unique
    on accuracy_samples (source_id, metric, observed_at, latitude, longitude);

alter table accuracy_samples enable row level security;

create policy "Anyone can read accuracy samples"
    on accuracy_samples for select
    to public
    using (true);

create policy "Service role can write accuracy samples"
    on accuracy_samples for all
    to service_role
    using (true)
    with check (true);

-- source_accuracy: si aggiungono la finestra usata e il tipo di verità, così
-- l'endpoint /api/accuracy può dire *su cosa* è stato misurato il numero.
alter table source_accuracy
    add column if not exists window_days integer not null default 30;
alter table source_accuracy
    add column if not exists observation_source text;

comment on column source_accuracy.window_days is
    'Ampiezza della finestra scorrevole su cui il MAE è stato ricalcolato';
comment on column source_accuracy.observation_source is
    'Provider della verità osservata prevalente nella finestra';
comment on column source_accuracy.mae is
    'Mean Absolute Error rispetto alle OSSERVAZIONI (fino alla migrazione 023 era la deviazione dal consenso)';

-- La funzione incrementale non serve più: il MAE si ricalcola dai campioni.
-- Viene rimossa per non lasciare in giro due strade per scrivere lo stesso
-- numero, una delle quali senza finestra.
drop function if exists update_source_accuracy(text, text, numeric);

-- I valori accumulati con la vecchia semantica non sono confrontabili con
-- quelli nuovi: azzerarli evita che pesi calcolati sulla conformità al consenso
-- sopravvivano al cambio di significato.
update source_accuracy set mae = 0, sample_count = 0, observation_source = null;

-- Verifica:
-- select source_id, metric, mae, sample_count, window_days from source_accuracy order by mae;
-- select count(*) from accuracy_samples where observed_at > now() - interval '30 days';
