# Porras del grupo

App web para gestionar porras de fútbol: votación por enlace, cálculo automático
de puntos (0/1/3/4 + punto extra de eliminatoria + SDP), porras especiales con
regla configurable, clasificación general y exportación a Excel.

## Qué hace cada parte

- `/` — inicio con enlaces a clasificación y admin.
- `/votar/:id` — página que abren los amigos desde el enlace de WhatsApp.
- `/admin` — protegida por contraseña: crear porras, ver votos, meter resultado,
  calcular y actualizar la clasificación, descargar Excel.
- `/clasificacion` — clasificación general pública.

---

## PUESTA EN MARCHA (una sola vez, ~15 min)

### 1. Crear la base de datos en Supabase

1. Entra en https://supabase.com y crea una cuenta gratis.
2. "New project". Ponle nombre y una contraseña de base de datos (guárdala).
   Elige la región más cercana (p. ej. West EU).
3. Espera ~2 min a que se cree.
4. Menú lateral: **SQL Editor** > **New query**.
5. Abre el archivo `schema.sql` de este proyecto, copia TODO su contenido,
   pégalo y pulsa **Run**. Debe decir "Success".
6. Necesitas dos datos: la **Project URL** y la **clave pública**. Supabase ha
   reorganizado el menú, así que la forma más fiable es:
   - **Opción rápida**: pulsa el botón **Connect** (arriba del dashboard). Te
     muestra la Project URL y la clave juntas para copiar.
   - **Opción manual**:
     - La **clave** está en Project Settings (engranaje) > **API Keys**. Cópiala.
       Puede aparecer como `anon public` (empieza por `eyJ...`) o como
       `sb_publishable_...`. Cualquiera de las dos sirve.
     - La **Project URL** está en Project Settings > **General**: busca el
       "Reference ID"; tu URL es `https://[ese-ref].supabase.co`.
       OJO: el `[ref]` es un identificador aleatorio que genera Supabase, NO el
       nombre que le pongas al proyecto. Cópialo, no lo inventes.
7. **Crear el almacén de escudos**: menú lateral **Storage** > **New bucket**.
   - Nombre exacto: `escudos`
   - Marca la opción **Public bucket** (para que los escudos se vean en las imágenes).
   - Crea el bucket. No hace falta nada más.

### 2. Subir el código a GitHub

1. Crea un repositorio nuevo en https://github.com (puede ser privado).
2. Sube esta carpeta. Si usas la web de GitHub: "uploading an existing file"
   y arrastra todo MENOS la carpeta `node_modules` (no hace falta, se ignora).
   Si usas terminal:
   ```
   git init
   git add .
   git commit -m "porras"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```

### 3. Desplegar en Vercel

1. Entra en https://vercel.com con tu cuenta de GitHub.
2. "Add New… > Project" y elige el repositorio que acabas de subir.
3. Vercel detecta Vite automáticamente. NO cambies nada del build.
4. Abre **Environment Variables** y añade estas tres:
   - `VITE_SUPABASE_URL`        → la Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY`   → la clave pública (anon public o sb_publishable_...)
   - `VITE_ADMIN_PASSWORD`      → la contraseña que quieras para entrar en /admin
5. Pulsa **Deploy**. En ~1 min tendrás una URL tipo `https://tu-repo.vercel.app`.

¡Listo! Esa URL es tu app.

---

## AL EMPEZAR CADA TEMPORADA

1. Entra en `tu-app.vercel.app/admin`, mete la contraseña.
2. En "Temporadas", crea la nueva (ej. "2027/2028"). Se activa y la anterior
   se archiva automáticamente (queda consultable, no se borra).
3. En "Participantes", da de alta a cada jugador con su nombre y un PIN de 4
   dígitos. Esta lista es FIJA durante la temporada (no hay altas/bajas a mitad).

El esquema ya crea una primera temporada activa "2026/2027" vacía para empezar.

## USO DEL DÍA A DÍA

Todo esto funciona igual desde el móvil (la app es responsive). Para tenerla como
icono en el móvil: abre la web en el navegador y usa "Añadir a pantalla de inicio".
Se abrirá a pantalla completa como una app.

