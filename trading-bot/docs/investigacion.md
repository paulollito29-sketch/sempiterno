# Investigación: ¿se puede ganarle al mercado cripto con recomendaciones cada 20 minutos?

*Fecha: 26 de noviembre de 2026. Reportes completos: [`reportes/lemon-2020-2026.md`](reportes/lemon-2020-2026.md) y [`reportes/binance-2020-2026.md`](reportes/binance-2020-2026.md).*

## Resumen en 30 segundos

- **Con los costos de Lemon** (~0.7% por lado, ≈1.4% ida y vuelta), la estrategia **no tiene ventaja** tras costos.
  - El mejor bot quedó en **−1.4%** en casi 6 años fuera de muestra (Sharpe −0.18).
  - **No pasó la puerta de calidad.** El bot queda en **modo práctica**.
- **Con costos de exchange por API** (~0.13% por lado), la misma estrategia muestra una señal real pero **todavía no probada**:
  - **+9.6%**, Sharpe **0.77**, caída máxima de solo **−3.5%**.
  - La probabilidad de sobreajuste es baja (PBO 0.14) y es robusta a cambios de parámetros.
  - Pero el Deflated Sharpe (0.84) no llega al 0.95 exigido. **Tampoco aprobada.**
- **Comprar y mantener** las 10 criptos ganó **+760%**, con caídas de **−88%** por el camino (y con sesgo de supervivencia, ver *Limitaciones*).
- **Conclusión práctica:** los **costos deciden**. Con Lemon, lo razonable es operar **muy poco**: usar el bot como **monitor de riesgo** (régimen de mercado, alertas de estrés y de stops) y seguir midiendo en modo práctica. No conviene esperar ganancias de operar seguido.

## 1. Qué dice la literatura (y cómo lo usa el bot)

| Factor | Evidencia | Uso en el bot |
|---|---|---|
| Tendencia / momentum (días–semanas) | Liu & Tsyvinski (RFS 2021); Liu, Tsyvinski & Wu (JF 2022); Detzel et al. (2021); Hudson & Urquhart (2021); Fieberg et al. (JFQA 2025) | Señal primaria: voto de tendencia 1d/3d/7d/30d, precio vs. medias, rupturas |
| Volatilidad y regímenes (muy predecibles) | Corsi (2009) HAR; Katsiampa (2017); Ardia et al. (2019); Moreira & Muir (2017) | Tamaño de posición, stops escalados, HMM de 3 regímenes |
| Flujo de órdenes (segundos–minutos) | Cont, Kukanov & Stoikov (2014); Silantyev (2019); Easley et al. (2024) | % de compras agresivas (contexto, no señal principal) |
| Apalancamiento | Schmeling, Schrimpf & Todorov (BIS 2023): carry alto predice caídas | Funding como alerta de "euforia" |
| Sentimiento | Liu & Tsyvinski (búsquedas); Kristoufek (2013); Lopez-Lira & Tang | Fear & Greed |
| Costos vs. horizonte | Jaquart, Dann & Weinhardt (2021): ganancias de minutos desaparecen tras costos | Horizonte de días–semanas en Lemon |
| Sobreajuste | Bailey et al. (2014, 2017); Bailey & López de Prado (2014); Harvey, Liu & Zhu (2016) | Walk-forward purgado, DSR, PBO, puerta de calidad |

## 2. Datos

| | |
|---|---|
| Criptos | BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, DOT (pares USDT de Binance) |
| Período | 1-ene-2020 → 26-nov-2026; SOL, AVAX y DOT desde su listado (2020) |
| Volumen de datos | ~7 millones de velas de 5 min → barras de 20 min |
| Contexto | Funding de futuros y Fear & Greed (desde 2018) |
| Huecos | Los cortes de Binance (≈460 velas en 6 años) quedan como NaN: el bot no decide con datos incompletos |

## 3. Metodología

