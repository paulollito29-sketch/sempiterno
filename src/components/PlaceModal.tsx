import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Star, Utensils, ExternalLink, Image } from 'lucide-react';
import { Place, PlaceCategory, ReturnVerdict, BudgetLevel, CoupleSettings } from '../types';
import { RatingDisplay } from './RatingDisplay';

interface PlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (place: Place) => void;
  placeToEdit?: Place | null;
  settings: CoupleSettings;
}

const CATEGORIES: PlaceCategory[] = [
  'Restaurante',
  'Café',
  'Playa',
  'Parque/Mirador',
  'Bar',
  'Aventura/Paseo',
];

const VERDICTS: ReturnVerdict[] = ['¡Sí o sí!', 'Una vez basta', 'Pendiente de probar'];

const SUGGESTED_PHOTOS = [
  { label: 'Café de especialidad', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80' },
  { label: 'Comida Italiana / Pasta', url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80' },
  { label: 'Playa & Mar', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { label: 'Mirador Nocturno', url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80' },
];

export const PlaceModal: React.FC<PlaceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  placeToEdit,
  settings,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('Restaurante');
  const [status, setStatus] = useState<'Visitado' | 'Por conocer'>('Visitado');
  const [zone, setZone] = useState('');
  const [whatWeOrdered, setWhatWeOrdered] = useState('');
  const [review, setReview] = useState('');
  const [wouldReturn, setWouldReturn] = useState<ReturnVerdict>('¡Sí o sí!');
  const [rating, setRating] = useState(5);
  const [priceRange, setPriceRange] = useState<BudgetLevel>('$$');
  const [imageUrl, setImageUrl] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');

  useEffect(() => {
    if (placeToEdit) {
      setName(placeToEdit.name);
      setCategory(placeToEdit.category);
      setStatus(placeToEdit.status);
      setZone(placeToEdit.zone);
      setWhatWeOrdered(placeToEdit.whatWeOrdered || '');
      setReview(placeToEdit.review || '');
      setWouldReturn(placeToEdit.wouldReturn);
      setRating(placeToEdit.rating || 5);
      setPriceRange(placeToEdit.priceRange);
      setImageUrl(placeToEdit.imageUrl || '');
      setGoogleMapsUrl(placeToEdit.googleMapsUrl || '');
    } else {
      setName('');
      setCategory('Restaurante');
      setStatus('Visitado');
      setZone('');
      setWhatWeOrdered('');
      setReview('');
      setWouldReturn('¡Sí o sí!');
      setRating(5);
      setPriceRange('$$');
      setImageUrl('');
      setGoogleMapsUrl('');
    }
  }, [placeToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const place: Place = {
      id: placeToEdit ? placeToEdit.id : `place-${Date.now()}`,
      name: name.trim(),
      category,
      status,
      zone: zone.trim() || 'Zona no especificada',
      whatWeOrdered: whatWeOrdered.trim() || undefined,
      review: review.trim() || undefined,
      wouldReturn,
      rating: status === 'Visitado' ? (rating || 5) : undefined,
      priceRange,
      imageUrl: imageUrl.trim() || undefined,
      googleMapsUrl: googleMapsUrl.trim() || undefined,
    };

    onSave(place);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-xl bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo-xl my-8 relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel shadow-neo-sm"
        >
          <X className="w-4 h-4 text-carbon dark:text-cream" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📍</span>
          <h2 className="font-display text-xl sm:text-2xl font-black text-carbon dark:text-cream">
            {placeToEdit ? 'Editar Rincón' : 'Añadir Nuestro Rincón'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Nombre del Lugar *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Café Botánica & Bistro"
                className="neo-input w-full"
              />
            </div>
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                className="neo-input w-full"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status & Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Estado *
              </label>
              <div className="flex gap-2">
                {(['Visitado', 'Por conocer'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatus(st);
                      if (st === 'Por conocer') {
                        setWouldReturn('Pendiente de probar');
                      } else {
                        setWouldReturn('¡Sí o sí!');
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold border-2 border-carbon rounded-xl transition-all ${
                      status === st
                        ? 'bg-coral text-white shadow-neo-sm'
                        : 'bg-white dark:bg-nightSurface text-carbon dark:text-cream'
                    }`}
                  >
                    {st === 'Visitado' ? '✅ Visitado' : '⏳ Por conocer'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Barrio o Zona
              </label>
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ej. Centro, Distrito Bohemio..."
                className="neo-input w-full"
              />
            </div>
          </div>

          {/* What We Ordered / Recommended */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1 flex items-center justify-between">
              <span>
                {status === 'Visitado'
                  ? '¿Qué pedimos? (Platos favoritos)'
                  : '¿Qué se nos antoja pedir? (Recomendaciones)'}
              </span>
              <span className="text-[10px] text-carbon/50 dark:text-cream/50 font-normal">Opcional</span>
            </label>
            <input
              type="text"
              value={whatWeOrdered}
              onChange={(e) => setWhatWeOrdered(e.target.value)}
              placeholder="Ej. Ravioles de trufa, latte de avellana, tiramisú..."
              className="neo-input w-full"
            />
          </div>

          {/* Review */}
          <div>
            <label className="block font-bold text-carbon dark:text-cream mb-1 flex items-center justify-between">
              <span>Nuestra reseña corta</span>
              <span className="text-[10px] text-carbon/50 dark:text-cream/50 font-normal">Opcional</span>
            </label>
            <textarea
              rows={2}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="El ambiente, la atención, por qué nos encantó..."
              className="neo-input w-full"
            />
          </div>

          {/* Would Return & Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                ¿Volveríamos?
              </label>
              <select
                value={wouldReturn}
                onChange={(e) => setWouldReturn(e.target.value as ReturnVerdict)}
                className="neo-input w-full"
              >
                {VERDICTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {status === 'Visitado' && (
              <div>
                <label className="block font-bold text-carbon dark:text-cream mb-1">
                  Calificación ({settings.ratingStyle === 'cheese' ? 'Quesitos' : 'Corazones'})
                </label>
                <div className="py-2">
                  <RatingDisplay
                    rating={rating}
                    type={settings.ratingStyle}
                    interactive
                    onChange={setRating}
                    size="md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Image URL & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-carbon dark:text-cream flex items-center gap-1">
                <Image className="w-4 h-4 text-coral" />
                <span>Foto o portada del lugar</span>
              </label>
              <div className="flex items-center gap-2">
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-[10px] text-coral hover:underline font-bold"
                  >
                    Quitar foto
                  </button>
                )}
                <span className="text-[10px] text-carbon/50 dark:text-cream/50 font-normal">Opcional</span>
              </div>
            </div>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... (puedes dejarlo vacío)"
              className="neo-input w-full text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5 items-center">
              <span className="text-[10px] text-carbon/60 dark:text-cream/60 font-semibold">
                Sugerencias:
              </span>
              {SUGGESTED_PHOTOS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setImageUrl(s.url)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-carbon bg-butter-light text-carbon"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-carbon/20">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn-white py-2 px-4 text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="neo-btn-primary py-2 px-5 text-xs sm:text-sm flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4" />
              <span>{placeToEdit ? 'Guardar Cambios' : 'Guardar Rincón'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
