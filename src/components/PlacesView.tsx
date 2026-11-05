import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Utensils, 
  ThumbsUp, 
  Star, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ExternalLink,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { Place, PlaceCategory, CoupleSettings } from '../types';
import { RatingDisplay } from './RatingDisplay';

interface PlacesViewProps {
  places: Place[];
  settings: CoupleSettings;
  onOpenNewPlace: () => void;
  onEditPlace: (place: Place) => void;
  onDeletePlace: (placeId: string) => void;
  onToggleStatus: (place: Place) => void;
}

const CATEGORIES: ('Todos' | PlaceCategory)[] = [
  'Todos',
  'Restaurante',
  'Café',
  'Playa',
  'Parque/Mirador',
  'Bar',
  'Aventura/Paseo',
];

export const PlacesView: React.FC<PlacesViewProps> = ({
  places,
  settings,
  onOpenNewPlace,
  onEditPlace,
  onDeletePlace,
  onToggleStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'Todos' | 'Visitado' | 'Por conocer'>('Todos');
  const [activeCategory, setActiveCategory] = useState<'Todos' | PlaceCategory>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const visitedCount = places.filter((p) => p.status === 'Visitado').length;
  const wishlistCount = places.filter((p) => p.status === 'Por conocer').length;

  const filteredPlaces = places.filter((p) => {
    const matchesTab = activeTab === 'Todos' || p.status === activeTab;
    const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.whatWeOrdered && p.whatWeOrdered.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.review && p.review.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-6 shadow-neo">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            <h2 className="font-display text-2xl font-black text-carbon dark:text-cream">
              Nuestros Rincones
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-carbon/70 dark:text-cream/70 font-medium mt-1">
            Los cafés, restaurantes, playas y miradores que guardan un pedacito de nosotros.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewPlace}
          className="neo-btn-primary py-2 px-4 text-xs sm:text-sm flex items-center justify-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Rincón</span>
        </button>
      </div>

      {/* Main Tabs (Todos, Visitados, Por conocer) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'Todos', label: `Todos (${places.length})` },
            { id: 'Visitado', label: `Visitados (${visitedCount})` },
            { id: 'Por conocer', label: `Por conocer (${wishlistCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border-2 border-carbon transition-all ${
                activeTab === tab.id
                  ? 'bg-butter text-carbon shadow-neo -translate-y-0.5'
                  : 'bg-white dark:bg-nightCard text-carbon dark:text-cream hover:bg-cream'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-carbon/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por plato, barrio o nombre..."
            className="neo-input w-full pl-8 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`text-xs font-bold px-3 py-1 rounded-full border border-carbon whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-coral text-white shadow-xs'
                : 'bg-white dark:bg-nightSurface text-carbon dark:text-cream'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Places Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaces.map((place, index) => (
          <motion.div
            key={place.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.22, ease: "easeOut" }}
            className="bg-white dark:bg-nightCard border-3 border-carbon rounded-2xl p-4 shadow-neo flex flex-col justify-between group hover:-translate-y-1 hover:shadow-neo-lg active:scale-[0.99] transition-[transform,box-shadow] duration-180 ease-out"
          >
            <div>
              {/* Photo & Status Badge */}
              <div className="w-full h-44 rounded-xl overflow-hidden border-2 border-carbon mb-3 relative bg-gradient-to-br from-cream via-butter-light to-rosePastel-light dark:from-nightSurface dark:to-night">
                {place.imageUrl ? (
                  <img
                    src={place.imageUrl}
                    alt={place.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-4xl mb-1">📍</span>
                    <span className="font-display font-black text-sm text-carbon dark:text-cream line-clamp-1">
                      {place.name}
                    </span>
                    <span className="text-[11px] font-semibold text-carbon/60 dark:text-cream/60">
                      {place.zone || 'Rincón especial'}
                    </span>
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5">
                  <span
                    className={`neo-badge text-[10px] font-black ${
                      place.status === 'Visitado'
                        ? 'bg-sage text-carbon'
                        : 'bg-rosePastel text-carbon'
                    }`}
                  >
                    {place.status === 'Visitado' ? '✅ Visitado' : '⏳ Por conocer'}
                  </span>
                </div>
                <div className="absolute bottom-2.5 right-2.5 bg-carbon/80 text-white text-[10px] font-black px-2 py-0.5 rounded border border-carbon">
                  {place.priceRange}
                </div>
              </div>

              {/* Title & Category */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-coral uppercase tracking-wider block">
                    {place.category}
                  </span>
                  <h3 className="font-display font-bold text-base sm:text-lg text-carbon dark:text-cream leading-tight break-words">
                    {place.name}
                  </h3>
                </div>
                {place.rating && place.status === 'Visitado' && (
                  <div className="shrink-0 pt-0.5">
                    <RatingDisplay
                      rating={place.rating}
                      type={settings.ratingStyle}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-carbon/70 dark:text-cream/70 font-semibold mb-3">
                <MapPin className="w-3.5 h-3.5 text-coral shrink-0" />
                <span className="truncate">{place.zone}</span>
              </div>

              {/* What We Ordered */}
              {place.whatWeOrdered && (
                <div className="bg-cream dark:bg-nightSurface border border-carbon rounded-xl p-2.5 mb-2.5 text-xs text-carbon/90 dark:text-cream/90">
                  <div className="flex items-center gap-1 font-bold text-coral text-[11px] mb-0.5">
                    <Utensils className="w-3 h-3" />
                    <span>{place.status === 'Visitado' ? 'Lo que pedimos:' : 'Por probar:'}</span>
                  </div>
                  <p className="italic line-clamp-2">{place.whatWeOrdered}</p>
                </div>
              )}

              {/* Review */}
              {place.review && (
                <p className="text-xs text-carbon/75 dark:text-cream/75 italic line-clamp-2 mb-3">
                  "{place.review}"
                </p>
              )}

              {/* Would return badge */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-carbon/60 dark:text-cream/60">¿Volver?</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border border-carbon ${
                    place.wouldReturn === '¡Sí o sí!'
                      ? 'bg-butter text-carbon'
                      : place.wouldReturn === 'Una vez basta'
                      ? 'bg-rosePastel-light text-carbon'
                      : 'bg-white dark:bg-nightCard text-carbon dark:text-cream'
                  }`}
                >
                  {place.wouldReturn}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-carbon/20">
              <button
                type="button"
                onClick={() => onToggleStatus(place)}
                className="text-xs font-bold text-coral hover:underline flex items-center gap-1"
              >
                {place.status === 'Visitado' ? (
                  <>Marcar como por conocer</>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> ¡Ya fuimos!
                  </>
                )}
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditPlace(place)}
                  className="p-1.5 border border-carbon rounded-lg bg-cream dark:bg-nightSurface hover:bg-butter"
                  title="Editar rincón"
                >
                  <Edit2 className="w-3.5 h-3.5 text-carbon dark:text-cream" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar "${place.name}"?`)) {
                      onDeletePlace(place.id);
                    }
                  }}
                  className="p-1.5 border border-carbon rounded-lg bg-rosePastel-light hover:bg-rosePastel"
                  title="Eliminar rincón"
                >
                  <Trash2 className="w-3.5 h-3.5 text-carbon" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredPlaces.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-nightCard border-3 border-dashed border-carbon rounded-3xl p-8">
          <span className="text-4xl block mb-2">{places.length === 0 ? '🗺️' : '🔍'}</span>
          <h3 className="font-display text-lg font-bold text-carbon dark:text-cream">
            {places.length === 0
              ? 'Su guía de rincones favoritos está vacía'
              : 'No se encontraron rincones con los filtros seleccionados'}
          </h3>
          <p className="text-xs text-carbon/60 dark:text-cream/60 mt-1 mb-4 max-w-sm mx-auto">
            {places.length === 0
              ? 'Guarden los cafés, restaurantes, playas o miradores que han visitado o tienen pendientes por conocer.'
              : 'Prueben buscando con otra palabra o seleccionen otra categoría.'}
          </p>
          <button
            type="button"
            onClick={onOpenNewPlace}
            className="neo-btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Primer Rincón</span>
          </button>
        </div>
      )}
    </div>
  );
};
