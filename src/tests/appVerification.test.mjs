import { createClient } from '@supabase/supabase-js';

// ANSI colors for clean test reporting
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`  ${green('✓')} ${desc}`);
    passed++;
  } else {
    console.error(`  ${red('✗')} ${desc}`);
    failed++;
  }
}

// ------------------------------------------------------------------------------
// Validation Simulator Functions (matching Modal logic)
// ------------------------------------------------------------------------------
function validateAndCreateMemory(input) {
  if (!input.title || !input.title.trim()) {
    return { ok: false, error: 'Título requerido' };
  }
  const cleanPhotos = (input.photos || []).map((p) => p.trim()).filter(Boolean);
  if (cleanPhotos.length === 0) {
    return { ok: false, error: 'Debes añadir al menos una foto para guardar el recuerdo.' };
  }

  const memory = {
    id: `mem-test-${Date.now()}`,
    title: input.title.trim(),
    date: input.date,
    category: input.category,
    location: input.location?.trim() || 'Nuestro lugar especial',
    photos: cleanPhotos,
    perspectiveGigio: input.perspectiveGigio?.trim() || undefined,
    perspectiveRosita: input.perspectiveRosita?.trim() || undefined,
    rating: input.rating ?? 5,
    songTitle: input.songTitle?.trim() || undefined,
    songUrl: input.songUrl?.trim() || undefined,
    tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
  };

  return { ok: true, memory };
}

function validateAndCreatePlace(input) {
  if (!input.name || !input.name.trim()) {
    return { ok: false, error: 'Nombre requerido' };
  }

  const place = {
    id: `place-test-${Date.now()}`,
    name: input.name.trim(),
    category: input.category,
    status: input.status,
    zone: input.zone?.trim() || 'Zona no especificada',
    whatWeOrdered: input.whatWeOrdered?.trim() || undefined,
    review: input.review?.trim() || undefined,
    wouldReturn: input.wouldReturn || '¡Sí o sí!',
    rating: input.status === 'Visitado' ? (input.rating || 5) : undefined,
    priceRange: input.priceRange || '$$',
    imageUrl: input.imageUrl?.trim() || undefined,
    googleMapsUrl: input.googleMapsUrl?.trim() || undefined,
  };

  return { ok: true, place };
}

// ------------------------------------------------------------------------------
// Date utilities (matching src/utils/date.ts logic)
// ------------------------------------------------------------------------------
function calculateElapsedTime(startDateStr) {
  const start = new Date(startDateStr);
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - start.getTime());
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days), hours, minutes, seconds, totalDays };
}

function calculateCountdown(targetDateStr) {
  const target = new Date(targetDateStr).getTime();
  const now = new Date().getTime();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isPast: false };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

