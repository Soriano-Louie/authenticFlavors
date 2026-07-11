import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router";
import {
  Check,
  ChevronRight,
  Users,
  Calendar,
  Utensils,
  AlertTriangle,
  FileText,
  CheckCircle,
  X,
} from "lucide-react";
import { PACKAGE_OPTIONS, getPackagePriceForPax } from "../data/mockData";

const EVENT_TYPES = [
  "Birthday",
  "Anniversary",
  "Corporate",
  "Wedding",
  "Family Celebration",
  "Graduation",
  "Other",
];
const ALLERGY_OPTIONS = [
  { key: "nuts", label: "Tree Nuts", color: "#C4541A" },
  { key: "peanuts", label: "Peanuts", color: "#C4541A" },
  { key: "dairy", label: "Dairy / Lactose", color: "#C8922A" },
  { key: "gluten", label: "Gluten / Wheat", color: "#C8922A" },
  { key: "shellfish", label: "Shellfish", color: "#C4541A" },
  { key: "seafood", label: "Seafood", color: "#C8922A" },
  { key: "pork", label: "Pork", color: "#7A8C5C" },
  { key: "alcohol", label: "Alcohol", color: "#7A8C5C" },
  { key: "eggs", label: "Eggs", color: "#C8922A" },
  { key: "soy", label: "Soy", color: "#C8922A" },
];

const VENUE_OPTIONS = [
  { key: "floral", label: "Floral Arrangements" },
  { key: "candles", label: "Candle Lighting" },
  { key: "projector", label: "Projector & Screen" },
  { key: "sound", label: "Sound System / PA" },
  { key: "photo", label: "Photo Backdrop" },
  { key: "balloon", label: "Balloon Décor" },
];

const STEPS = [
  { num: 1, label: "Event Details", icon: Calendar },
  { num: 2, label: "Food Package", icon: Utensils },
  { num: 3, label: "Dietary Needs", icon: AlertTriangle },
  { num: 4, label: "Venue Setup", icon: FileText },
  { num: 5, label: "Confirmation", icon: CheckCircle },
];

