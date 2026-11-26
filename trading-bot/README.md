# Cryptobot · asistente de trading cripto (Lemon + API opcional)

Cada **20 minutos** analiza el mercado de las criptos que elijas y te dice **qué hacer según cómo esté el mercado**: comprar, vender, reducir, mantener o quedarte en USDT. Cada recomendación trae su porqué. Tú la ejecutas en **Lemon** y confirmas con un toque en Telegram o en el panel. Como opción, puede conectarse por **API a un exchange** (vía `ccxt`) para ejecutar solo. Esa opción viene **desactivada**.

> ⚠️ **Resultado honesto de la investigación (datos reales 2020–2026):** con los costos de Lemon (~1.4 % ida y vuelta), **ninguna variante de la estrategia pasó la puerta de calidad**.
> - El mejor bot quedó en −1.4 % fuera de muestra, mientras que comprar y mantener ganó +760 % con caídas de −88 %.
> - Por eso el bot arranca y se queda en **modo práctica**, y cada recomendación lo advierte.
> - **No uses dinero real** salvo que una investigación futura apruebe la puerta. Detalle en [`docs/investigacion.md`](docs/investigacion.md).
>
> Esto no es asesoría financiera.

---

## Cómo funciona (cada 20 minutos)

```
velas 5m → barras 20m → 29 variables (tendencia, volatilidad, flujo, funding, sentimiento)
        → régimen (alcista / lateral / estrés, HMM) → evento significativo (CUSUM)
        → regla de tendencia + modelo LightGBM (prob. de ganar tras costos)
        → tamaño por riesgo (1% del capital si toca el stop) → reglas duras de riesgo
        → recomendación con su porqué → Telegram + panel → tú ejecutas en Lemon
vigilante de precios (cada 15 s): avisa al instante si se toca tu stop u objetivo
```

- **Motor:** Python, en [`engine/`](engine).
- **Panel web:** React + Supabase, en [`dashboard/`](dashboard).
- **Base de datos del panel:** [`supabase/schema.sql`](supabase/schema.sql).

## Puesta en marcha

