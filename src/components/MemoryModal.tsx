import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Image, Music, Plus, Trash2, Upload, Loader2, Heart, CheckCircle2 } from 'lucide-react';
import { Memory, MemoryCategory, CoupleSettings } from '../types';
import { RatingDisplay } from './RatingDisplay';
import { MouseEarsIcon } from './TopoEarsIcon';
import { fireHeartConfetti } from '../utils/confetti';
import { uploadPhotoToSupabase } from '../utils/supabase';
import { compressImage } from '../utils/image';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: Memory) => void;
  memoryToEdit?: Memory | null;
  settings: CoupleSettings;
  prefillPlanTitle?: string;
  prefillCategory?: MemoryCategory;
  prefillLocation?: string;
}

const CATEGORIES: MemoryCategory[] = [
  'Aniversario',
  'Cena',
  'Viaje',
  'Plan Casero',
  'Concierto/Salida',
];

const SUGGESTED_PHOTOS = [
  { label: 'Café & Bistro', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Atardecer Playa', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Cena Íntima', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Pasta Casera', url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Concierto / Música', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Picnic & Flores', url: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80' },
];

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  memoryToEdit,
  settings,
  prefillPlanTitle,
  prefillCategory,
  prefillLocation,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<MemoryCategory>('Cena');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState(5);
  const [perspectiveGigio, setPerspectiveGigio] = useState('');
  const [perspectiveRosita, setPerspectiveRosita] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songUrl, setSongUrl] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>(['']);
  const [tagsInput, setTagsInput] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDevicePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingPhoto(true);
      setUploadError(null);

      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let photoUrl: string | null = null;

        // 1. Try Supabase Storage if configured
        if (settings.supabaseUrl && settings.supabaseAnonKey) {
          try {
            photoUrl = await uploadPhotoToSupabase(file, settings.supabaseUrl, settings.supabaseAnonKey);
          } catch (storageErr) {
            console.warn('Supabase storage not available, using compressed image:', storageErr);
          }
        }

        // 2. Seamless fallback: compress image in browser to lightweight high-res JPEG (~120KB)
        if (!photoUrl) {
          photoUrl = await compressImage(file, 1200, 0.82);
        }

        if (photoUrl) {
          uploadedUrls.push(photoUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        // Remove empty placeholders and add new photos
        const currentClean = photoUrls.filter((u) => u && u.trim().length > 0);
        setPhotoUrls([...currentClean, ...uploadedUrls]);
        setUploadError(null);
        fireHeartConfetti();
      } else {
        setUploadError('No se pudo procesar la foto seleccionada.');
      }
    } catch (err: any) {
      console.error('Error al subir foto:', err);
      setUploadError(err.message || 'Error al procesar la foto');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (memoryToEdit) {
      setTitle(memoryToEdit.title);
      setDate(memoryToEdit.date);
      setCategory(memoryToEdit.category);
      setLocation(memoryToEdit.location);
      setRating(memoryToEdit.rating);
      setPerspectiveGigio(memoryToEdit.perspectiveGigio || '');
      setPerspectiveRosita(memoryToEdit.perspectiveRosita || '');
      setSongTitle(memoryToEdit.songTitle || '');
      setSongUrl(memoryToEdit.songUrl || '');
      setPhotoUrls(memoryToEdit.photos.length > 0 ? memoryToEdit.photos : ['']);
      setTagsInput(memoryToEdit.tags ? memoryToEdit.tags.join(', ') : '');
      setUploadError(null);
    } else {
      setTitle(prefillPlanTitle || '');
      setDate(new Date().toISOString().split('T')[0]);
      setCategory(prefillCategory || 'Cena');
      setLocation(prefillLocation || '');
      setRating(5);
      setPerspectiveGigio('');
      setPerspectiveRosita('');
      setSongTitle('');
      setSongUrl('');
      setPhotoUrls(['']);
      setTagsInput('');
      setUploadError(null);
    }
  }, [memoryToEdit, prefillPlanTitle, prefillCategory, prefillLocation, isOpen]);

  const handleAddPhotoField = () => {
    setPhotoUrls([...photoUrls, '']);
  };

  const handlePhotoChange = (idx: number, val: string) => {
    const updated = [...photoUrls];
    updated[idx] = val;
    setPhotoUrls(updated);
  };

  const handleRemovePhoto = (idx: number) => {
    const updated = photoUrls.filter((_, i) => i !== idx);
    setPhotoUrls(updated.length > 0 ? updated : ['']);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanPhotos = photoUrls.map((p) => p.trim()).filter(Boolean);
    if (cleanPhotos.length === 0) {
      setUploadError('Por favor añade al menos una foto para guardar el recuerdo (puedes subirla, pegar un enlace o elegir una sugerida).');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const memory: Memory = {
      id: memoryToEdit ? memoryToEdit.id : `mem-${Date.now()}`,
      title: title.trim(),
      date,
      category,
      location: location.trim() || 'Nuestro lugar especial',
      photos: cleanPhotos,
      perspectiveGigio: perspectiveGigio.trim() || undefined,
      perspectiveRosita: perspectiveRosita.trim() || undefined,
      rating,
      songTitle: songTitle.trim() || undefined,
      songUrl: songUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      isFavorite: memoryToEdit ? memoryToEdit.isFavorite : true,
    };

    onSave(memory);
    fireHeartConfetti();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-carbon/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-2xl bg-cream dark:bg-nightCard border-3 border-carbon rounded-3xl p-5 sm:p-7 shadow-neo-xl my-8 relative"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white dark:bg-nightSurface border-2 border-carbon rounded-full hover:bg-rosePastel shadow-neo-sm"
        >
          <X className="w-4 h-4 text-carbon dark:text-cream" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📸</span>
          <h2 className="font-display text-xl sm:text-2xl font-black text-carbon dark:text-cream">
            {memoryToEdit ? 'Editar Recuerdo' : 'Nuevo Recuerdo en la Bitácora'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Title & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Título del momento o cita *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Noche de velas y jazz en la terraza"
                className="neo-input w-full"
              />
            </div>
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Fecha *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="neo-input w-full"
              />
            </div>
          </div>

          {/* Category, Location & Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MemoryCategory)}
                className="neo-input w-full"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-carbon dark:text-cream mb-1">
                Lugar o Rincón
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Café Botánica, Playa Hermosa..."
                className="neo-input w-full"
              />
            </div>
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
          </div>

          {/* DOBLE PERSPECTIVA */}
          <div className="bg-white dark:bg-nightSurface border-2 border-carbon rounded-2xl p-4 shadow-neo-sm space-y-3">
            <div className="flex items-center justify-between text-coral font-bold">
              <div className="flex items-center gap-1.5">
                <span>👥</span>
                <span>Doble Perspectiva (Lo que sintió cada uno)</span>
              </div>
              <span className="text-[11px] text-carbon/50 dark:text-cream/50 font-normal">Opcional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-carbon dark:text-cream flex items-center justify-between gap-1.5 mb-1 text-xs">
                  <span className="flex items-center gap-1.5">
                    <MouseEarsIcon type="gigio" size={16} />
                    <span>Lo que sintió Gigio ({settings.partner1.name}):</span>
                  </span>
                  <span className="text-[10px] text-carbon/40 dark:text-cream/40 font-normal">Opcional</span>
                </label>
                <textarea
                  rows={3}
                  value={perspectiveGigio}
                  onChange={(e) => setPerspectiveGigio(e.target.value)}
                  placeholder="Lo que más me gustó, cómo me sentí mirándote... (puedes dejarlo vacío)"
                  className="neo-input w-full text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-carbon dark:text-cream flex items-center justify-between gap-1.5 mb-1 text-xs">
                  <span className="flex items-center gap-1.5">
                    <MouseEarsIcon type="rosita" size={16} />
                    <span>Lo que sintió Rosita ({settings.partner2.name}):</span>
                  </span>
                  <span className="text-[10px] text-carbon/40 dark:text-cream/40 font-normal">Opcional</span>
                </label>
                <textarea
                  rows={3}
                  value={perspectiveRosita}
                  onChange={(e) => setPerspectiveRosita(e.target.value)}
                  placeholder="Mi recuerdo favorito de ese día, lo que pensé... (puedes dejarlo vacío)"
                  className="neo-input w-full text-xs"
                />
              </div>
            </div>
          </div>

          {/* Photos Section: Gallery Preview, Upload & Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-carbon dark:text-cream flex items-center gap-1.5 flex-wrap">
                <Image className="w-4 h-4 text-coral" />
                <span>Fotos del Recuerdo *</span>
                <span className="text-[11px] font-bold text-coral bg-rosePastel-light px-2 py-0.5 rounded-full border border-carbon/20">
                  Al menos una requerida
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="neo-btn-rose text-[11px] py-1 px-3 flex items-center gap-1.5"
                  title="Subir foto desde tu dispositivo o galería"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploadingPhoto ? 'Procesando...' : 'Subir foto'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleDevicePhotoUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleAddPhotoField}
                  className="text-xs font-bold text-coral hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Pegar enlace
                </button>
              </div>
            </div>

            {uploadError && (
              <p className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border-2 border-red-300 mb-2.5">
                ⚠️ {uploadError}
              </p>
            )}

            {/* Visual Thumbnail Gallery Preview */}
            {photoUrls.filter((u) => u && u.trim().length > 0).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                {photoUrls
                  .map((url, origIdx) => ({ url, origIdx }))
                  .filter((item) => item.url && item.url.trim().length > 0)
                  .map((item, displayIdx) => (
                    <div
                      key={item.origIdx}
                      className="relative rounded-xl overflow-hidden border-2 border-carbon aspect-video bg-carbon/5 shadow-neo-sm group"
                    >
                      <img
                        src={item.url}
                        alt={`Foto ${displayIdx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-carbon/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {displayIdx === 0 ? 'Principal ⭐' : `#${displayIdx + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.origIdx)}
                        className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-md border border-carbon shadow-xs transition-colors"
                        title="Quitar esta foto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              /* Friendly Upload Dropzone when no photos added */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-carbon rounded-2xl p-5 mb-3 text-center cursor-pointer bg-cream/50 dark:bg-nightSurface/50 hover:bg-rosePastel-light/30 transition-colors"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-rosePastel-light flex items-center justify-center mb-1.5 border border-carbon">
                    <Upload className="w-5 h-5 text-coral" />
                  </div>
                  <p className="text-xs font-bold text-carbon dark:text-cream">
                    Toca aquí para subir una foto desde tu celular o computadora
                  </p>
                  <p className="text-[11px] text-carbon/60 dark:text-cream/60 mt-0.5">
                    Puedes seleccionar una o varias imágenes de su cita
                  </p>
                </div>
              </div>
            )}

            {/* Optional manual URL inputs (if user added extra via "Pegar enlace") */}
            {photoUrls.some((u) => u === '' || !u.startsWith('data:')) && (
              <div className="space-y-1.5 mb-2">
                {photoUrls.map((url, idx) => {
                  // Only show text input for empty slots or external http links
                  if (url.startsWith('data:')) return null;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          handlePhotoChange(idx, e.target.value);
                          if (uploadError) setUploadError(null);
                        }}
                        placeholder="https://images.unsplash.com/... o enlace de tu foto"
                        className="neo-input flex-1 text-xs py-1.5"
                      />
                      {photoUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="p-1.5 border border-carbon rounded-xl bg-rosePastel-light hover:bg-rosePastel"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-carbon" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Suggested Photo Presets */}
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] font-semibold text-carbon/60 dark:text-cream/60">
                Fotos rápidas:
              </span>
              {SUGGESTED_PHOTOS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const clean = photoUrls.filter((u) => u && u.trim().length > 0);
                    setPhotoUrls([...clean, preset.url]);
                    setUploadError(null);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-carbon bg-butter-light hover:bg-butter text-carbon transition-colors"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Song & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-carbon dark:text-cream flex items-center justify-between gap-1 mb-1">
                <span className="flex items-center gap-1">
                  <Music className="w-4 h-4 text-coral" />
                  <span>Canción de ese día</span>
                </span>
                <span className="text-[10px] text-carbon/50 dark:text-cream/50 font-normal">Opcional</span>
              </label>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Ej. Lover — Taylor Swift"
                className="neo-input w-full text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-carbon dark:text-cream mb-1 flex items-center justify-between">
                <span>Etiquetas</span>
                <span className="text-[10px] text-carbon/50 dark:text-cream/50 font-normal">Opcional</span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Atardecer, Primera cita, Lluvia..."
                className="neo-input w-full text-xs"
              />
            </div>
          </div>

          {/* Form Actions */}
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
              <Heart className="w-4 h-4 fill-white" />
              <span>{memoryToEdit ? 'Guardar Cambios' : 'Guardar Recuerdo'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