1. (La primera vez que aparece un equipo) En /admin > "Equipos y escudos", añade
   el equipo y sube su escudo. Queda guardado para siempre.
2. "Crear nueva porra" (partido o especial). En partido, eliges local y visitante
   de la lista de equipos. Pon la **hora de inicio** (partido) o **fecha límite**
   (especial): la votación se cierra sola a esa hora (hora de España). Si lo dejas
   vacío, no se cierra hasta que tú metas el resultado. Pulsa crear.
3. En "Porras de esta temporada" > "Gestionar":
   - Copia el **enlace** y mándalo por WhatsApp.
   - Pulsa **Generar imagen promocional** para crear la imagen con los escudos,
     nombres y "VS"; descárgala y mándala también por WhatsApp.
4. La gente vota desde el enlace: elige su nombre de la lista y confirma con PIN.
   - *Carga a mano (admin)*: en "Gestionar" la porra, sección "Cargar votos a
     mano", puedes meter tú el pronóstico de cada jugador sin pasar por el enlace.
     Útil para cargar porras de prueba o votos de quien te los diga por WhatsApp.
5. Tras el partido, metes el **resultado real** y pulsas "Calcular y actualizar
   clasificación".
6. Se actualiza la clasificación y puedes **Descargar Excel**.
7. La clasificación pública está en `tu-app.vercel.app/clasificacion`, con selector
   de temporada para ver también las archivadas.

---

## NOTAS Y LÍMITES

- **Participantes por temporada**: solo los jugadores que el admin da de alta
  pueden votar (eligen su nombre de una lista). Esto cierra el agujero de que
  cualquiera con el enlace votara con un nombre inventado.
- **Cierre automático**: cada porra puede tener hora de cierre (hora de España,
  con cambio verano/invierno automático). Pasada esa hora nadie puede votar ni
  modificar su voto. El cierre se comprueba al abrir la página de votar (no hay
  servidor que lo marque al segundo, pero nadie podrá votar pasada la hora).
- **Modificar el voto**: hasta el cierre, cada jugador puede volver al enlace,
  pulsar "Cargar mi voto anterior" (con su nombre y PIN) y cambiarlo.
- **Temporadas**: solo una activa. Empezar una nueva archiva la anterior sin
  borrarla. El histórico es consultable en /clasificacion.
- **Admin por contraseña**: cualquiera con la contraseña es admin. No la compartas
  ni la subas al repo. Está solo como variable de entorno en Vercel.
- **Porras especiales — dos modos** (se elige al crear):
  - *Acierto exacto*: N predicciones (ascensos, ganador de liga, etc.). Cada
    acierto suma pts_acierto, o pts_unico si eres el único en acertarla.
  - *Aproximación (gordo de Navidad)*: cada uno vota una terminación (0–9).
    Acierto exacto = pts_acierto/único; quedarse a un número (vecinos, con 0 y 9
    pegados) = pts_aprox. El 1er y 2º premio son dos porras separadas.
- **Editar la clasificación inicial**: las filas de ejemplo (porra 109) están en
  `schema.sql`. Bórralas o ajústalas a vuestra situación real antes o después de
  ejecutarlo (tabla `clasificacion` en Supabase > Table Editor).
- **Escudos**: los sube el admin (no se descargan de internet, por respeto a los
  derechos de los logos). Si un equipo no tiene escudo subido, la imagen usa un
  emblema con sus iniciales. Súbelos una vez y se reutilizan.
- **Imagen promocional**: se genera en el navegador. Si subes los escudos con fondo
  transparente (PNG) quedan mejor sobre el morado.
- **PWA**: la app es instalable en el móvil ("Añadir a pantalla de inicio"). Necesita
  conexión para leer/escribir datos (no funciona offline a propósito, para no mostrar
  clasificaciones desactualizadas).
- **Coste**: plan gratuito de Supabase y Vercel. Sobra para un grupo de amigos.
- El bundle pesa ~210 KB (gzip) por la librería de Excel; es normal.

## Desarrollo local (opcional)

```
npm install
cp .env.example .env    # rellena tus claves
npm run dev
```
