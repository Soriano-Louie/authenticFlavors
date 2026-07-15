import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { createBooking } from "../api/bookingApi";
import { getPackages, getMenuCategories, getMenuItems, getEventTypes, getVenueSetups } from "../api/packageApi";
import type { Package, MenuCategory, MenuItem } from "../api/packageApi";

const DEFAULT_EVENT_TYPES = [
  "Birthday",
  "Anniversary",
  "Corporate",
  "Wedding",
  "Family Celebration",
  "Graduation",
  "Other",
];

const DEFAULT_VENUE_OPTIONS = [
  { key: "Floral Arrangements", label: "Floral Arrangements" },
  { key: "Candle Lighting", label: "Candle Lighting" },
  { key: "Projector & Screen", label: "Projector & Screen" },
  { key: "Sound System / PA", label: "Sound System / PA" },
  { key: "Photo Backdrop", label: "Photo Backdrop" },
  { key: "Balloon Décor", label: "Balloon Décor" },
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

// Calculate price based on pax from pricing table
function getPackagePriceForPax(selectedPkg: any, pax: number) {
  if (!selectedPkg) return 0;
  if (selectedPkg.pricing && selectedPkg.pricing.length > 0) {
    const tier = selectedPkg.pricing.find((t: any) => t.pax_count === pax);
    if (tier) return Number(tier.price);
  }
  return 0;
}

// Transform database package to match expected structure
function transformPackage(pkg: Package, categories: MenuCategory[], items: MenuItem[]) {
  const packageId = String(pkg.package_id);
  
  const menuSections = categories.map(category => {
    const categoryItems = items
      .filter(item => item.category_id === category.category_id)
      .map(item => item.item_name);
    
    return {
      label: category.category_name,
      items: categoryItems
    };
  }).filter(section => section.items.length > 0);

  const startingPrice = pkg.pricing && pkg.pricing.length > 0 
    ? pkg.pricing[0].price 
    : 0;

  return {
    id: packageId,
    title: pkg.package_name,
    summary: pkg.description || "Catering package for your special event",
    description: pkg.description || "Catering package for your special event",
    serving: `Up to ${pkg.max_pax} guests`,
    priceLabel: `₱${Number(startingPrice).toLocaleString()}`,
    image: pkg.image || "/packagesFood.png",
    pricing: pkg.pricing || [],
    minPax: pkg.min_pax,
    maxPax: pkg.max_pax,
    menuSections,
    inclusions: [
      "Premium table setup",
      "Service staff",
      "Event coordination",
      "Sound system",
      "Basic table décor"
    ]
  };
}

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dynamic Data States
  const [packages, setPackages] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>(DEFAULT_EVENT_TYPES);
  const [venueSetups, setVenueSetups] = useState<Array<{ key: string; label: string }>>(DEFAULT_VENUE_OPTIONS);
  const [loading, setLoading] = useState(true);

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
    preselectedPackage || "1",
  );
  const [menuChoices, setMenuChoices] =
    useState<Record<string, string>>(initialMenuChoices);

  // Step 3
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState("");

  // Step 4
  const [venueOptions, setVenueOptions] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");

  // Fetch Packages, Event Types, Venue Setups from Database
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [packagesData, categoriesData, itemsData, eventTypesData, venueSetupsData] = await Promise.all([
          getPackages(),
          getMenuCategories(),
          getMenuItems(),
          getEventTypes(),
          getVenueSetups(),
        ]);

        const transformed = packagesData.packages.map(pkg => 
          transformPackage(pkg, categoriesData.categories, itemsData.items)
        );
        setPackages(transformed);

        if (eventTypesData.eventTypes && eventTypesData.eventTypes.length > 0) {
          setEventTypes(eventTypesData.eventTypes.map(t => t.type_name));
        }
        if (venueSetupsData.venueSetups && venueSetupsData.venueSetups.length > 0) {
          setVenueSetups(venueSetupsData.venueSetups.map(v => ({
            key: v.setup_name,
            label: v.setup_name,
          })));
        }
      } catch (err) {
        console.error("Failed to load DB details, using fallbacks:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Autofill user details from Auth Context (Requirement 1)
  useEffect(() => {
    if (user) {
      setContactName(prev => prev || `${user.first_name}${user.middle_name ? " " + user.middle_name : ""} ${user.last_name}`);
      setContactEmail(prev => prev || user.email);
      setContactPhone(prev => prev || user.phone_number || "");
    }
  }, [user]);

  const toggleAllergy = (key: string) =>
    setAllergies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const toggleVenue = (key: string) =>
    setVenueOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  // Selected package memo matching legacy keys to numeric database IDs
  const selectedPackage = useMemo(() => {
    if (packages.length === 0) return null;
    let found = packages.find((p) => String(p.id) === String(selectedPackageId));
    if (!found) {
      const legacyMap: Record<string, string> = {
        "package-a": "1",
        "package-b": "2",
        "package-c": "3",
        "package-d": "4"
      };
      const mappedId = legacyMap[selectedPackageId];
      found = packages.find((p) => String(p.id) === String(mappedId));
    }
    return found || packages[0];
  }, [selectedPackageId, packages]);

  const totalEstimate = useMemo(() => {
    return getPackagePriceForPax(selectedPackage, guestCount);
  }, [selectedPackage, guestCount]);

  const hasAllMenuChoices = useMemo(() => {
    if (!selectedPackage) return false;
    return selectedPackage.menuSections.every(
      (section: any) => menuChoices[section.label],
    );
  }, [selectedPackage, menuChoices]);

  useEffect(() => {
    if (!selectedPackage) return;
    setMenuChoices((prev) => {
      const next: Record<string, string> = {};

      selectedPackage.menuSections.forEach((section: any) => {
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

  const handleConfirmBooking = async () => {
    if (!accessToken) {
      toast.error("You must be logged in to book.");
      return;
    }
    if (!selectedPackage) {
      toast.error("Please select a package.");
      return;
    }
    if (!eventDate || !contactName || !contactEmail || !startTime) {
      toast.error("Please fill in all required event details.");
      return;
    }
    if (!hasAllMenuChoices) {
      toast.error("Please complete all menu selections.");
      return;
    }
    if (totalEstimate <= 0) {
      toast.error("Could not calculate price. Please check your selections.");
      return;
    }

    const menuSelectionNames = Object.values(menuChoices).filter(Boolean);
    const allergyText = allergies.map(k => ALLERGY_OPTIONS.find(a => a.key === k)?.label || k).join(", ");
    const fullAllergyNotes = [allergyText, dietaryNotes].filter(Boolean).join("\n");

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createBooking(accessToken, {
        package_id: Number(selectedPackage.id),
        event_type_name: eventType,
        venue_setup_name: venueOptions[0] || "Standard Setup",
        venue_setup_names: venueOptions.length > 0 ? venueOptions : ["Standard Setup"],
        number_of_pax: guestCount,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || undefined,
        event_date: eventDate,
        start_time: eventTime,
        allergy_notes: fullAllergyNotes || undefined,
        dietary_notes: specialRequests || undefined,
        menu_selections: menuSelectionNames,
        total_price: totalEstimate,
      });

      toast.success("Booking submitted successfully!");
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit booking. Please try again.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const startTime = eventTime;

  const canProceed = () => {
    if (step === 1) return eventDate && contactName && contactEmail;
    if (step === 2) return !!selectedPackageId && hasAllMenuChoices;
    return true;
  };

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-[#C8922A] mx-auto mb-3" />
          <p className="text-[#2C1810] font-['Lato'] text-sm">Loading booking details...</p>
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
                    {eventTypes.map((t) => (
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
                {venueSetups.map((opt) => (
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
                          {venueSetups.find((o) => o.key === v)?.label || v}
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
          <div className="flex flex-col gap-3 mt-8 pt-5 border-t border-[#C8922A]/10">
            {submitError && (
              <p className="text-xs text-[#C4541A] font-['Lato'] text-center font-medium">{submitError}</p>
            )}
            <div className="flex justify-between">
              <button
                onClick={() => goToStep(Math.max(1, step - 1))}
                disabled={step === 1 || submitting}
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
                  onClick={handleConfirmBooking}
                  disabled={submitting}
                  className="px-7 py-2.5 bg-gradient-to-r from-[#7A8C5C] to-[#5A6C3C] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                  ) : (
                    <><CheckCircle size={16} /> Confirm Booking</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
