import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Music, 
  Grid, 
  List, 
  Search, 
  Plus, 
  ChevronRight, 
  Heart, 
  Edit2, 
  Trash2, 
  ExternalLink,
  X,
  Sparkles
} from 'lucide-react';
import { Memory, MemoryCategory, CoupleSettings } from '../types';
import { RatingDisplay } from './RatingDisplay';
import { MouseEarsIcon } from './TopoEarsIcon';
import { formatDate } from '../utils/date';

interface MemoriesViewProps {
  memories: Memory[];
  settings: CoupleSettings;
  onOpenNewMemory: () => void;
  onEditMemory: (memory: Memory) => void;
  onDeleteMemory: (memoryId: string) => void;
  selectedMemoryId?: string | null;
}

const CATEGORIES: ('Todos' | MemoryCategory)[] = [
  'Todos',
  'Aniversario',
  'Cena',
  'Viaje',
  'Plan Casero',
  'Concierto/Salida',
];

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  memories,
  settings,
  onOpenNewMemory,
  onEditMemory,
  onDeleteMemory,
  selectedMemoryId,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [activeCategory, setActiveCategory] = useState<'Todos' | MemoryCategory>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingMemory, setInspectingMemory] = useState<Memory | null>(() => {
    if (selectedMemoryId) {
      return memories.find((m) => m.id === selectedMemoryId) || null;
    }
    return null;
  });

  // Filter memories
  const filteredMemories = memories
    .filter((mem) => {
      const matchesCategory = activeCategory === 'Todos' || mem.category === activeCategory;
      const matchesSearch =
        mem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mem.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mem.perspectiveGigio.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mem.perspectiveRosita.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mem.tags && mem.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-6 shadow-neo">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h2 className="font-display text-2xl font-black text-carbon dark:text-cream">
              El Archivo de Recuerdos
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-carbon/70 dark:text-cream/70 font-medium mt-1">
            Cada instante compartido tiene su lugar en nuestra historia.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Switch Grid vs Timeline */}
          <div className="flex items-center border-2 border-carbon rounded-xl bg-cream dark:bg-nightSurface p-1 shadow-neo-sm">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-coral text-white shadow-xs'
                  : 'text-carbon dark:text-cream hover:bg-black/5'
              }`}
              title="Vista Bento / Polaroid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'timeline'
                  ? 'bg-coral text-white shadow-xs'
                  : 'text-carbon dark:text-cream hover:bg-black/5'
              }`}
              title="Vista Línea de Tiempo"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNewMemory}
            className="neo-btn-primary py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Recuerdo</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon/50 dark:text-cream/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por lugar, palabra clave o recuerdo..."
            className="neo-input w-full pl-10 text-xs sm:text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-coral"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 border-carbon transition-all whitespace-nowrap shadow-neo-sm ${
                activeCategory === cat
                  ? 'bg-coral text-white shadow-neo -translate-y-0.5'
                  : 'bg-white dark:bg-nightCard text-carbon dark:text-cream hover:bg-cream dark:hover:bg-nightSurface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 1. GRID / POLAROID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMemories.map((mem, index) => (
            <motion.div
              key={mem.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-nightCard border-3 border-carbon rounded-2xl p-4 shadow-neo flex flex-col justify-between group hover:-translate-y-1 transition-all duration-200"
            >
              <div>
                {/* Polaroid Photo with brutalist label */}
                <div 
                  className="w-full h-52 bg-carbon/10 rounded-xl overflow-hidden border-2 border-carbon mb-3 relative cursor-pointer"
                  onClick={() => setInspectingMemory(mem)}
                >
                  <img
                    src={mem.photos[0] || '/assets/gigio-rosita.jpg'}
                    alt={mem.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-2.5 right-2.5 bg-carbon/80 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-carbon">
                    {mem.photos.length > 1 ? `+${mem.photos.length - 1} fotos` : '1 foto'}
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 bg-butter text-carbon text-[10px] font-bold px-2 py-0.5 rounded border border-carbon">
                    {formatDate(mem.date)}
                  </div>
                </div>

                {/* Badges & Rating */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="neo-badge bg-rosePastel-light text-carbon text-[10px]">
                    {mem.category}
                  </span>
                  <RatingDisplay
                    rating={mem.rating}
                    type={settings.ratingStyle}
                    size="sm"
                  />
                </div>

                <h3 
                  className="font-display text-lg font-bold text-carbon dark:text-cream leading-snug cursor-pointer hover:text-coral transition-colors mb-1"
                  onClick={() => setInspectingMemory(mem)}
                >
                  {mem.title}
                </h3>

                <div className="flex items-center gap-1 text-xs text-carbon/70 dark:text-cream/70 font-medium mb-3">
                  <MapPin className="w-3.5 h-3.5 text-coral shrink-0" />
                  <span className="truncate">{mem.location}</span>
                </div>

                {/* Dual perspectives previews */}
                <div className="space-y-1.5 bg-cream/70 dark:bg-nightSurface/70 border border-carbon rounded-xl p-2.5 text-xs text-carbon/80 dark:text-cream/80">
                  <p className="line-clamp-1 italic">
                    <strong className="text-coral">Gigio:</strong> "{mem.perspectiveGigio}"
                  </p>
                  <p className="line-clamp-1 italic">
                    <strong className="text-coral">Rosita:</strong> "{mem.perspectiveRosita}"
                  </p>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-carbon/20">
                <button
                  type="button"
                  onClick={() => setInspectingMemory(mem)}
                  className="text-xs font-bold text-coral hover:underline flex items-center gap-1"
                >
                  Ver detalle completo <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditMemory(mem)}
                    className="p-1.5 border border-carbon rounded-lg bg-cream dark:bg-nightSurface hover:bg-butter text-carbon dark:text-cream"
                    title="Editar recuerdo"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar el recuerdo "${mem.title}"?`)) {
                        onDeleteMemory(mem.id);
                      }
                    }}
                    className="p-1.5 border border-carbon rounded-lg bg-rosePastel-light hover:bg-rosePastel text-carbon"
                    title="Eliminar recuerdo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 2. TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="relative border-l-3 border-carbon ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-8">
          {filteredMemories.map((mem, index) => (
            <motion.div
              key={mem.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative"
            >
              {/* Timeline dot */}
              <div className="absolute -left-[35px] sm:-left-[43px] top-1.5 w-6 h-6 rounded-full bg-coral border-3 border-carbon flex items-center justify-center text-[10px] text-white shadow-neo-sm font-bold">
                ♥
              </div>

              <div className="bg-white dark:bg-nightCard border-3 border-carbon rounded-2xl p-5 shadow-neo">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="neo-badge bg-butter text-carbon text-xs">
                      {formatDate(mem.date)}
                    </span>
                    <span className="neo-badge bg-rosePastel-light text-carbon text-xs">
                      {mem.category}
                    </span>
                  </div>
                  <RatingDisplay
                    rating={mem.rating}
                    type={settings.ratingStyle}
                    size="sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-4">
                    <div 
                      className="w-full h-44 rounded-xl overflow-hidden border-2 border-carbon cursor-pointer"
                      onClick={() => setInspectingMemory(mem)}
                    >
                      <img
                        src={mem.photos[0] || '/assets/gigio-rosita.jpg'}
                        alt={mem.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-8 space-y-3">
                    <h3 
                      className="font-display text-xl font-bold text-carbon dark:text-cream cursor-pointer hover:text-coral"
                      onClick={() => setInspectingMemory(mem)}
                    >
                      {mem.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs font-semibold text-carbon/70 dark:text-cream/70">
                      <MapPin className="w-3.5 h-3.5 text-coral" />
                      <span>{mem.location}</span>
                      {mem.songTitle && (
                        <>
                          <span>•</span>
                          <Music className="w-3.5 h-3.5 text-coral" />
                          <span className="text-coral truncate font-bold">{mem.songTitle}</span>
                        </>
                      )}
                    </div>

                    {/* Dual Perspectives */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-cream dark:bg-nightSurface border border-carbon rounded-xl p-3">
                      <div>
                        <span className="font-bold text-coral flex items-center gap-1 mb-1">
                          <MouseEarsIcon type="gigio" size={14} /> Gigio:
                        </span>
                        <p className="italic text-carbon/80 dark:text-cream/80">
                          "{mem.perspectiveGigio}"
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-coral flex items-center gap-1 mb-1">
                          <MouseEarsIcon type="rosita" size={14} /> Rosita:
                        </span>
                        <p className="italic text-carbon/80 dark:text-cream/80">
                          "{mem.perspectiveRosita}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setInspectingMemory(mem)}
                        className="neo-btn-secondary text-xs py-1.5 px-3"
                      >
                        Ver recuerdo completo
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditMemory(mem)}
                          className="p-1.5 border border-carbon rounded-lg bg-cream dark:bg-nightCard hover:bg-butter"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-carbon dark:text-cream" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar "${mem.title}"?`)) {
                              onDeleteMemory(mem.id);
                            }
                          }}
                          className="p-1.5 border border-carbon rounded-lg bg-rosePastel-light hover:bg-rosePastel"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-carbon" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredMemories.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-nightCard border-3 border-dashed border-carbon rounded-3xl p-8">
          <span className="text-4xl block mb-2">🔍</span>
          <h3 className="font-display text-lg font-bold text-carbon dark:text-cream">
            No se encontraron recuerdos con estos filtros
          </h3>
          <p className="text-xs text-carbon/60 dark:text-cream/60 mt-1 mb-4">
            Prueba buscando con otra palabra o añade uno nuevo para este momento.
          </p>
          <button
            type="button"
            onClick={onOpenNewMemory}
            className="neo-btn-primary text-xs py-2 px-4"
          >
            Añadir Recuerdo Nuevo
          </button>
        </div>
      )}

      {/* INSPECT / FULL DETAIL MEMORY MODAL */}
      <AnimatePresence>
        {inspectingMemory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-8 shadow-neo-xl my-6 relative max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setInspectingMemory(null)}
                className="absolute top-4 right-4 p-2 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel shadow-neo-sm z-10"
              >
                <X className="w-4 h-4 text-carbon dark:text-cream" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="neo-badge bg-rosePastel text-carbon text-xs">
                  {inspectingMemory.category}
                </span>
                <span className="neo-badge bg-butter text-carbon text-xs">
                  {formatDate(inspectingMemory.date)}
                </span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-black text-carbon dark:text-cream mb-2">
                {inspectingMemory.title}
              </h2>

              <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-carbon/80 dark:text-cream/80">
                  <MapPin className="w-4 h-4 text-coral" />
                  <span>{inspectingMemory.location}</span>
                </div>
                <RatingDisplay
                  rating={inspectingMemory.rating}
                  type={settings.ratingStyle}
                  size="md"
                />
              </div>

              {/* Photo Collage / Gallery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {inspectingMemory.photos.map((photo, pIdx) => (
                  <div
                    key={pIdx}
                    className={`rounded-2xl overflow-hidden border-2 border-carbon shadow-neo-sm bg-carbon/5 ${
                      inspectingMemory.photos.length === 1 ? 'sm:col-span-2 max-h-80' : 'h-52'
                    }`}
                  >
                    <img
                      src={photo}
                      alt={`${inspectingMemory.title} ${pIdx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {/* DOBLE PERSPECTIVA BOXES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Gigio's Box */}
                <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 shadow-neo-sm relative">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-carbon/10">
                    <MouseEarsIcon type="gigio" size={22} />
                    <span className="font-bold text-sm text-carbon dark:text-cream">
                      Lo que sintió {settings.partner1.nickname} ({settings.partner1.name})
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-carbon/80 dark:text-cream/80 italic leading-relaxed">
                    "{inspectingMemory.perspectiveGigio}"
                  </p>
                </div>

                {/* Rosita's Box */}
                <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 shadow-neo-sm relative">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-carbon/10">
                    <MouseEarsIcon type="rosita" size={22} />
                    <span className="font-bold text-sm text-carbon dark:text-cream">
                      Lo que sintió {settings.partner2.nickname} ({settings.partner2.name})
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-carbon/80 dark:text-cream/80 italic leading-relaxed">
                    "{inspectingMemory.perspectiveRosita}"
                  </p>
                </div>
              </div>

              {/* Song Player / Link & Tags */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 shadow-neo-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-butter border-2 border-carbon flex items-center justify-center text-carbon shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-carbon/60 dark:text-cream/60 uppercase">
                      Canción de este día
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-coral">
                      {inspectingMemory.songTitle || 'Nuestra melodía favorita'}
                    </div>
                  </div>
                </div>

                {inspectingMemory.songUrl && (
                  <a
                    href={inspectingMemory.songUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="neo-btn-primary text-xs py-2 px-3 inline-flex items-center justify-center gap-1.5"
                  >
                    <span>Escuchar en Spotify</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Tags */}
              {inspectingMemory.tags && inspectingMemory.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs font-bold text-carbon/60 dark:text-cream/60">Etiquetas:</span>
                  {inspectingMemory.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[11px] font-bold bg-cream dark:bg-nightSurface border border-carbon px-2.5 py-0.5 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-6 pt-4 border-t-2 border-carbon/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setInspectingMemory(null)}
                  className="neo-btn-white text-xs py-2 px-4"
                >
                  Cerrar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const toEdit = inspectingMemory;
                      setInspectingMemory(null);
                      onEditMemory(toEdit);
                    }}
                    className="neo-btn-secondary text-xs py-2 px-3 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar este recuerdo?`)) {
                        onDeleteMemory(inspectingMemory.id);
                        setInspectingMemory(null);
                      }
                    }}
                    className="neo-btn-rose text-xs py-2 px-3 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