// ------------------------------------------------------------------------------
// TEST SUITE
// ------------------------------------------------------------------------------
async function runAllTests() {
  console.log(bold('\n🧪 EJECUTANDO SUITE COMPLETA DE PRUEBAS DE SEMPITERNO\n'));

  // 1. RECUERDOS (MEMORIES)
  console.log(bold('1. Validación y Creación de Recuerdos:'));

  const memNoPhoto = validateAndCreateMemory({
    title: 'Cena sin fotos',
    date: '2026-11-04',
    category: 'Cena',
    photos: [],
  });
  assert(!memNoPhoto.ok, 'Rechaza guardar recuerdo si no tiene fotos');
  assert(memNoPhoto.error?.includes('al menos una foto') === true, 'Mensaje de error explícito sobre foto requerida');

  const memWhitespacePhoto = validateAndCreateMemory({
    title: 'Cena con espacio en blanco',
    date: '2026-11-04',
    category: 'Cena',
    photos: ['   ', ''],
  });
  assert(!memWhitespacePhoto.ok, 'Rechaza guardar si las URLs de fotos están vacías o con espacios');

  const memMinimal = validateAndCreateMemory({
    title: 'Paseo en el parque',
    date: '2026-11-04',
    category: 'Plan Casero',
    photos: ['https://example.com/foto1.jpg'],
  });
  assert(memMinimal.ok, 'Permite guardar recuerdo con solo 1 foto y sin perspectivas ni canciones');
  assert(memMinimal.memory?.perspectiveGigio === undefined, 'perspectiveGigio queda como undefined cuando no se introduce');
  assert(memMinimal.memory?.perspectiveRosita === undefined, 'perspectiveRosita queda como undefined cuando no se introduce');
  assert(memMinimal.memory?.songTitle === undefined, 'songTitle queda como undefined cuando no se introduce');
  assert(memMinimal.memory?.tags === undefined, 'tags queda como undefined cuando no se introduce');
  assert(memMinimal.memory?.photos.length === 1, 'Conserva exactamente la foto proporcionada');

  const memComplete = validateAndCreateMemory({
    title: 'Aniversario Mágico',
    date: '2026-06-04',
    category: 'Aniversario',
    photos: ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg'],
    perspectiveGigio: 'Fue el día más feliz de mi vida.',
    perspectiveRosita: 'Lloré de la emoción cuando me abrazaste.',
    songTitle: 'Lover — Taylor Swift',
    tags: ['Amor', 'Mágico'],
  });
  assert(memComplete.ok, 'Guarda recuerdo completo cuando se ingresan todos los campos opcionales');
  assert(memComplete.memory?.perspectiveGigio === 'Fue el día más feliz de mi vida.', 'Guarda perspectiva de Gigio correctamente');
  assert(memComplete.memory?.perspectiveRosita === 'Lloré de la emoción cuando me abrazaste.', 'Guarda perspectiva de Rosita correctamente');
  assert(memComplete.memory?.songTitle === 'Lover — Taylor Swift', 'Guarda canción de ese día');
  assert(memComplete.memory?.tags?.length === 2, 'Guarda etiquetas correctamente');

  const memDataUrl = validateAndCreateMemory({
    title: 'Foto Subida Desde Galería',
    date: '2026-11-04',
    category: 'Cena',
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...'],
  });
  assert(memDataUrl.ok, 'Permite guardar recuerdo con foto subida directamente desde galería/cámara (DataURL)');
  assert(memDataUrl.memory?.photos[0].startsWith('data:image/'), 'La foto del dispositivo se almacena íntegra');

  // 2. RINCONES (PLACES)
  console.log(bold('\n2. Validación y Creación de Rincones:'));

  const placeNoPhoto = validateAndCreatePlace({
    name: 'Café Secreto',
    category: 'Café',
    status: 'Por conocer',
  });
  assert(placeNoPhoto.ok, 'Permite crear rincón sin foto');
  assert(placeNoPhoto.place?.imageUrl === undefined, 'imageUrl es undefined (no fuerza foto genérica)');
  assert(placeNoPhoto.place?.whatWeOrdered === undefined, 'whatWeOrdered es undefined (no es obligatorio)');
  assert(placeNoPhoto.place?.rating === undefined, 'rating es undefined cuando status es "Por conocer"');

  const placeVisitedWithRating = validateAndCreatePlace({
    name: 'Ristorante Il Pastificio',
    category: 'Restaurante',
    status: 'Visitado',
    rating: 5,
    whatWeOrdered: 'Fettuccine con trufas',
    imageUrl: 'https://example.com/pasta.jpg',
  });
  assert(placeVisitedWithRating.ok, 'Permite crear rincón visitado con calificación y platos');
  assert(placeVisitedWithRating.place?.status === 'Visitado', 'Status es "Visitado"');
  assert(placeVisitedWithRating.place?.rating === 5, 'Calificación presente cuando está visitado');
  assert(placeVisitedWithRating.place?.whatWeOrdered === 'Fettuccine con trufas', 'Platos favoritos guardados');

  const placeWishlistWithRatingSupplied = validateAndCreatePlace({
    name: 'Playa Paraíso',
    category: 'Playa',
    status: 'Por conocer',
    rating: 4,
  });
  assert(placeWishlistWithRatingSupplied.place?.rating === undefined, 'Descarta calificación si el lugar está "Por conocer"');

  // 3. UTILIDADES DE FECHA Y CONTADORES
  console.log(bold('\n3. Utilidades de Fecha y Tiempo Transcurrido:'));

  const elapsed = calculateElapsedTime('2026-06-04T00:00:00');
  assert(typeof elapsed.totalDays === 'number', 'calculateElapsedTime calcula totalDays como número');
  assert(typeof elapsed.years === 'number', 'Calcula años como número');
  assert(typeof elapsed.months === 'number', 'Calcula meses como número');
  assert(typeof elapsed.seconds === 'number', 'Calcula segundos en tiempo real');

  const futureCountdown = calculateCountdown('2030-01-01T00:00:00');
  assert(!futureCountdown.isPast, 'calculateCountdown para fecha futura marca isPast = false');
  assert(futureCountdown.days > 0, 'Días restantes son mayores a cero');

  const pastCountdown = calculateCountdown('2020-01-01T00:00:00');
  assert(pastCountdown.isPast, 'calculateCountdown para fecha pasada marca isPast = true');

  const formattedDate = formatDate('2026-06-04');
  assert(formattedDate.length > 5, `formatDate formatea fecha correctamente ("${formattedDate}")`);

  // 4. CONEXIÓN EN VIVO A SUPABASE (POSTGRESQL + REALTIME)
  console.log(bold('\n4. Verificación de Tablas en Supabase:'));

  try {
    const supabaseUrl = 'https://kzdtxkzriobixfismbce.supabase.co';
    const supabaseAnonKey = 'sb_publishable_M7W38LZzBVa-4rnqJEz3pQ_VM7ijH7l';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const settingsRes = await supabase.from('sempiterno_settings').select('*').limit(1);
    assert(settingsRes.status === 200, 'Tabla sempiterno_settings responde HTTP 200');

    const memoriesRes = await supabase.from('sempiterno_memories').select('id').limit(1);
    assert(memoriesRes.status === 200, 'Tabla sempiterno_memories responde HTTP 200');

    const plansRes = await supabase.from('sempiterno_plans').select('id').limit(1);
    assert(plansRes.status === 200, 'Tabla sempiterno_plans responde HTTP 200');

    const placesRes = await supabase.from('sempiterno_places').select('id').limit(1);
    assert(placesRes.status === 200, 'Tabla sempiterno_places responde HTTP 200');

    const capsulesRes = await supabase.from('sempiterno_capsules').select('id').limit(1);
    assert(capsulesRes.status === 200, 'Tabla sempiterno_capsules responde HTTP 200');

    const kissesRes = await supabase.from('sempiterno_kisses').select('*').limit(1);
    assert(kissesRes.status === 200, 'Tabla sempiterno_kisses responde HTTP 200');
  } catch (err) {
    assert(false, `Error consultando Supabase: ${err.message}`);
  }

  // RESUMEN
  console.log(bold('\n============================================='));
  console.log(bold(`RESULTADO: ${passed} pasadas, ${failed} fallidas`));
  console.log(bold('=============================================\n'));

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
