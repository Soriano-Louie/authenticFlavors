import { useState } from "react";
import { Link } from "react-router";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Award,
  ArrowRight,
  Utensils,
  Heart,
  Briefcase,
} from "lucide-react";
import { IMAGES, TESTIMONIALS, UPCOMING_EVENTS } from "../data/mockData";

const CAROUSEL_EVENTS = [
  {
    title: "Birthday Celebrations",
    subtitle: "Intimate & Joyful",
    image: IMAGES.birthday,
    tag: "Most Popular",
  },
  {
    title: "Corporate Dinners",
    subtitle: "Professional & Impressive",
    image: IMAGES.corporate,
    tag: "Business Class",
  },
  {
    title: "Wedding Receptions",
    subtitle: "Elegant & Timeless",
    image: IMAGES.wedding,
    tag: "Premium",
  },
  {
    title: "Anniversary Dinners",
    subtitle: "Romantic & Unforgettable",
    image: IMAGES.anniversary,
    tag: "Exclusive",
  },
];

const STATS = [
  { icon: Calendar, label: "Events Hosted", value: "500+" },
  { icon: Users, label: "Happy Guests", value: "15,000+" },
  { icon: Award, label: "Years of Excellence", value: "12" },
  { icon: Star, label: "Average Rating", value: "4.9★" },
];

