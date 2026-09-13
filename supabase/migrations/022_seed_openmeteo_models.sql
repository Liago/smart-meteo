-- Migration 022: i modelli Open-Meteo come fonti a sé
--
-- Open-Meteo non ha un proprio modello: è un frontend gratuito sui modelli dei
-- servizi meteorologici nazionali. Finora lo interrogavamo con l'endpoint di
-- default (`best_match`), che restituisce una miscela scelta da loro, e lo
-- trattavamo come UNA fonte con peso 1.1.
--
-- Chiedendo i modelli uno per uno si ottengono previsioni davvero indipendenti
-- — ECMWF, DWD, NOAA, Météo-France — cioè più diversità statistica di quella
-- offerta da diversi provider commerciali, molti dei quali sotto il marchio
-- rielaborano gli stessi GFS ed ECMWF. A costo zero e senza chiave API.
--
-- Queste righe servono al vincolo di chiave esterna di `raw_forecasts.source_id`:
-- senza, l'archiviazione dei dati grezzi di ogni modello fallirebbe a ogni
-- richiesta. I pesi effettivi usati dall'aggregazione vivono in
-- `backend/connectors/openmeteo.ts`, accanto alla descrizione di ciascun modello.
--
-- NB: quando i modelli sono attivi, lo Smart Engine ESCLUDE la fonte
-- `open-meteo` (best_match) invece di affiancarla — usarle insieme conterebbe
-- due volte gli stessi dati. La riga `open-meteo` resta in tabella perché
-- torna in uso con `OPENMETEO_MODELS=off`.

insert into sources (id, name, description, weight, active) values
  (
    'open-meteo:icon_d2',
    'ICON-D2 (DWD)',
    'Modello DWD a 2.2 km sull''Europa centrale, 48 ore — il più fine sulle Alpi',
    1.2,
    true
  ),
  (
    'open-meteo:icon_eu',
    'ICON-EU (DWD)',
    'Modello DWD a 7 km sull''Europa',
    1.1,
    true
  ),
  (
    'open-meteo:ecmwf',
    'IFS (ECMWF)',
    'Modello globale ECMWF a 25 km',
    1.1,
    true
  ),
  (
    'open-meteo:meteofrance',
    'AROME/ARPEGE (Météo-France)',
    'Modelli Météo-France, alta risoluzione sull''Europa occidentale',
    1.0,
    true
  ),
  (
    'open-meteo:gfs',
    'GFS (NOAA)',
    'Modello globale NOAA, risoluzione più grossolana sull''Europa',
    0.9,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  weight = excluded.weight;

-- Verifica: le cinque righe devono esistere
-- select id, name, weight from sources where id like 'open-meteo:%' order by weight desc;
