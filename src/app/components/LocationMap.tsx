import React from "react";
import { MapPin, Navigation, Compass, ExternalLink } from "lucide-react";

const RESTAURANT_NAME = "Authentic Flavors by Chef Ramos";
const RESTAURANT_ADDRESS =
  "35 ML Quezon St., New Lower Bicutan, Taguig City, Philippines";
const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=35+ML+Quezon+St,+New+Lower+Bicutan,+Taguig+City,+Philippines";

// Google Maps Embed — no API key required for basic embed usage
// Uses the exact coordinates geocoded from the address
const MAP_EMBED_SRC =
  "https://maps.google.com/maps?q=14.4950,121.0630&z=16&output=embed";

export function LocationMap() {
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

        {/* Map & Location Card Container */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Primary Location Card */}
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

              {/* Action Buttons */}
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
                <a
                  href="https://maps.google.com/maps?q=14.4950,121.0630"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3.5 px-4 bg-white/5 hover:bg-white/10 text-[#F5F0E8] text-xs font-semibold rounded-xl border border-[#C8922A]/30 flex items-center justify-center gap-2 transition-all font-['Lato']"
                >
                  <Compass size={15} className="text-[#C8922A]" />
                  Open Full Map
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Google Maps Embed */}
          <div className="lg:col-span-7 h-[420px] sm:h-[460px] rounded-2xl overflow-hidden border border-[#C8922A]/30 shadow-2xl relative">
            {/* Badge Overlay */}
            <div className="absolute top-3 left-3 z-10 bg-[#2C1810]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#C8922A]/40 shadow-lg flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[#7A8C5C] animate-pulse"></span>
              <span className="text-[11px] font-['Lato'] font-bold text-[#F5F0E8]">
                Authentic Flavors Pin Location
              </span>
            </div>

            {/* Google Maps Open Shortcut */}
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 z-10 bg-[#1A0E08]/90 hover:bg-[#C8922A] text-[#F5F0E8] text-[11px] font-bold px-3.5 py-2 rounded-full border border-[#C8922A]/40 shadow-xl transition-all flex items-center gap-1.5 font-['Lato']"
            >
              <Navigation size={12} />
              <span>Open in Google Maps</span>
              <ExternalLink size={10} />
            </a>

            {/* Embedded Map */}
            <iframe
              title="Authentic Flavors by Chef Ramos — Location Map"
              src={MAP_EMBED_SRC}
              width="100%"
              height="100%"
              style={{ border: 0, display: "block" }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
