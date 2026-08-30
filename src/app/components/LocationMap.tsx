import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Compass, ExternalLink } from "lucide-react";

const DEFAULT_LAT = 14.495;
const DEFAULT_LNG = 121.063;
const RESTAURANT_NAME = "Authentic Flavors by Chef Ramos";
const RESTAURANT_ADDRESS =
  "35 ML Quezon St., New Lower Bicutan, Taguig City, Philippines";
const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=35+ML+Quezon+St,+New+Lower+Bicutan,+Taguig+City,+Philippines";

export function LocationMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const coords: [number, number] = [DEFAULT_LAT, DEFAULT_LNG];

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Prevent double-init in React StrictMode
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create the map
    const map = L.map(container, {
      center: coords,
      zoom: 16,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    // CartoDB Voyager tiles — high quality, free, no API key, renders roads/terrain/buildings.
    // Uses <img> tags internally (not iframes), so only requires img-src CSP permission.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        subdomains: "abcd",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    ).addTo(map);

    // Custom branded pin
    const customIcon = L.divIcon({
      className: "af-map-marker",
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px">
          <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(200,146,42,.35);animation:pulse 2s ease-in-out infinite"></div>
          <div style="position:relative;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#C8922A,#C4541A);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(44,24,16,.4);border:2.5px solid #fff">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });

    const marker = L.marker(coords, { icon: customIcon }).addTo(map);

    const popupContent = `
      <div style="font-family:'Lato',sans-serif;color:#2C1810;padding:4px 2px;max-width:260px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#C8922A"></span>
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#C8922A">Authentic Flavors</span>
        </div>
        <h3 style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#2C1810;margin:0 0 6px;line-height:1.3">${RESTAURANT_NAME}</h3>
        <p style="font-size:12px;color:#665248;margin:0 0 10px;line-height:1.4">${RESTAURANT_ADDRESS}</p>
        <a href="${GOOGLE_MAPS_URL}" target="_blank" rel="noopener noreferrer"
          style="display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:8px 12px;background:linear-gradient(135deg,#C8922A,#C4541A);color:#fff;font-size:12px;font-weight:700;text-decoration:none;border-radius:9999px;box-shadow:0 2px 6px rgba(196,84,26,.3)">
          <span>Get Directions</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
          </svg>
        </a>
      </div>`;

    marker.bindPopup(popupContent, {
      closeButton: true,
      autoPan: true,
      className: "custom-leaflet-popup",
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Force Leaflet to recalculate the container size after layout settles,
    // then load tiles. This is the key fix for blank maps in SPAs.
    const rafId = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });

      // Second pass after a short delay to catch late CSS reflows
      setTimeout(() => {
        map.invalidateSize({ animate: false });
        marker.openPopup();
      }, 300);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.flyTo(coords, 16, { duration: 1.2 });
      markerRef.current?.openPopup();
    }
  };

  return (
    <section className="py-20 bg-[#1A0E08] border-t border-[#C8922A]/15 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C8922A]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#C4541A]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8922A]/10 border border-[#C8922A]/30 mb-3">
            <Compass size={14} className="text-[#C8922A]" />
            <span className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] font-semibold">
              ✦ Visit Our Location
            </span>
          </div>
          <h2
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-3"
            style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontWeight: 600 }}
          >
            Find Us in Taguig City
          </h2>
          <p className="text-[#F5F0E8]/70 text-sm md:text-base font-['Lato'] max-w-2xl mx-auto">
            Experience the warmth of authentic dining and private event
            celebrations at our exclusive venue in New Lower Bicutan.
          </p>
        </div>

        {/* Map & Location Card */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Location Card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-[#2C1810]/95 backdrop-blur-sm rounded-2xl p-7 border border-[#C8922A]/25 shadow-xl shadow-black/40">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#C4541A]/30">
                  <MapPin size={26} />
                </div>
                <div>
                  <span className="text-[#C8922A] text-xs font-bold font-['Lato'] tracking-wider uppercase">
                    Main Restaurant &amp; Venue
                  </span>
                  <h3 className="font-['Playfair_Display'] text-[#F5F0E8] text-xl font-bold mt-1 leading-snug">
                    {RESTAURANT_NAME}
                  </h3>
                  <p className="text-[#F5F0E8]/80 text-sm font-['Lato'] mt-2.5 leading-relaxed">
                    {RESTAURANT_ADDRESS}
                  </p>
                </div>
              </div>
              <div className="pt-5 border-t border-[#C8922A]/20 flex flex-col sm:flex-row gap-3">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3.5 px-4 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md shadow-[#C4541A]/20 font-['Lato']"
                >
                  <Navigation size={15} />
                  Get Directions
                  <ExternalLink size={13} className="opacity-80" />
                </a>
                <button
                  onClick={handleRecenter}
                  className="py-3.5 px-4 bg-white/5 hover:bg-white/10 text-[#F5F0E8] text-xs font-semibold rounded-xl border border-[#C8922A]/30 flex items-center justify-center gap-2 transition-all font-['Lato'] cursor-pointer"
                >
                  <Compass size={15} className="text-[#C8922A]" />
                  Recenter Map
                </button>
              </div>
            </div>
          </div>

          {/* Right: Leaflet Map */}
          <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#C8922A]/30 shadow-2xl relative bg-[#2C1810]">
            <div
              ref={mapContainerRef}
              style={{ width: "100%", height: "460px" }}
            />

            {/* Badge Overlay */}
            <div className="absolute top-3 left-3 z-[400] bg-[#2C1810]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#C8922A]/40 shadow-lg flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[#7A8C5C] animate-pulse" />
              <span className="text-[11px] font-['Lato'] font-bold text-[#F5F0E8]">
                Authentic Flavors Pin Location
              </span>
            </div>

            {/* Google Maps Shortcut */}
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 z-[400] bg-[#1A0E08]/90 hover:bg-[#C8922A] text-[#F5F0E8] text-[11px] font-bold px-3.5 py-2 rounded-full border border-[#C8922A]/40 shadow-xl transition-all flex items-center gap-1.5 font-['Lato']"
            >
              <Navigation size={12} />
              <span>Open in Google Maps</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
