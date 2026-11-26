# Runbook: qué hacer si…

**Regla de oro:** ante cualquier duda, **pausa** (botón en el panel o `/pausa` en Telegram). Pausar solo frena las compras nuevas: el vigilante sigue avisando de tus stops.

| Situación | Qué hacer |
|---|---|
| **El mercado colapsa / algo se ve mal** | Botón **Emergencia** en el panel o `/emergencia` en Telegram: pausa y recomienda vender todo. En Lemon, vende a mano. |
| **No llegan avisos a Telegram** | 1) `docker compose logs -f engine` 2) Revisa `CRYPTOBOT_TELEGRAM_BOT_TOKEN` / `CHAT_ID` 3) Escríbele `/estado` a tu bot. Si no responde, el proceso está caído: `docker compose up -d`. |
| **El panel dice "Sin señal del bot"** | El último latido tiene más de 45 min. Revisa que el servidor esté encendido y con internet; `docker compose ps`. |
| **"Datos desactualizados" en un ciclo** | Binance no respondió: el bot NO recomienda con datos viejos. Se resuelve solo; si persiste, revisa la red del servidor (región permitida por Binance). |
| **Modo defensivo** | Se superó la caída máxima o la pérdida diaria. No compra hasta que se recupere el día (pérdida diaria) o hasta que reanudes tras revisar (caída máxima). |
| **Ejecuté a otro precio en Lemon** | `/precio <id> <precio>` en Telegram o el diálogo "La ejecuté" del panel: stop y objetivo se recalculan desde tu precio. |
| **Compré/vendí por fuera del bot** | Panel → Cartera → Agregar/editar (o comando `set_holding`). |
| **Cambiar el capital** | Panel → Cartera → Capital, o `/capital 1500`. |
| **Reentrenar el modelo** | `cryptobot research --profile lemon` (semanal o mensual). Solo reemplaza al campeón si pasa la puerta de calidad. |
| **Actualizar eventos macro (FOMC/CPI)** | Edita `engine/src/cryptobot/regime/macro_events.csv` con fechas **verificadas** en las fuentes oficiales. |
| **Rotar claves de API** (modo API) | Crea claves nuevas (retiros desactivados, IP fija), actualiza `.env`, `docker compose up -d`, y borra las viejas en el exchange. |
| **Pasar a dinero real** | Solo si: la puerta de calidad está aprobada **y** 4–8 semanas de práctica con track record coherente **y** 1–3 meses con poco dinero. Nunca antes. |

## Chequeo semanal (5 minutos)

1. Panel → **Historial**: ¿las probabilidades se cumplen (calibración)? ¿el track record va en línea con el backtest?
2. Panel → **Backtests**: ¿el último reporte sigue sin aprobar? Si no aprueba, seguir en práctica.
3. Panel → **Modelos → Registro de eventos**: errores repetidos.
4. Costos reales de Lemon (Ajustes → calculadora): si suben, el bot debe operar aún menos.
