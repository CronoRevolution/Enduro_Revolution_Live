-- ============================================================
--  ESQUEMA SUPABASE — App de Porras (v2, con temporadas)
--  Ejecuta todo esto en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- TEMPORADAS -------------------------------------------------
-- Solo una activa a la vez. Las demás quedan archivadas (solo lectura).
create table if not exists temporadas (
  id bigint generated always as identity primary key,
  nombre text not null,          -- ej. "2026/2027"
  activa boolean default false,
  campeon text,                  -- campeón de la temporada (editable por admin)
  creada timestamptz default now()
);

-- PARTICIPANTES (por temporada) ------------------------------
-- El admin los da de alta al preparar cada temporada. Lista fija
-- una vez arrancada (sin altas/bajas a mitad).
create table if not exists participantes (
  id bigint generated always as identity primary key,
  temporada_id bigint references temporadas(id) on delete cascade,
  nombre text not null,
  pin text not null,
  unique (temporada_id, nombre)
);

-- EQUIPOS (escudos reutilizables, subidos por el admin) -----
-- El escudo se guarda en Supabase Storage (bucket "escudos");
-- aquí guardamos solo el nombre y la URL pública.
create table if not exists equipos (
  id bigint generated always as identity primary key,
  nombre text unique not null,
  escudo_url text,
  creado timestamptz default now()
);

-- PORRAS (cuelgan de una temporada) --------------------------
create table if not exists porras (
  id bigint generated always as identity primary key,
  temporada_id bigint references temporadas(id) on delete cascade,
  jornada int,                   -- null en especiales sin resolver; se asigna al cerrar
  tipo text not null check (tipo in ('partido','especial')),
  comp text not null,
  sede text, local text, visitante text,
  eliminatoria boolean default false,
  ida_id bigint references porras(id) on delete set null,  -- si esta porra es la VUELTA, apunta a la IDA
  pase_aqui boolean default false, -- el "quién pasa/gana" se resuelve en esta misma porra (partido único)
  resultado_final text,            -- resultado tras prórroga/penaltis (solo estético, para la imagen)
  -- especiales: modo de puntuación
  modo text default 'exacto' check (modo in ('exacto','aproximacion')),
  predicciones jsonb,
  opciones jsonb,                -- opciones por predicción (modo exacto)
  cabecera_url text,             -- imagen de fondo del encabezado (solo especiales)
  puntos_acierto int default 3,
  puntos_unico int default 4,
  puntos_aprox int default 1,
  cerrada boolean default false,
  cierra_en timestamptz,         -- instante de cierre de la votación (UTC). null = no auto-cierra
  comentarios text,              -- titular de la jornada
  subcomentario text,            -- comentario más largo de la jornada
  resultado jsonb,
  creada timestamptz default now()
);

-- VOTOS ------------------------------------------------------
create table if not exists votos (
  id bigint generated always as identity primary key,
  porra_id bigint references porras(id) on delete cascade,
  jugador text not null,
  contenido jsonb not null,
  creado timestamptz default now(),
  unique (porra_id, jugador)
);

-- CLASIFICACIÓN (por temporada) ------------------------------
-- Se actualiza al cerrar cada porra. Clave compuesta temporada+jugador.
-- CLASIFICACIÓN BASE (por temporada) -------------------------
-- Punto de partida de la temporada (ej. lo importado a mitad de
-- temporada). La clasificación REAL mostrada = esta base + la suma
-- de resultados_porra. Así recalcular una porra nunca duplica.
create table if not exists clasificacion (
  temporada_id bigint references temporadas(id) on delete cascade,
  jugador text not null,
  ap int default 0,  -- apuestas
  d  int default 0,  -- derrotas
  e  int default 0,  -- extra eliminatoria
  q  int default 0,  -- quinielas
  u  int default 0,  -- victorias únicas
  v  int default 0,  -- victorias
  sdp int default 0,
  pt int default 0,
  primary key (temporada_id, jugador)
);

-- RESULTADOS POR PORRA (desglose, fuente de verdad) ----------
-- Una fila por jugador y porra. La clasificación se suma desde aquí.
-- Recalcular una porra = reemplazar (upsert) sus filas. Nunca duplica.
-- PALMARÉS (títulos por jugador, persiste entre temporadas) -----
-- Número de temporadas ganadas por cada jugador (por nombre).
-- Se muestra como estrellas junto al nombre en la clasificación.
create table if not exists palmares (
  jugador text primary key,
  titulos int default 0
);

create table if not exists resultados_porra (
  porra_id bigint references porras(id) on delete cascade,
  temporada_id bigint references temporadas(id) on delete cascade,
  jugador text not null,
  tipo text,          -- 'v' | 'u' | 'q' | 'd'
  extra int default 0,
  pt int default 0,   -- puntos totales de esa porra para el jugador
  sdp int default 0,
  primary key (porra_id, jugador)
);

-- ============================================================
--  SEGURIDAD (RLS) — lectura/escritura pública; la gestión la
--  protege la contraseña de admin del frontend. Suficiente para
--  un grupo de amigos.
-- ============================================================
alter table temporadas    enable row level security;
alter table participantes enable row level security;
alter table equipos       enable row level security;
alter table porras        enable row level security;
alter table votos         enable row level security;
alter table clasificacion enable row level security;
alter table resultados_porra enable row level security;
alter table palmares      enable row level security;

create policy "pub temporadas"    on temporadas    for all using (true) with check (true);
create policy "pub participantes" on participantes for all using (true) with check (true);
create policy "pub equipos"       on equipos       for all using (true) with check (true);
create policy "pub porras"        on porras        for all using (true) with check (true);
create policy "pub votos"         on votos         for all using (true) with check (true);
create policy "pub clasificacion" on clasificacion for all using (true) with check (true);
create policy "pub resultados"    on resultados_porra for all using (true) with check (true);
create policy "pub palmares"      on palmares for all using (true) with check (true);

-- ============================================================
--  ARRANQUE: una temporada activa vacía para empezar.
--  El admin añadirá los participantes desde la app.
-- ============================================================
insert into temporadas (nombre, activa) values ('2026/2027', true);

-- ============================================================
--  MIGRACIÓN (si ya habías ejecutado una versión anterior del
--  esquema sin el campo de cierre, ejecuta también esto):
-- ============================================================
alter table porras add column if not exists cierra_en timestamptz;
alter table porras add column if not exists comentarios text;
alter table porras add column if not exists subcomentario text;
alter table temporadas add column if not exists campeon text;
alter table porras add column if not exists opciones jsonb;
alter table porras add column if not exists cabecera_url text;
alter table porras add column if not exists ida_id bigint references porras(id) on delete set null;
alter table porras add column if not exists pase_aqui boolean default false;
alter table porras add column if not exists resultado_final text;
