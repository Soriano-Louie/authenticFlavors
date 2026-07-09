import { Link } from "react-router";
import { Award, Heart, Users, ChefHat, Camera, ArrowRight } from "lucide-react";
import { IMAGES } from "../data/mockData";

const GALLERY = [
  { img: IMAGES.birthday, caption: "Birthday Celebrations" },
  { img: IMAGES.wedding, caption: "Wedding Receptions" },
  { img: IMAGES.gourmetPlating, caption: "Gourmet Plating" },
  { img: IMAGES.buffet, caption: "Grand Buffet Setups" },
  { img: IMAGES.dessert, caption: "Artisan Desserts" },
  { img: IMAGES.ambiance, caption: "Venue Ambiance" },
];

const MILESTONES = [
  {
    year: "2024",
    event:
      "The restaurant was officially established in November 2024 after growing from a successful home-based online food business.",
  },
  {
    year: "2025",
    event:
      "Through consistent online promotion and customer support, the restaurant expanded its reach and built a strong local reputation.",
  },
  {
    year: "2026",
    event:
      "The restaurant continues to grow by serving more customers while maintaining its commitment to quality food and excellent service.",
  },
];

export function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={IMAGES.ambiance}
            alt="Venue"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1A0E08]/85 via-[#1A0E08]/70 to-[#F5F0E8]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
            ✦ Our Story
          </p>
          <h1
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-5"
            style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 600 }}
          >
            The Heart Behind
            <br />
            <span className="italic text-[#C8922A]">Authentic Flavors</span>
          </h1>
          <p className="text-[#F5F0E8]/75 font-['Lato'] text-lg max-w-2xl mx-auto leading-relaxed">
            A passion for food, a dedication to craft, and a commitment to
            making every celebration extraordinary.
          </p>
        </div>
      </section>

      {/* Chef Story */}
      <section className="py-20 bg-[#F5F0E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div className="relative">
              <img
                src={IMAGES.chef}
                alt="Chef Ramos"
                className="w-full rounded-2xl object-cover shadow-2xl"
                style={{ height: "500px" }}
              />
              <div className="absolute top-4 -right-4 bg-[#C8922A] text-[#F5F0E8] rounded-2xl px-5 py-4 shadow-lg hidden md:block">
                <div className="flex items-center gap-2">
                  <ChefHat size={18} />
                  <span className="font-['Playfair_Display'] text-lg">
                    Chef Ramos
                  </span>
                </div>
                <p className="text-[#F5F0E8]/80 text-xs font-['Lato'] mt-1">
                  Executive Chef & Founder
                </p>
              </div>
            </div>
            <div>
              <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
                ✦ Chef Profile
              </p>
              <h2
                className="font-['Playfair_Display'] text-[#2C1810] mb-5"
                style={{
                  fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                  fontWeight: 600,
                }}
              >
                A Culinary Journey Rooted in{" "}
                <span className="italic text-[#C4541A]">
                  Passion & Heritage
                </span>
              </h2>
              <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-4">
                Chef Ramos, the owner and founder of the restaurant, started the
                business during the pandemic as a home-based online food
                service. What began with the sale of only sisig and chicken
                wings through online deliveries quickly gained popularity
                through quality food, excellent service, and effective online
                promotion.
              </p>
              <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-4">
                As the customer base continued to grow, the business expanded
                from a small setup into a larger dining establishment.
              </p>
              <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-8">
                Established in November 2024, the restaurant stands as the only
                branch, reflecting Chef Ramos' dedication to maintaining the
                quality and identity of the brand. From its humble beginnings to
                its growth today, the restaurant continues to provide memorable
                dining experiences built on passion, hard work, and the support
                of its loyal customers.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Award, label: "Awards Won", value: "1" },
                  { icon: Users, label: "Events / Year", value: "500+" },
                  { icon: Heart, label: "Guest Rating", value: "4.9★" },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="bg-[#EDE8DF] rounded-xl p-4 text-center"
                  >
                    <Icon size={18} className="text-[#C8922A] mx-auto mb-2" />
                    <p className="text-[#2C1810] font-['Playfair_Display'] text-xl">
                      {value}
                    </p>
                    <p className="text-[#2C1810]/50 text-xs font-['Lato']">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Venue Info */}
      <section className="py-20 bg-[#EDE8DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
                ✦ Our Venue
              </p>
              <h2
                className="font-['Playfair_Display'] text-[#2C1810] mb-5"
                style={{
                  fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                  fontWeight: 600,
                }}
              >
                An Exclusive Space for <br />
                <span className="italic text-[#C4541A]">Your Celebrations</span>
              </h2>
              <div className="space-y-4 mb-8">
                {[
                  { label: "Venue Capacity", value: "10 to 100 guests" },
                  {
                    label: "Location",
                    value: "35 ML Quezon St. New Lower Bicutan, Taguig City",
                  },
                  {
                    label: "Operating Hours",
                    value: "11am - 10pm Tuesday - Sunday",
                  },
                  {
                    label: "Parking",
                    value: "Dedicated event parking available",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center py-3 border-b border-[#C8922A]/15"
                  >
                    <span className="text-[#2C1810]/60 text-sm font-['Lato']">
                      {label}
                    </span>
                    <span className="text-[#2C1810] text-sm font-['Lato'] font-medium">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to="/package-selection"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full hover:opacity-90 transition-all font-['Lato']"
              >
                Book a Tour / Event <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GALLERY.slice(0, 4).map((item) => (
                <div
                  key={item.caption}
                  className="relative rounded-xl overflow-hidden group"
                  style={{ height: "180px" }}
                >
                  <img
                    src={item.img}
                    alt={item.caption}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E08]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="absolute bottom-2 left-2 right-2 text-[#F5F0E8] text-xs font-['Lato'] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.caption}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-20 bg-[#F5F0E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-2 flex items-center justify-center gap-2">
              <Camera size={14} /> ✦ Gallery
            </p>
            <h2
              className="font-['Playfair_Display'] text-[#2C1810]"
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                fontWeight: 600,
              }}
            >
              Moments Worth Remembering
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {GALLERY.map((item) => (
              <div
                key={item.caption}
                className="relative rounded-2xl overflow-hidden group cursor-pointer"
                style={{ height: "220px" }}
              >
                <img
                  src={item.img}
                  alt={item.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E08]/70 via-transparent to-transparent" />
                <p className="absolute bottom-3 left-3 text-[#F5F0E8] text-sm font-['Playfair_Display'] italic">
                  {item.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-[#2C1810]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-2">
              ✦ Our Journey
            </p>
            <h2
              className="font-['Playfair_Display'] text-[#F5F0E8]"
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                fontWeight: 600,
              }}
            >
              Milestones & Legacy
            </h2>
          </div>
          <div className="relative">
            <div
              className="absolute left-6 top-0 bottom-0 w-px bg-[#C8922A]/30 hidden md:block"
              style={{ left: "50%" }}
            />
            <div className="space-y-8">
              {MILESTONES.map((m, i) => (
                <div
                  key={m.year}
                  className={`flex gap-6 items-center ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
                >
                  <div
                    className={`flex-1 ${i % 2 === 0 ? "md:text-right" : ""}`}
                  >
                    <div
                      className={`bg-[#1A0E08] rounded-xl px-5 py-4 border border-[#C8922A]/10 inline-block`}
                    >
                      <p className="text-[#C8922A] font-['Playfair_Display'] text-xl mb-1">
                        {m.year}
                      </p>
                      <p className="text-[#F5F0E8]/70 text-sm font-['Lato']">
                        {m.event}
                      </p>
                    </div>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-[#C8922A] border-2 border-[#2C1810] z-10 shrink-0 hidden md:block" />
                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