1. **Features sin mirar el futuro.** 29 variables. Un test comprueba que el valor en t es idéntico al que se obtiene con datos cortados en t.
2. **Régimen.** HMM gaussiano re-estimado cada mes **solo con el pasado**, con probabilidades filtradas.
3. **Eventos y etiquetas.**
   - Filtro CUSUM (movimientos significativos).
   - Triple barrera con costos reales y **demora de ejecución manual de Lemon**: se ejecuta 40 min después, al peor precio de esa ventana.
   - Stops ejecutados a mano tras la alerta.
   - Si stop y objetivo caen en la misma barra, cuenta el peor caso.
4. **Meta-modelo.** LightGBM calibrado que decide si vale la pena cada señal de la regla. Opera solo si el valor esperado neto de costos es positivo.
5. **Walk-forward trimestral con purga.** Entrena solo con etiquetas resueltas antes de cada tramo de prueba. Fuera de muestra desde el 31-dic-2020.
6. **Mismo motor que en vivo.** Una prueba de paridad confirma que el bot en vivo (ciclo cada 20 min) produce exactamente las mismas operaciones que el backtest.
7. **Comparación neta de costos** contra comprar y mantener, vol targeting, cruce de medias y DCA.
8. **Estadística de sobreajuste.**
   - 12 variantes probadas, todas contadas.
   - Deflated Sharpe, PBO por CSCV y t-stat (umbral de Harvey, Liu & Zhu).
   - Bootstrap del drawdown y calibración.

## 4. Resultados (fuera de muestra, dic-2020 → nov-2026)

| Estrategia | Lemon: retorno / Sharpe / caída | Binance API: retorno / Sharpe / caída |
|---|---|---|
| **Bot (regla + modelo)** | −1.4% / −0.18 / −5.2% | **+9.6% / 0.77 / −3.5%** |
| Bot (solo regla) | −8.9% / −0.85 / −11.9% | +7.0% / 0.43 / −5.3% |
| Comprar y mantener | +760% / 0.85 / −88% | +764% / 0.85 / −88% |
| Comprar y mantener + vol targeting | +140% / 0.58 / −54% | +158% / 0.62 / −54% |
| Cruce de medias 20/100 | +11% / 0.29 / −75% | +28% / 0.34 / −74% |
| DCA semanal | −6.8% / 0.18 / −67% | −6.3% / 0.18 / −67% |
| Deflated Sharpe (exige ≥ 0.95) | 0.04 | 0.84 |
| PBO (exige ≤ 0.20) | 0.22 | **0.14** |
| Sharpe mediano de las 12 variantes | −0.48 | **0.61** |
| Operaciones / tenencia media | ~11 por mes (10 criptos) / 5.9 días | ~32 por mes / 1.7 días |

**Cómo leerlo:**
- **El modelo de ML sí aporta.** En ambos perfiles mejora a la regla sola: −1.4% vs. −8.9%, y 0.77 vs. 0.43 de Sharpe. Descarta muchas señales malas: la curva queda plana en 2022–2023.
- **Con costos bajos hay señal.** El Sharpe es positivo en la mayoría de las variantes, el PBO es bajo y la caída máxima es mínima. Pero no alcanza la exigencia estadística: un Sharpe de 0.77 en ~6 años todavía es compatible con suerte, después de probar 12 variantes.
- **Con costos de Lemon, la señal se la comen los costos.** Es lo que anticipaba la tabla de "acierto mínimo para no perder" del plan.
- **El bot arriesga poco** (exposición media ~17%; 1% de riesgo por operación). Por eso su retorno absoluto es chico: su objetivo es buen retorno *por unidad de riesgo*, no ganarle en retorno bruto a un mercado alcista.
- **La calibración no es perfecta.** En el tramo más alto, el modelo es demasiado optimista: dijo 56–58% y acertó 36–51%. El panel lo muestra en *Historial*.

## 5. Qué significa para ti

1. **Lemon + esta estrategia:** no operar con dinero real.
   - Úsalo como **monitor**: régimen por cripto, avisos de estrés, alertas de stop, track record en práctica.
   - La regla más valiosa hoy es la defensiva: **en régimen de estrés, quedarse en USDT**.