function parseMenuSelections(value: string | null) {
  if (!value) return {} as Record<string, string>;

  try {
    return JSON.parse(decodeURIComponent(value)) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const preselectedPackage = searchParams.get("package") ?? "";
  const preselectedEventType = searchParams.get("event") ?? "Birthday";
  const paxOptions = [30, 40, 50, 60, 70];
  const initialMenuChoices = useMemo(
    () => parseMenuSelections(searchParams.get("menu")),
    [searchParams],
  );
  const initialPax = Number(searchParams.get("pax") || 30);
  const normalizedInitialPax = paxOptions.includes(initialPax)
    ? initialPax
    : 30;

  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Step 1
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("18:00");
  const [guestCount, setGuestCount] = useState(normalizedInitialPax);
  const [eventType, setEventType] = useState(preselectedEventType);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Step 2
  const [selectedPackageId, setSelectedPackageId] = useState(
    preselectedPackage || "package-a",
  );
  const [menuChoices, setMenuChoices] =
    useState<Record<string, string>>(initialMenuChoices);

  // Step 3
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState("");

  // Step 4
  const [venueOptions, setVenueOptions] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");

  const toggleAllergy = (key: string) =>
    setAllergies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const toggleVenue = (key: string) =>
    setVenueOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const selectedPackage =
    PACKAGE_OPTIONS.find((p) => p.id === selectedPackageId) ??
    PACKAGE_OPTIONS[0];
  const totalEstimate = Number(getPackagePriceForPax(selectedPackage, guestCount));
  const hasAllMenuChoices = selectedPackage.menuSections.every(
    (section) => menuChoices[section.label],
  );

  useEffect(() => {
    setMenuChoices((prev) => {
      const next: Record<string, string> = {};

      selectedPackage.menuSections.forEach((section) => {
        const existingChoice =
          prev[section.label] || initialMenuChoices[section.label];
        next[section.label] = section.items.includes(existingChoice)
          ? existingChoice
          : section.items[0];
      });

      return next;
    });
  }, [initialMenuChoices, selectedPackage]);

  const selectMenuItem = (sectionLabel: string, item: string) => {
    setMenuChoices((prev) => ({
      ...prev,
      [sectionLabel]: item,
    }));
  };

  const canProceed = () => {
    if (step === 1) return eventDate && contactName && contactEmail;
    if (step === 2) return !!selectedPackageId && hasAllMenuChoices;
    return true;
  };

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl text-center">
          <div className="w-16 h-16 rounded-full bg-[#7A8C5C]/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={30} className="text-[#7A8C5C]" />
          </div>
          <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-3">
            Booking Submitted!
          </h2>
          <p className="text-[#2C1810]/65 font-['Lato'] text-sm leading-relaxed mb-6">
            Thank you, <strong>{contactName}</strong>! Your reservation request
            for <em>{selectedPackage.title}</em> on <strong>{eventDate}</strong>{" "}
            has been received. Our team will confirm via{" "}
            <strong>{contactEmail}</strong> within 24–48 hours.
          </p>
          <div className="bg-[#EDE8DF] rounded-xl p-4 text-sm font-['Lato'] text-left space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-[#2C1810]/50">Event</span>
              <span className="text-[#2C1810]">{eventType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#2C1810]/50">Package</span>
              <span className="text-[#2C1810]">{selectedPackage.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#2C1810]/50">Guests</span>
              <span className="text-[#2C1810]">{guestCount}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-[#2C1810]/50">Est. Total</span>
              <span className="text-[#C8922A]">
                ₱{totalEstimate.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="bg-[#F5F0E8] rounded-xl p-4 text-sm font-['Lato'] text-left space-y-2 mb-6">
            <p className="text-[#C8922A] text-xs uppercase tracking-widest">
              Confirmed Menu Choices
            </p>
            {selectedPackage.menuSections.map((section) => (
              <div key={section.label} className="flex justify-between gap-3">
                <span className="text-[#2C1810]/50">{section.label}</span>
                <span className="text-[#2C1810] text-right">
                  {menuChoices[section.label] || "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Link
              to="/"
              className="flex-1 py-3 border border-[#C8922A] text-[#C8922A] rounded-full text-sm font-['Lato'] hover:bg-[#C8922A] hover:text-[#F5F0E8] transition-colors text-center"
            >
              Go Home
            </Link>
            <Link
              to="/dashboard"
              className="flex-1 py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity text-center"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0E8] min-h-screen">
      {/* Header */}
      <div className="bg-[#2C1810] py-10 px-4 text-center">
        <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-2">
          ✦ Reserve Your Event
        </p>
        <h1
          className="font-['Playfair_Display'] text-[#F5F0E8]"
          style={{ fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 600 }}
        >
          Book Your Celebration
        </h1>
        <p className="text-[#F5F0E8]/60 font-['Lato'] text-sm mt-2 max-w-lg mx-auto">
          Complete the form below to begin planning your exclusive private
          dining experience.
        </p>
      </div>

      {/* Stepper */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between overflow-x-auto pb-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-0">
              <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all ${
                    step > s.num
                      ? "bg-[#7A8C5C] text-[#F5F0E8]"
                      : step === s.num
                        ? "bg-gradient-to-br from-[#C8922A] to-[#C4541A] text-[#F5F0E8] shadow-md"
                        : "bg-[#EDE8DF] text-[#2C1810]/40"
                  }`}
                >
                  {step > s.num ? <Check size={16} /> : <s.icon size={16} />}
                </div>
                <span
                  className={`text-[10px] font-['Lato'] text-center hidden sm:block ${step === s.num ? "text-[#C8922A]" : "text-[#2C1810]/40"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-1 ${step > s.num ? "bg-[#7A8C5C]" : "bg-[#C8922A]/20"}`}
                  style={{ minWidth: "20px" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Step 1: Event Details */}
          {step === 1 && (
            <div>
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-6">
                Event Details
              </h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+63 9XX XXX XXXX"
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                    Event Type *
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-2">
                    Guest Count:{" "}
                    <span className="text-[#C8922A] font-medium">
                      {guestCount} pax
                    </span>
                  </label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato']"
                  >
                    {paxOptions.map((pax) => (
                      <option key={pax} value={pax}>
                        {pax} pax
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#2C1810]/45 font-['Lato'] mt-2">
                    Package pricing adjusts automatically for 30, 40, 50, 60, and 70 guests.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Food Package */}
          {step === 2 && (
            <div>
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
                Select Food Package
              </h2>
              <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
                Choose your preferred service style and package.
              </p>

              {/* Style selector */}
              <div className="rounded-3xl border border-[#C8922A]/10 bg-[#F5F0E8] p-6 mb-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm text-[#2C1810]/60 font-['Lato'] mb-2">
                      Selected Package
                    </p>
                    <h3 className="font-['Playfair_Display'] text-[#2C1810] text-3xl">
                      {selectedPackage?.title}
                    </h3>
                    <p className="text-sm text-[#2C1810]/70 font-['Lato'] mt-3">
                      {selectedPackage?.summary}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 text-right">
                    <p className="text-xs uppercase tracking-[0.24em] text-[#C8922A] font-['Lato'] mb-1">
                      Estimated total
                    </p>
                    <p className="text-3xl font-semibold text-[#C8922A]">
                      ₱
                      {Number(getPackagePriceForPax(
                        selectedPackage,
                        guestCount,
                      )).toLocaleString()}
                    </p>
                    <p className="text-xs text-[#2C1810]/50 font-['Lato'] mt-1">
                      for {guestCount} pax
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#C8922A]/10 bg-[#F5F0E8] p-6 mt-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#C8922A] mb-4">
                  Your Menu Selections
                </p>
                <div className="space-y-2 text-sm text-[#2C1810]/70 font-['Lato']">
                  {selectedPackage.menuSections.map((section) => (
                    <div
                      key={section.label}
                      className="flex items-start justify-between gap-3"
                    >
                      <span>{section.label}</span>
                      <span className="text-right font-medium text-[#2C1810]">
                        {menuChoices[section.label] || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6">
                {selectedPackage?.menuSections.map((section) => (
                  <div
                    key={section.label}
                    className="rounded-3xl bg-white p-6 border border-[#C8922A]/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-[#2C1810]">
                        {section.label}
                      </h4>
                      <span className="text-sm text-[#2C1810]/60 font-['Lato']">
                        {section.items.length} items
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {section.items.map((item) => {
                        const isSelected = menuChoices[section.label] === item;

                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => selectMenuItem(section.label, item)}
                            className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-['Lato'] transition-all ${
                              isSelected
                                ? "border-[#C8922A] bg-[#C8922A]/10 text-[#2C1810]"
                                : "border-[#C8922A]/10 bg-[#F5F0E8] text-[#2C1810]/75 hover:border-[#C8922A]/35"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected ? "border-[#C8922A] bg-[#C8922A] text-white" : "border-[#2C1810]/20 bg-white"}`}
                            >
                              {isSelected ? <Check size={12} /> : null}
                            </span>
                            <span>{item}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Dietary Needs */}
          {step === 3 && (
            <div>
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
                Allergy & Dietary Notes
              </h2>
              <div className="bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-xl p-4 mb-6 flex gap-3">
                <AlertTriangle
                  size={18}
                  className="text-[#C4541A] shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[#C4541A] text-sm font-medium font-['Lato']">
                    Important: Allergy & Dietary Information
                  </p>
                  <p className="text-[#2C1810]/70 text-sm font-['Lato'] mt-1 leading-relaxed">
                    Please list any allergies, religious dietary restrictions,
                    or foods to avoid (nuts, shellfish, pork, alcohol, etc.).
                    Chef Ramos will customize the menu accordingly for all
                    affected guests.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-[#2C1810]/60 font-['Lato'] mb-3">
                  Select All That Apply:
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {ALLERGY_OPTIONS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => toggleAllergy(a.key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-['Lato'] border-2 transition-all ${
                        allergies.includes(a.key)
                          ? "text-[#F5F0E8]"
                          : "bg-transparent text-[#2C1810]"
                      }`}
                      style={
                        allergies.includes(a.key)
                          ? { backgroundColor: a.color, borderColor: a.color }
                          : { borderColor: a.color + "50", color: a.color }
                      }
                    >
                      {allergies.includes(a.key) && <Check size={12} />}
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Custom Dietary Restrictions / Notes
                </label>
                <textarea
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="e.g., 5 guests are vegetarian, 2 guests are halal, 1 guest has a severe peanut allergy..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                />
              </div>

              <div className="bg-[#7A8C5C]/10 rounded-xl px-4 py-3 flex items-start gap-2 border border-[#7A8C5C]/20">
                <Check size={16} className="text-[#7A8C5C] mt-0.5 shrink-0" />
                <p className="text-[#2C1810]/70 text-sm font-['Lato']">
                  <strong className="text-[#7A8C5C]">Chef's Guarantee:</strong>{" "}
                  Every dietary need is taken seriously. Chef Ramos personally
                  reviews all restrictions and crafts customized substitutions
                  without compromising the quality or taste of your experience.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Venue Setup */}
          {step === 4 && (
            <div>
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-2">
                Venue Setup Preferences
              </h2>
              <p className="text-[#2C1810]/55 text-sm font-['Lato'] mb-6">
                Select the setup elements you'd like included for your event.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {VENUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleVenue(opt.key)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-['Lato'] transition-all flex items-center gap-2 ${
                      venueOptions.includes(opt.key)
                        ? "border-[#C8922A] bg-[#C8922A]/10 text-[#C8922A]"
                        : "border-[#C8922A]/15 text-[#2C1810]/60 hover:border-[#C8922A]/40"
                    }`}
                  >
                    {venueOptions.includes(opt.key) && <Check size={14} />}
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm text-[#2C1810]/60 font-['Lato'] mb-1.5">
                  Special Requests / Other Notes
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any other requests — music preferences, décor themes, special seating arrangements..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#C8922A]/20 bg-[#F5F0E8] text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <div>
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-6">
                Booking Summary
              </h2>
              <div className="space-y-4">
                {/* Event Info */}
                <div className="bg-[#F5F0E8] rounded-xl p-5">
                  <h4 className="text-[#C8922A] text-xs uppercase tracking-widest font-['Lato'] mb-3">
                    Event Details
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4 text-sm font-['Lato']">
                    {[
                      ["Name", contactName],
                      ["Email", contactEmail],
                      ["Phone", contactPhone || "—"],
                      ["Event Type", eventType],
                      ["Date", eventDate],
                      ["Time", eventTime],
                      ["Guests", `${guestCount} pax`],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between border-b border-[#C8922A]/10 pb-2"
                      >
                        <span className="text-[#2C1810]/50">{k}</span>
                        <span className="text-[#2C1810] font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Package */}
                {selectedPackage && (
                  <div className="bg-[#F5F0E8] rounded-xl p-5">
                    <h4 className="text-[#C8922A] text-xs uppercase tracking-widest font-['Lato'] mb-3">
                      Selected Package
                    </h4>
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedPackage.image}
                        alt={selectedPackage.title}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                      <div>
                        <p className="font-['Playfair_Display'] text-[#2C1810]">
                          {selectedPackage.title}
                        </p>
                        <p className="text-[#2C1810]/50 text-xs font-['Lato']">
                          {selectedPackage.serving}
                        </p>
                        <p className="text-[#C8922A] font-['Lato'] text-sm mt-1">
                          ₱
                          {Number(getPackagePriceForPax(
                            selectedPackage,
                            guestCount,
                          )).toLocaleString()}{" "}
                          for {guestCount} pax
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Menu selections */}
                <div className="bg-[#F5F0E8] rounded-xl p-5">
                  <h4 className="text-[#C8922A] text-xs uppercase tracking-widest font-['Lato'] mb-3">
                    Menu Choices
                  </h4>
                  <div className="space-y-2 text-sm font-['Lato']">
                    {selectedPackage.menuSections.map((section) => (
                      <div
                        key={section.label}
                        className="flex items-start justify-between gap-3 border-b border-[#C8922A]/10 pb-2"
                      >
                        <span className="text-[#2C1810]/50">
                          {section.label}
                        </span>
                        <span className="text-[#2C1810] font-medium text-right">
                          {menuChoices[section.label] || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dietary */}
                {(allergies.length > 0 || dietaryNotes) && (
                  <div className="bg-[#C4541A]/5 rounded-xl p-5 border border-[#C4541A]/15">
                    <h4 className="text-[#C4541A] text-xs uppercase tracking-widest font-['Lato'] mb-3">
                      Dietary Notes
                    </h4>
                    {allergies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {allergies.map((a) => {
                          const opt = ALLERGY_OPTIONS.find((o) => o.key === a);
                          return (
                            <span
                              key={a}
                              className="px-2 py-0.5 rounded-full text-xs font-['Lato'] text-[#F5F0E8]"
                              style={{ backgroundColor: opt?.color }}
                            >
                              {opt?.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {dietaryNotes && (
                      <p className="text-[#2C1810]/70 text-sm font-['Lato']">
                        {dietaryNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Venue */}
                {venueOptions.length > 0 && (
                  <div className="bg-[#F5F0E8] rounded-xl p-5">
                    <h4 className="text-[#C8922A] text-xs uppercase tracking-widest font-['Lato'] mb-3">
                      Venue Preferences
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {venueOptions.map((v) => (
                        <span
                          key={v}
                          className="px-3 py-1 rounded-full bg-[#C8922A]/15 text-[#C8922A] text-xs font-['Lato']"
                        >
                          {VENUE_OPTIONS.find((o) => o.key === v)?.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="bg-[#2C1810] rounded-xl p-5 text-[#F5F0E8]">
                  <div className="flex justify-between text-sm font-['Lato'] mb-2">
                    <span className="text-[#F5F0E8]/60">Selected Pax</span>
                    <span>{guestCount} pax</span>
                  </div>
                  <div className="flex justify-between text-sm font-['Lato'] mb-3">
                    <span className="text-[#F5F0E8]/60">Package Total</span>
                    <span>₱{totalEstimate.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-[#C8922A]/30 pt-3 flex justify-between">
                    <span className="font-['Playfair_Display'] text-lg">
                      Estimated Total
                    </span>
                    <span className="text-[#C8922A] font-['Playfair_Display'] text-xl">
                      ₱{totalEstimate.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[#F5F0E8]/40 text-xs font-['Lato'] mt-1">
                    * Final price confirmed upon booking approval
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-5 border-t border-[#C8922A]/10">
            <button
              onClick={() => goToStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="px-6 py-2.5 border border-[#C8922A]/30 text-[#2C1810]/60 rounded-full text-sm font-['Lato'] hover:border-[#C8922A] hover:text-[#C8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {step < 5 ? (
              <button
                onClick={() => goToStep(step + 1)}
                disabled={!canProceed()}
                className="px-7 py-2.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
              >
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => setShowSuccess(true)}
                className="px-7 py-2.5 bg-gradient-to-r from-[#7A8C5C] to-[#5A6C3C] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
              >
                <CheckCircle size={16} /> Confirm Booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