Necesitas Python ≥ 3.11 y [`uv`](https://docs.astral.sh/uv/) (o pip).

**1. Instala el motor.**

```bash
cd trading-bot/engine
```

```bash
uv venv && uv pip install -e ".[dev]"
```

**2. Configura.** Copia el ejemplo y edítalo (criptos, modo, capital, Telegram):

```bash
cp ../.env.example .env
```

**3. Baja el histórico público.** Son velas de 5m desde 2020, funding y Fear & Greed (~20 min, ~350 MB):

```bash
.venv/bin/cryptobot download
```

**4. Investiga y entrena.** Corre walk-forward, backtests, baselines, Deflated Sharpe y PBO, y aplica la puerta de calidad:

```bash
.venv/bin/cryptobot research --profile lemon
```

**5. Prueba un ciclo ahora:**

```bash
.venv/bin/cryptobot cycle
```

**6. Deja el bot corriendo** (ciclo cada 20 min, vigilante y Telegram):

```bash
.venv/bin/cryptobot run
```

### Otros comandos

| Comando | Para qué |
|---|---|
| `cryptobot status` | modelo campeón, régimen por cripto, cartera, track record |
| `cryptobot mark <id> --price 61234.5` | registrar que ejecutaste una recomendación (o `--skip`) |
| `cryptobot demo` | regenerar los datos de demostración del panel |
| `cryptobot run --fast 30` | ciclo cada 30 s (solo para probar) |

### 24/7 con Docker (tu PC o un VPS de ~5 USD/mes)

Desde `trading-bot/`, después de crear `.env`:

```bash
docker compose up -d --build
```

```bash
docker compose run --rm engine cryptobot download
```

```bash
docker compose run --rm engine cryptobot research --profile lemon
```

```bash
docker compose logs -f engine
```

El servidor **no abre puertos**: solo hace conexiones salientes (datos públicos, Telegram, Supabase).

## Telegram (avisos al celular)

1. Crea un bot con **@BotFather** y copia el token en `CRYPTOBOT_TELEGRAM_BOT_TOKEN`.
2. Escríbele "hola" a tu bot. Luego abre `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia tu `chat.id` en `CRYPTOBOT_TELEGRAM_CHAT_ID`.
3. Recibirás:
   - las recomendaciones con botones **✅ La ejecuté** / **❌ No la ejecuté**;
   - las alertas de stop y objetivo;
   - un resumen diario.
4. Comandos disponibles: `/estado`, `/cartera`, `/precio <id> <precio>`, `/capital <USD>`, `/pausa`, `/reanudar`, `/emergencia`, `/ayuda`.

El bot **solo responde a tu chat**.

## Panel web (opcional, Vercel + Supabase)

1. Crea un proyecto **nuevo** en Supabase (no el de sempiterno).
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor.
3. Registra tu usuario y agrégalo como dueño: `insert into app_owners (user_id) values ('<id>');`.
4. Configura el motor con `CRYPTOBOT_STORE=supabase`, `CRYPTOBOT_SUPABASE_URL` y `CRYPTOBOT_SUPABASE_SERVICE_KEY` (la clave de servicio solo vive en el servidor).
5. Despliega `dashboard/` en Vercel con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la clave anónima, protegida por RLS). Activa la verificación en dos pasos desde *Ajustes*.

Sin Supabase, el panel corre en **modo demo**:

```bash
cd dashboard && npm install && npm run dev
```

## Conector por API (Fase 5, desactivado)

Para ejecutar solo en un exchange con API (Binance por defecto; cualquiera de `ccxt`), se necesita todo esto a la vez:

- `CRYPTOBOT_ENABLE_LIVE_API=true`;
- claves con **retiros desactivados**, lista blanca de IP y subcuenta;
- empezar en **testnet** (`CRYPTOBOT_API_SANDBOX=true`);
- cambiar el modo desde el panel escribiendo `ACEPTO EL RIESGO`.

Primero `semi_auto_api` (botón ⚡ Ejecutar) y recién después `auto_api`. El capital debe estar en ese exchange: Lemon no tiene API pública de trading.

## Verificación

Desde `engine/`:

```bash
.venv/bin/pytest -q
```

Son 51 pruebas:
- anti *look-ahead*;
- paseo aleatorio sin ventaja;
- PBO y DSR;
- tamaño de posición con *hypothesis*;
- **paridad exacta** entre el bot en vivo (repetido cada 20 min) y el backtest;
- integraciones simuladas (Telegram, Supabase, ccxt).

El CI ([`.github/workflows/trading-bot-ci.yml`](../.github/workflows/trading-bot-ci.yml)) corre lint, tests y el build del panel.

## Estructura

```
trading-bot/
├── engine/src/cryptobot/
│   ├── data/        descarga, calidad, barras de 20m, almacenamiento
│   ├── features/    29 variables sin mirar el futuro
│   ├── regime/      HMM filtrado + reglas + euforia + eventos macro (macro_events.csv)
│   ├── labeling/    CUSUM y triple barrera (netas de costos y demora de Lemon)
│   ├── models/      señal primaria, meta-modelo LightGBM, ranking, registro
│   ├── validation/  walk-forward purgado, Sharpe/PSR/DSR, PBO, bootstrap, calibración
│   ├── strategy/    motor de decisión único (backtest = vivo), tamaño y riesgo
│   ├── backtest/    ejecución realista, backtester, baselines, investigación, reporte
│   ├── recommend/   recomendaciones, vencimiento, track record
│   ├── execution/   brokers Manual (Lemon), Paper y ccxt (API)
│   ├── runtime/     ciclo, vigilante, comandos, scheduler, demo
│   └── notify/      Telegram y mensajes en español
├── dashboard/       panel React (7 secciones, PWA, modo demo)
├── supabase/        esquema + RLS
└── docs/            investigación y runbook
```
