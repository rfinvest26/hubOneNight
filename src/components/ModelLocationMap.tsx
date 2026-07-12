import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ExternalLink, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { lookupCityCoordinates } from '@/data/cityCoordinates';

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  label: string;
}

// Дефолтные иконки Leaflet ссылаются на файлы, которые Vite не резолвит —
// рисуем свою метку inline-SVG в брендовом цвете, без внешних ассетов.
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35))">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0Z" fill="#ff5a82"/>
    <circle cx="17" cy="17" r="7" fill="white"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
  popupAnchor: [0, -40],
});

/**
 * Виджет геолокации анкеты. Точная метка — если воркер прислал ссылку на
 * Google Maps в боте (см. escortbot: escort:model:set:location). Иначе —
 * примерный центр города из статичного справочника (cityCoordinates.ts).
 * Карта — OpenStreetMap-тайлы через Leaflet: без API-ключа, без региональных
 * блокировок, одинаково доступна и в РФ, и в Украине, и везде ещё.
 */
export default function ModelLocationMap({ latitude, longitude, city, label }: Props) {
  const precise = typeof latitude === 'number' && typeof longitude === 'number';

  const coords = useMemo<[number, number] | null>(() => {
    if (precise) return [latitude as number, longitude as number];
    return lookupCityCoordinates(city);
  }, [precise, latitude, longitude, city]);

  if (!coords) return null;

  const [lat, lng] = coords;
  const zoom = precise ? 15 : 12;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="overflow-hidden rounded-2xl app-border bg-surface">
      <div className="relative h-[220px] w-full">
        <MapContainer
          center={[lat, lng]}
          zoom={zoom}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          zoomControl={false}
          className="h-full w-full"
        >
          {/* Атрибуция OpenStreetMap обязательна их условиями использования тайлов — не убирать. */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a>" />
          <Marker position={[lat, lng]} icon={pinIcon}>
            <Popup>{label}</Popup>
          </Marker>
        </MapContainer>

        <div className="pointer-events-none absolute left-3 top-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <MapPin size={12} className="text-[#ff5a82]" />
            {precise ? 'Точное местоположение' : 'Примерный район города'}
          </span>
        </div>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-[#4773d8] transition-colors hover:bg-[#f7f7f7]"
      >
        Открыть в Google Maps
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
