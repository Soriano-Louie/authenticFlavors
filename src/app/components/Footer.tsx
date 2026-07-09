import { Link } from "react-router";
import { MapPin, Phone, Mail, Instagram, Facebook } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#1A0E08] text-[#F5F0E8]/70 pt-14 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/authentic_flavor_logo.png"
                alt="Authentic Flavors"
                className="h-10 w-auto object-contain"
              />
              <div>
                <p className="text-[#F5F0E8] text-sm font-['Playfair_Display']">Authentic Flavors</p>
                <p className="text-[#C8922A] text-[10px] tracking-widest uppercase">by Chef Ramos</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed font-['Lato']">
              Exclusive private dining and event hosting for life's most cherished celebrations.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com/authenticflavorsbycheframos/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-[#C8922A]/40 flex items-center justify-center hover:border-[#C8922A] hover:text-[#C8922A] transition-colors">
                <Instagram size={15} />
              </a>
              <a href="https://web.facebook.com/authenticflavorsbycheframos" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-[#C8922A]/40 flex items-center justify-center hover:border-[#C8922A] hover:text-[#C8922A] transition-colors">
                <Facebook size={15} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[#C8922A] font-['Playfair_Display'] mb-4">Quick Links</h4>
            <ul className="space-y-2 font-['Lato'] text-sm">
              {[
                { label: "Home", path: "/" },
                { label: "About Chef Ramos", path: "/about" },
                { label: "Book an Event", path: "/packages" },
                { label: "Feedback & Reviews", path: "/feedback" },
              ].map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="hover:text-[#C8922A] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Event Types */}
          <div>
            <h4 className="text-[#C8922A] font-['Playfair_Display'] mb-4">Events We Host</h4>
            <ul className="space-y-2 font-['Lato'] text-sm">
              {[
                { label: "Birthday Celebrations", path: "/package-selection?event=Birthday&package=package-a" },
                { label: "Wedding Receptions", path: "/package-selection?event=Wedding&package=package-c" },
                { label: "Corporate Dinners", path: "/package-selection?event=Corporate&package=package-b" },
                { label: "Anniversary Events", path: "/package-selection?event=Anniversary&package=package-d" },
                { label: "Family Reunions", path: "/package-selection?event=Family%20Fiesta&package=package-a" },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.path} className="hover:text-[#C8922A] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[#C8922A] font-['Playfair_Display'] mb-4">Contact Us</h4>
            <ul className="space-y-3 font-['Lato'] text-sm">
              <li className="flex items-start gap-2">
                <MapPin size={15} className="text-[#C8922A] mt-0.5 shrink-0" />
                <span>35 ML Quezon St. New Lower Bicutan, Taguig City</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={15} className="text-[#C8922A] shrink-0" />
                <span>+63 (2) 8888-RAMOS</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={15} className="text-[#C8922A] shrink-0" />
                <span>events@authenticflavors.ph</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#C8922A]/20 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs font-['Lato']">
          <p>© 2026 Authentic Flavors by Chef Ramos. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[#C8922A] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#C8922A] transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
