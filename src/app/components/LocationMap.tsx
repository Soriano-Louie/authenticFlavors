import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Navigation,
  Clock,
  Car,
  Phone,
  Mail,
  Compass,
  ExternalLink,
} from "lucide-react";

// Default coordinates for 35 ML Quezon St., New Lower Bicutan, Taguig City, Philippines
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
  const [coords, setCoords] = useState<[number, number]>([
    DEFAULT_LAT,
    DEFAULT_LNG,
  ]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Attempt geocoding on mount with fallback
  useEffect(() => {
    let isMounted = true;
    const fetchCoordinates = async () => {
      setIsGeocoding(true);
      try {
        // Query OpenStreetMap Nominatim for exact address
        const query = encodeURIComponent(
          "35 ML Quezon St, Lower Bicutan, Taguig, Philippines",
        );
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lon)) {
              setCoords([lat, lon]);
            }
          }
        }
      } catch {
        // Fallback to verified default coordinates
      } finally {
        if (isMounted) setIsGeocoding(false);
      }
    };

    fetchCoordinates();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance before creating new one (React StrictMode hygiene)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: coords,
      zoom: 16,
      scrollWheelZoom: false, // Prevent page scrolling capture
      zoomControl: true,
    });

    // High quality OpenStreetMap standard tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Custom branded pin icon with elegant pulsing ring
    const customIcon = L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(200, 146, 42, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #C8922A 0%, #C4541A 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(44, 24, 16, 0.4); border: 2.5px solid #FFFFFF;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });

    const marker = L.marker(coords, { icon: customIcon }).addTo(map);

    // Rich popup content
    const popupContent = `
      <div style="font-family: 'Lato', sans-serif; color: #2C1810; padding: 4px 2px; max-width: 260px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #C8922A;"></span>
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #C8922A;">Premium Catering & Dining</span>
        </div>
        <h3 style="font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; color: #2C1810; margin: 0 0 6px 0; line-height: 1.3;">
          ${RESTAURANT_NAME}
        </h3>
        <p style="font-size: 12px; color: #665248; margin: 0 0 10px 0; line-height: 1.4;">
          ${RESTAURANT_ADDRESS}
        </p>
        <div style="display: flex; gap: 6px; align-items: center; font-size: 11px; color: #2C1810; background: #F5F0E8; padding: 6px 8px; border-radius: 8px; margin-bottom: 10px;">
          <span>🕒 Tue - Sun: 10:00 AM - 10:00 PM</span>
        </div>
        <a 
          href="${GOOGLE_MAPS_URL}" 
          target="_blank" 
          rel="noopener noreferrer" 
          style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px 12px; background: linear-gradient(135deg, #C8922A 0%, #C4541A 100%); color: #FFFFFF; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 9999px; box-shadow: 0 2px 6px rgba(196, 84, 26, 0.3);"
        >
          <span>Get Directions</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </a>
      </div>
    `;

    marker.bindPopup(popupContent, {
      closeButton: true,
      autoPan: true,
      className: "custom-leaflet-popup",
    });

    // Auto-open the popup after map initialization so guests immediately see the name and address
    setTimeout(() => {
      marker.openPopup();
    }, 400);

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coords]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(coords, 16, {
        duration: 1.2,
      });
      if (markerRef.current) {
        markerRef.current.openPopup();
      }
    }
  };

  return (
    <section className="py-20 bg-[#1A0E08] border-t border-[#C8922A]/15 relative overflow-hidden">
      {/* Subtle Background Glows */}
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
            style={{
              fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
              fontWeight: 600,
            }}
          >
            Find Us in Taguig City
          </h2>
          <p className="text-[#F5F0E8]/70 text-sm md:text-base font-['Lato'] max-w-2xl mx-auto">
            Experience the warmth of authentic dining and private event
            celebrations at our exclusive venue in New Lower Bicutan.
          </p>
        </div>

        {/* Map & Information Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Venue Location Cards */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            {/* Primary Address Card */}
            <div className="bg-[#2C1810]/90 backdrop-blur-sm rounded-2xl p-6 border border-[#C8922A]/25 shadow-xl shadow-black/40 relative overflow-hidden">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#C4541A]/30">
                  <MapPin size={22} />
                </div>
                <div>
                  <span className="text-[#C8922A] text-xs font-bold font-['Lato'] tracking-wider uppercase">
                    Main Restaurant & Venue
                  </span>
                  <h3 className="font-['Playfair_Display'] text-[#F5F0E8] text-xl font-bold mt-0.5 leading-snug">
                    {RESTAURANT_NAME}
                  </h3>
                  <p className="text-[#F5F0E8]/75 text-sm font-['Lato'] mt-2 leading-relaxed">
                    {RESTAURANT_ADDRESS}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#C8922A]/20 flex flex-col sm:flex-row gap-3">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md shadow-[#C4541A]/20 font-['Lato']"
                >
                  <Navigation size={14} />
                  Get Directions
                  <ExternalLink size={12} className="opacity-80" />
                </a>
                <button
                  onClick={handleRecenter}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-[#F5F0E8] text-xs font-semibold rounded-xl border border-[#C8922A]/30 flex items-center justify-center gap-2 transition-all font-['Lato'] cursor-pointer"
                >
                  <Compass size={14} className="text-[#C8922A]" />
                  Recenter Map
                </button>
              </div>
            </div>

            {/* Quick Details Highlights */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Operating Hours */}
              <div className="bg-[#2C1810]/70 rounded-xl p-4 border border-[#C8922A]/15 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#C8922A]/15 text-[#C8922A] shrink-0 mt-0.5">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-[#F5F0E8] text-xs font-bold font-['Lato']">
                    Operating Hours
                  </h4>
                  <p className="text-[#F5F0E8]/60 text-xs font-['Lato'] mt-0.5 leading-snug">
                    Tue – Sun: 10:00 AM – 10:00 PM
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-[#C8922A] mt-1">
                    Closed on Mondays
                  </span>
                </div>
              </div>

              {/* Parking Availability */}
              <div className="bg-[#2C1810]/70 rounded-xl p-4 border border-[#C8922A]/15 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#7A8C5C]/20 text-[#7A8C5C] shrink-0 mt-0.5">
                  <Car size={16} />
                </div>
                <div>
                  <h4 className="text-[#F5F0E8] text-xs font-bold font-['Lato']">
                    Event Parking
                  </h4>
                  <p className="text-[#F5F0E8]/60 text-xs font-['Lato'] mt-0.5 leading-snug">
                    Dedicated parking slots available for dining & event guests.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Contact Inquiries */}
            <div className="bg-[#2C1810]/50 rounded-xl p-4 border border-[#C8922A]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#F5F0E8]/70 font-['Lato']">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#C8922A]" />
                <a
                  href="mailto:events@authenticflavors.ph"
                  className="hover:text-[#C8922A] transition-colors"
                >
                  events@authenticflavors.ph
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-[#C8922A]" />
                <span>+63 (2) 8888-RAMOS</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Leaflet Map Container */}
          <div className="lg:col-span-7 h-[380px] sm:h-[420px] lg:h-auto min-h-[380px] rounded-2xl overflow-hidden border border-[#C8922A]/30 shadow-2xl relative bg-[#2C1810]">
            {/* Map Canvas */}
            <div
              ref={mapContainerRef}
              className="w-full h-full z-0"
              style={{ minHeight: "380px" }}
            />

            {/* Map Top Badge Overlay */}
            <div className="absolute top-3 left-3 z-[400] bg-[#2C1810]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#C8922A]/40 shadow-lg flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[#7A8C5C] animate-pulse"></span>
              <span className="text-[11px] font-['Lato'] font-bold text-[#F5F0E8]">
                Authentic Flavors Pin Location
              </span>
            </div>

            {/* Google Maps External Shortcut Pill */}
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