2. **Si quieres automatizar en serio,** la señal vive donde los costos son bajos (exchange por API).
   - Está igual de **no aprobada**.
   - Camino correcto: semanas de práctica → testnet → poco dinero → solo si la puerta se aprueba con datos nuevos.
3. **Comprar y mantener tuvo más retorno, pero con −88% de caída.** Si tu objetivo es largo plazo con poco trabajo, DCA o comprar y mantener con vol targeting son alternativas honestas. El bot puede ayudarte a **no comprar en régimen de estrés**.

## 6. Limitaciones

- **Sesgo de supervivencia.** Las 10 criptos se eligieron por ser grandes *hoy*. Las que murieron (LUNA, FTT…) no están. Eso infla sobre todo a comprar y mantener.
- **Costos de Lemon supuestos** (0.5% + spread 0.1% + deslizamiento por lado). Mídelos con la calculadora del panel.
- **Funding y open interest.** El funding se usa como feature; el open interest y el libro de órdenes recién se empiezan a guardar.
- **Un solo exchange de referencia.** Los precios son de Binance; los de Lemon pueden diferir.
- **Mercado adaptativo** (Lo 2004; McLean & Pontiff 2016): toda ventaja tiende a desaparecer. Hay que reentrenar y revalidar.

## 7. Próximos pasos de investigación

1. **Asignación semanal por tendencia con vol targeting.** Encaja con los costos de Lemon: pocas operaciones grandes en vez de muchas chicas. El baseline de vol targeting ya muestra Sharpe ~0.6.
2. **Ranking entre criptos** (momentum cross-section, tipo CTREND de Fieberg et al. 2025) en vez de una señal por cripto.
3. **Universo sin sesgo de supervivencia** (criptos según su capitalización *en cada fecha*).
4. **Sentimiento de noticias con LLM** como variable adicional (con hora exacta de cada titular, sin mirar el futuro) y datos on-chain.
5. **Reentrenamiento periódico.** Correr `cryptobot research` cada mes y comparar el campeón con un retador.

Todo cambio debe pasar **la misma puerta de calidad**.

## Referencias principales

- Liu & Tsyvinski (2021), *Risks and Returns of Cryptocurrency*, RFS 34(6).
- Liu, Tsyvinski & Wu (2022), *Common Risk Factors in Cryptocurrency*, JF 77(2).
- Detzel, Liu, Strauss, Zhou & Zhu (2021), *Learning and predictability via technical analysis*, Financial Management 50(1).
- Hudson & Urquhart (2021), *Technical trading and cryptocurrencies*, Annals of OR 297.
- Fieberg, Liedtke, Poddig, Walker & Zaremba (2025), *A Trend Factor for the Cross Section of Cryptocurrency Returns*, JFQA 60(7).
- Jaquart, Dann & Weinhardt (2021), *Short-term bitcoin market prediction via machine learning*, JFDS 7.
- Schmeling, Schrimpf & Todorov (2023), *Crypto carry*, BIS WP 1087.
- Cong, Li, Tang & Yang (2023), *Crypto Wash Trading*, Management Science 69(11).
- Corsi (2009), Katsiampa (2017), Ardia, Bluteau & Rüede (2019), Moreira & Muir (2017).
- López de Prado (2018), *Advances in Financial Machine Learning*.
- Bailey & López de Prado (2014), *The Deflated Sharpe Ratio*. Bailey, Borwein, López de Prado & Zhu (2014, 2017).
- Harvey, Liu & Zhu (2016), *…and the Cross-Section of Expected Returns*, RFS 29(1).
- Rahimikia, Ni & Wang (2025), *Re(Visiting) Time Series Foundation Models in Finance*; Li et al. (2024), *CryptoTrade*.
- Lo (2004), *The Adaptive Markets Hypothesis*; McLean & Pontiff (2016).