export function LandingPage() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(UPCOMING_EVENTS[0].date);
  const [showAllEvents, setShowAllEvents] = useState(false);

  const prevSlide = () =>
    setCarouselIndex((i) => (i === 0 ? CAROUSEL_EVENTS.length - 1 : i - 1));
  const nextSlide = () =>
    setCarouselIndex((i) => (i === CAROUSEL_EVENTS.length - 1 ? 0 : i + 1));

  const monthStart = new Date(2026, 6, 1);
  const daysInMonth = new Date(2026, 7, 0).getDate();
  const firstDay = monthStart.getDay();
  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const calendarDays = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = `2026-07-${String(day).padStart(2, "0")}`;
      const event = UPCOMING_EVENTS.find((item) => item.date === dateKey);
      return {
        day,
        dateKey,
        hasEvent: Boolean(event),
        isSelected: selectedDate === dateKey,
      };
    }),
  ];
  const selectedEvent =
    UPCOMING_EVENTS.find((item) => item.date === selectedDate) ??
    UPCOMING_EVENTS[0];
  const visibleEvents = showAllEvents
    ? UPCOMING_EVENTS
    : UPCOMING_EVENTS.slice(0, 3);

  return (
    <div>
      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={IMAGES.hero}
            alt="Private dining"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A0E08]/90 via-[#1A0E08]/70 to-[#1A0E08]/30" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="max-w-2xl">
              <span className="inline-block px-4 py-1.5 rounded-full border border-[#C8922A]/60 text-[#C8922A] text-xs tracking-widest uppercase mb-6 font-['Lato'] bg-[#C8922A]/10">
                ✦ Private Event Dining
              </span>
              <h1
                className="font-['Playfair_Display'] text-[#F5F0E8] leading-tight mb-4"
                style={{
                  fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
                  fontWeight: 600,
                }}
              >
                Exclusive Private
                <br />
                <span className="italic text-[#C8922A]">
                  Dining Experiences
                </span>
              </h1>
              <p className="text-[#F5F0E8]/75 text-lg mb-8 font-['Lato'] leading-relaxed max-w-xl">
                Where every celebration becomes a culinary masterpiece. Chef
                Ramos crafts bespoke dining events tailored to your vision, your
                guests, and your palate.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/package-selection"
                  className="px-7 py-3.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full hover:opacity-90 transition-all shadow-lg shadow-[#C8922A]/30 flex items-center gap-2 font-['Lato']"
                >
                  Book Your Celebration
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/packages"
                  className="px-7 py-3.5 border border-[#F5F0E8]/50 text-[#F5F0E8] rounded-full hover:border-[#C8922A] hover:text-[#C8922A] transition-all font-['Lato']"
                >
                  Explore Packages
                </Link>
              </div>
            </div>

            {/* Right Side - Image and Quote */}
            <div className="flex flex-col items-center justify-center gap-6 md:gap-8">
              {/* Image Container */}
              <div className="relative w-full max-w-sm">
                {/* Image with decorative border and effects */}
                <div
                  className="relative rounded-3xl overflow-hidden shadow-2xl"
                  style={{ aspectRatio: "3/4" }}
                >
                  <img
                    src="/mr-ramos.png"
                    alt="Chef Ramos"
                    className="w-full h-full object-cover"
                  />
                  {/* Subtle overlay for color grading */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#C8922A]/10 via-transparent to-[#1A0E08]/20" />
                  {/* Edge highlight for blend */}
                  <div className="absolute inset-0 rounded-3xl border-2 border-[#C8922A]/20" />
                </div>

                {/* Decorative accent */}
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-[#C8922A]/10 rounded-full blur-2xl" />
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-[#C4541A]/5 rounded-full blur-2xl" />
              </div>

              {/* Quote */}
              <div className="text-center mt-2">
                <p
                  className="font-['Playfair_Display'] italic text-[#F5F0E8] leading-relaxed"
                  style={{ fontSize: "clamp(1.1rem, 2vw, 1.4rem)" }}
                >
                  "Bringing authentic flavors
                  <br />
                  from our kitchen to your home"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-0.5 h-8 bg-gradient-to-b from-[#C8922A] to-transparent rounded" />
        </div>
      </section>

      {/* ─── Announcements ─── */}
      <section className="bg-[#2C1810] border-y border-[#C8922A]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#C8922A]/20 bg-[#1A0E08]/70 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-['Lato'] uppercase tracking-[0.3em] text-[#C8922A]">
                Latest updates
              </p>
              <p className="mt-1 text-sm font-['Lato'] text-[#F5F0E8]">
                New seasonal menus, private dining openings, and live singing or
                acoustic sets are now featured for July bookings.
              </p>
            </div>
            <Link
              to="/package-selection"
              className="inline-flex items-center justify-center rounded-full bg-[#C8922A] px-4 py-2 text-sm font-['Lato'] text-[#F5F0E8] hover:bg-[#C4541A] transition-colors"
            >
              Reserve Now
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="bg-[#2C1810] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon size={20} className="text-[#C8922A] mx-auto mb-2" />
                <p className="text-[#F5F0E8] text-2xl font-['Playfair_Display']">
                  {stat.value}
                </p>
                <p className="text-[#F5F0E8]/50 text-xs font-['Lato'] uppercase tracking-widest">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Event Setups Carousel ─── */}
      <section className="py-20 bg-[#F5F0E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-2">
              ✦ Featured Events
            </p>
            <h2
              className="font-['Playfair_Display'] text-[#2C1810]"
              style={{
                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                fontWeight: 600,
              }}
            >
              Every Occasion, Perfectly Curated
            </h2>
            <p className="text-[#2C1810]/60 mt-3 max-w-xl mx-auto font-['Lato']">
              From intimate birthdays to grand corporate galas — our venues and
              culinary team transform any occasion into an extraordinary memory.
            </p>
          </div>

          <div className="relative">
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{ height: "420px" }}
            >
              {CAROUSEL_EVENTS.map((event, i) => (
                <div
                  key={event.title}
                  className={`absolute inset-0 transition-opacity duration-700 ${i === carouselIndex ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                >
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E08]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8">
                    <span className="px-3 py-1 rounded-full bg-[#C8922A] text-[#F5F0E8] text-xs font-['Lato'] tracking-wide mb-3 inline-block">
                      {event.tag}
                    </span>
                    <h3 className="text-[#F5F0E8] font-['Playfair_Display'] text-3xl">
                      {event.title}
                    </h3>
                    <p className="text-[#F5F0E8]/70 font-['Lato'] text-sm mt-1">
                      {event.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel Controls */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#2C1810]/70 text-[#F5F0E8] flex items-center justify-center hover:bg-[#C8922A] transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#2C1810]/70 text-[#F5F0E8] flex items-center justify-center hover:bg-[#C8922A] transition-colors"
            >
              <ChevronRight size={20} />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {CAROUSEL_EVENTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  className={`rounded-full transition-all ${i === carouselIndex ? "w-6 h-2 bg-[#C8922A]" : "w-2 h-2 bg-[#C8922A]/30"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Upcoming Events Calendar ─── */}
      <section className="py-20 bg-[#EDE8DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-2">
              ✦ Upcoming Events
            </p>
            <h2
              className="font-['Playfair_Display'] text-[#2C1810]"
              style={{
                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                fontWeight: 600,
              }}
            >
              Calendar of Private Dining Schedules
            </h2>
            <p className="text-[#2C1810]/60 mt-3 max-w-xl mx-auto font-['Lato']">
              Browse the next few dates and reserve a preferred slot for your
              private celebration, including live music and in-restaurant
              performances.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
            <div className="rounded-3xl bg-[#2C1810] p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#C8922A]">
                    Schedule view
                  </p>
                  <h3 className="mt-1 font-['Playfair_Display'] text-2xl text-[#F5F0E8]">
                    {monthLabel}
                  </h3>
                </div>
                <div className="rounded-full border border-[#C8922A]/30 px-3 py-1.5">
                  <span className="text-sm font-['Lato'] text-[#F5F0E8]">
                    {UPCOMING_EVENTS.length} upcoming
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-7 gap-2 text-center text-[10px] uppercase tracking-[0.25em] text-[#F5F0E8]/60">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => (
                  <button
                    key={day ? day.dateKey : `empty-${index}`}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setSelectedDate(day.dateKey)}
                    className={`flex h-14 flex-col items-center justify-center rounded-2xl border text-sm transition-all ${
                      day
                        ? day.hasEvent
                          ? day.isSelected
                            ? "border-[#C8922A] bg-[#C8922A]/20 text-[#F5F0E8]"
                            : "border-[#F5F0E8]/10 bg-[#1A0E08]/60 text-[#F5F0E8] hover:border-[#C8922A]/40"
                          : "border-transparent bg-transparent text-[#F5F0E8]/40"
                        : "border-transparent bg-transparent"
                    }`}
                  >
                    {day ? (
                      <>
                        <span>{day.day}</span>
                        {day.hasEvent && (
                          <span
                            className={`mt-1 h-1.5 w-1.5 rounded-full ${day.isSelected ? "bg-[#F5F0E8]" : "bg-[#C8922A]"}`}
                          />
                        )}
                      </>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#C8922A]/20 bg-[#F5F0E8] p-6 sm:p-8 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#C8922A]">
                Selected day
              </p>
              <h3 className="mt-2 font-['Playfair_Display'] text-2xl text-[#2C1810]">
                {selectedEvent.title}
              </h3>
              <p className="mt-2 text-sm font-['Lato'] text-[#2C1810]/70">
                {new Date(selectedEvent.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>

              <div className="mt-6 space-y-3">
                {visibleEvents.map((event) => (
                  <button
                    key={event.date}
                    type="button"
                    onClick={() => setSelectedDate(event.date)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedDate === event.date ? "border-[#C8922A] bg-[#FFF8EF]" : "border-[#C8922A]/20 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-['Lato'] font-semibold text-[#2C1810]">
                          {event.title}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[#C8922A]">
                          {event.type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-['Playfair_Display'] text-[#2C1810]">
                          {new Date(event.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs font-['Lato'] text-[#2C1810]/60">
                          {event.time}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-['Lato'] text-[#2C1810]/70">
                      {event.guests}
                    </p>
                  </button>
                ))}
              </div>

              {UPCOMING_EVENTS.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllEvents((value) => !value)}
                  className="mt-4 text-sm font-['Lato'] font-semibold text-[#C8922A] hover:text-[#C4541A] transition-colors"
                >
                  {showAllEvents
                    ? "Show less"
                    : `Show all (${UPCOMING_EVENTS.length})`}
                </button>
              )}

              <Link
                to="/package-selection"
                className="mt-6 inline-flex items-center gap-2 text-[#C8922A] font-['Lato'] hover:gap-3 transition-all"
              >
                Reserve a date <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── About Intro ─── */}
      <section className="py-20 bg-[#EDE8DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <img
                src={IMAGES.chef}
                alt="Chef Ramos"
                className="w-full rounded-2xl object-cover shadow-xl"
                style={{ height: "480px" }}
              />
              <div className="absolute -bottom-4 -right-4 bg-[#2C1810] rounded-2xl px-6 py-4 shadow-xl hidden md:block">
                <p className="text-[#C8922A] font-['Playfair_Display'] text-xl">
                  3 Years
                </p>
                <p className="text-[#F5F0E8]/70 text-xs font-['Lato']">
                  of Culinary Excellence
                </p>
              </div>
            </div>
            <div>
              <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
                ✦ Our Story
              </p>
              <h2
                className="font-['Playfair_Display'] text-[#2C1810] mb-5"
                style={{
                  fontSize: "clamp(1.8rem, 3vw, 2.3rem)",
                  fontWeight: 600,
                }}
              >
                Crafting Memories Through{" "}
                <span className="italic text-[#C4541A]">Authentic Flavors</span>
              </h2>
              <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-4">
                For over a 3 Years, Chef Ramos has been transforming private
                celebrations into extraordinary culinary journeys. Driven by
                passion, dedication, and years of hands-on experience, Chef
                Ramos brings quality flavors and exceptional dining experiences
                to every dish he serves.
              </p>
              <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-8">
                Our private venue in the heart of Taguig offers an exclusive,
                intimate setting — perfect for birthdays, weddings, corporate
                dinners, and every milestone worth celebrating.
              </p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { icon: Heart, label: "Personalized Menus" },
                  { icon: Utensils, label: "Farm-to-Table" },
                  { icon: Briefcase, label: "Corporate Catering" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#C8922A]/10 border border-[#C8922A]/30"
                  >
                    <Icon size={14} className="text-[#C8922A]" />
                    <span className="text-[#2C1810] text-sm font-['Lato']">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 mt-8 text-[#C8922A] font-['Lato'] hover:gap-3 transition-all"
              >
                Learn More About Chef Ramos <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="py-20 bg-[#2C1810]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-2">
              ✦ Testimonials
            </p>
            <h2
              className="font-['Playfair_Display'] text-[#F5F0E8]"
              style={{
                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                fontWeight: 600,
              }}
            >
              What Our Guests Say
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.slice(0, 3).map((t) => (
              <div
                key={t.id}
                className="bg-[#1A0E08] rounded-2xl p-6 border border-[#C8922A]/10 hover:border-[#C8922A]/30 transition-colors"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={
                        i < t.rating
                          ? "text-[#C8922A] fill-[#C8922A]"
                          : "text-[#C8922A]/20"
                      }
                    />
                  ))}
                </div>
                <p className="text-[#F5F0E8]/75 text-sm font-['Lato'] leading-relaxed mb-5 italic">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
                    <span className="text-[#F5F0E8] text-sm font-['Playfair_Display']">
                      {t.avatar}
                    </span>
                  </div>
                  <div>
                    <p className="text-[#F5F0E8] text-sm font-['Playfair_Display']">
                      {t.name}
                    </p>
                    <p className="text-[#C8922A]/70 text-xs font-['Lato']">
                      {t.event}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={IMAGES.ambiance}
            alt="Venue"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#1A0E08]/85" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-4">
            ✦ Reserve Your Celebration
          </p>
          <h2
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-5"
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600 }}
          >
            Your Perfect Event Awaits
          </h2>
          <p className="text-[#F5F0E8]/70 font-['Lato'] mb-8 leading-relaxed">
            Let Chef Ramos and our dedicated team craft an unforgettable
            culinary experience for your next milestone. Limited slots available
            — reserve yours today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/package-selection"
              className="px-8 py-3.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full hover:opacity-90 transition-all shadow-lg font-['Lato']"
            >
              Book Your Celebration
            </Link>
            <Link
              to="/packages"
              className="px-8 py-3.5 border border-[#F5F0E8]/40 text-[#F5F0E8] rounded-full hover:border-[#C8922A] hover:text-[#C8922A] transition-all font-['Lato']"
            >
              Explore Packages
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
