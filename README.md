# 🐭 Sempiterno | Nuestro Archivo de Amor & Aventuras

**Sempiterno** es una aplicación web interactiva, responsive (*Mobile-First*) y con estética **Neo-Brutalismo Cálido**, diseñada para que una pareja guarde sus recuerdos más preciados, registre citas pasadas y planee futuras salidas y viajes.

---

## 🎨 Identidad Visual y Estilo (UI/UX)

* **Estética:** Neo-brutalismo minimalista cálido con bordes gruesos (`border-2` y `border-3` en `#181B23`), esquinas redondeadas (`rounded-2xl`, `rounded-3xl`) y sombras duras sin difuminar (`shadow-[4px_4px_0px_#181B23]`) con efecto de presión táctil al hacer click (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`).
* **Paleta de Colores:**
  * Fondo Crema Cálido (`#FFFDF7`) y Modo Noche en Azul Noche Profundo (`#181B23`).
  * Acento Coral Cálido (`#FF6E61`).
  * Rosa Pastel Cálido (`#FFB5A7`) y Amarillo Mantequilla (`#FDE68A`).
  * Bordes y textos Carbón Oscuro (`#181B23`).
* **Tipografía:** *Space Grotesk* para encabezados con personalidad y peso, y *Plus Jakarta Sans* para lectura limpia.
* **Easter Eggs & Guiños a Topo Gigio y Rosita:**
  * Iconos con orejitas redondas de ratón y el gorrito de dormir de Gigio / moño de Rosita en los perfiles.
  * Selector dinámico de quién está navegando (Gigio 🐭 vs Rosita 🎀).
  * Sistema de calificación intercambiable entre **Quesitos 🧀** y **Corazones ❤️**.
  * Easter Egg nocturno con modal: *"¡A la camita... a la camita!" 💤* con contador de besitos de buenas noches y confeti de corazones.
  * Ilustración oficial en la cabecera y avatares.

---

## 🌟 Módulos y Funcionalidades

### 1. Dashboard Principal ("Nuestro Presente")
* **Contador Sempiterno en Tiempo Real:** Años, Meses, Días, Horas, Minutos y Segundos que llevan juntos, con edición rápida de la fecha de inicio y badge con total de días de felicidad.
* **Próxima Cita Agendada:** Tarjeta con cuenta regresiva en vivo, fecha, hora, lugar, dress code y nota secreta sorpresa protegida.
* **Flashback Aleatorio ("Un recuerdo al azar"):** Tarjeta interactiva tipo Polaroid con cinta washi brutalista, previsualización de la doble perspectiva y botón para barajar otro recuerdo.
* **Acciones Rápidas:** Botones para registrar nuevo recuerdo, proponer plan o girar la ruleta.

### 2. Bitácora de Recuerdos ("El Archivo")
* **Vistas Conmutables:** Cuadrícula (Bento/Polaroid) y Línea de Tiempo (Timeline histórico).
* **Filtros por Categoría & Búsqueda:** Aniversario, Cena, Viaje, Plan Casero, Concierto/Salida.
* **Ficha de Recuerdo Completa:**
  * Título, fecha, lugar y galería de fotos.
  * **"Doble Perspectiva":** Cajas independientes para lo que sintió Gigio y lo que sintió Rosita de ese día.
  * Calificación con Quesitos 🧀 o Corazones ❤️.
  * Canción del día con enlace directo a Spotify.
  * Modales completos para crear, ver en detalle, editar y eliminar recuerdos.

### 3. Planificador y Bucket List ("Por Vivir")
* **Tablero Kanban de 3 Columnas:** `💡 Ideas & Antojos`, `📅 Agendados`, `🎉 ¡Vividos!`.
* **Filtros por Categoría y Presupuesto:** `$`, `$$`, `$$$`.
* **Conversión Directa:** Botón *"¡Convertir en Recuerdo!"* al marcar un plan como vivido, precargando automáticamente título, categoría y lugar en el modal de recuerdos.
* **Agendador de Citas:** Permite definir fecha, hora, dress code y notas sorpresa.

### 4. Directorio de Lugares ("Nuestros Rincones")
* **Pestañas:** `Todos`, `Visitados`, `Por conocer`.
* **Detalles de Cada Rincón:** Nombre, barrio/zona, rango de precio, plato favorito o recomendado (*"Lo que pedimos"*), reseña corta y veredicto de retorno (`¡Sí o sí!`, `Una vez basta`, `Pendiente de probar`).
* Modal para agregar y editar rincones favoritos.

### 5. Ruleta Decisora ("¿Qué hacemos hoy?")
* **Selector Aleatorio con Física:** Giro animado de la ruleta con sonido visual y explosión de confeti de celebración.
* **Filtros Previos:** Presupuesto (`$`, `$$`, `$$$`, cualquiera) y Ganas del día (`🏡 En casa`, `🍽️ Salir a comer`, `🌿 Aventura`).
* **Botón "¡Aceptamos el reto!":** Agenda automáticamente el plan seleccionado como próxima cita en el calendario.

### 6. Cápsulas del Tiempo ("Cartas al Futuro")
* **Mensajes Bloqueados con Candado:** Cartas para aniversarios, mudanzas o momentos especiales con fecha futura.
* **Cuenta Regresiva en Vivo:** Candado cerrado con días, horas, minutos y segundos restantes, más pista visible.
* **Desbloqueo Emocionante:** Al llegar la fecha (o con la llave secreta), la carta se abre con animación y confeti mostrando el texto manuscrito romántico.

### 7. Ajustes, Personalización y Respaldo de Datos
* Personalización de nombres y apodos de ambos (Paulo / Gigio 🐭 y Alexandra / Rosita 🎀).
* Modo Oscuro / Modo Crema Claro instantáneo.
* **Sincronización en la Nube con Supabase:**
  * Base de datos PostgreSQL en tiempo real gratuita con WebSockets.
  * Sincronización instantánea entre dispositivos para recuerdos, planes, rincones, cápsulas y besitos en vivo.
  * Almacenamiento de fotos en la nube mediante Supabase Storage.
* **PWA (Progressive Web App):** Instalable en iPhone y Android a pantalla completa ("Agregar a inicio"), con icono de Topo Gigio y Rosita.
* **Exportación e Importación JSON:** Copia de seguridad local para no perder nunca las memorias.
* Botón de restauración de datos de prueba románticos preconfigurados.

---

## ☁️ Conexión con Supabase (2 minutos)

1. Crea tu proyecto en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** en Supabase y ejecuta el script [`supabase-schema.sql`](./supabase-schema.sql).
3. Obtén tu `Project URL` y `Anon Key` desde **Project Settings > API**.
4. Configura las variables en tu archivo `.env` o en los ajustes de Vercel:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
   ```
5. ¡Listo! La app sincronizará en tiempo real todos los cambios de forma automática.

---

## 🚀 Cómo Ejecutar el Proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build
```
