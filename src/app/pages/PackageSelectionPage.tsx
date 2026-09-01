import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  Loader2,
  Search,
  Trophy,
} from "lucide-react";
import { BookingRules } from "../components/BookingRules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  getPackages,
  getMenuCategories,
  getMenuItems,
  getPackagePricing,
} from "../api/packageApi";
import type {
  Package,
  MenuCategory,
  MenuItem,
  PackagePricing,
} from "../api/packageApi";
import { useAuth } from "../auth/AuthContext";
import { getPromotion, type Promotion } from "../api/bookingApi";

// Function to get package category label for card header
function getPackageLabel(packageName: string): string {
  return "Curated Package";
}

// Discount amount (₱) a live promotion removes from a displayed price. Kept
// in sync with applyPromotion()/getActiveDiscount() resolution on the backend.
function getPromoAmount(price: number, promo: Promotion | null): number {
  if (!promo?.has_discount || !promo.value || promo.value <= 0) return 0;
  const amount =
    promo.type === "percentage"
      ? Math.round(price * promo.value) / 100
      : promo.value;
  return Math.max(0, Math.min(amount, price));
}

// Normalize package images to a consistent 16:9 crop so cards render
// with the same aspect ratio and zoom regardless of the source image.
function getNormalizedImage(image: string | null, packageName?: string): string {
  if (!image) {
    if (packageName) {
      const lower = packageName.toLowerCase();
      if (lower.includes("package a") || lower === "a") return "/packagesImage/package A.png";
      if (lower.includes("package b") || lower === "b") return "/packagesImage/Package B.png";
      if (lower.includes("package c") || lower === "c") return "/packagesImage/Package C.png";
      if (lower.includes("package d") || lower === "d") return "/packagesImage/Package D.png";
    }
    return "/packagesFood.png";
  }
  if (
    image.includes("res.cloudinary.com") &&
    image.includes("/image/upload/")
  ) {
    return image.replace(
      "/image/upload/",
      "/image/upload/w_720,h_405,c_fill,g_auto,f_auto,q_auto/",
    );
  }
  return image;
}

// Transform database package to match expected structure
function transformPackage(
  pkg: Package,
  categories: MenuCategory[],
  items: MenuItem[],
) {
  const packageId = String(pkg.package_id);

  const includedItemIds = new Set(
    (pkg.menu_inclusions || []).map((inc) => inc.menu_item_id),
  );
  const hasInclusions = includedItemIds.size > 0;

  // Group menu items by category
  const menuSections = categories
    .map((category) => {
      const categoryItems = items
        .filter((item) => {
          if (hasInclusions && !includedItemIds.has(item.menu_item_id))
            return false;
          return item.category_id === category.category_id;
        })
        .map((item) => item.item_name);

      return {
        label: category.category_name,
        items: categoryItems,
      };
    })
    .filter((section) => section.items.length > 0);

  // Get starting price (lowest pax)
  const startingPrice =
    pkg.pricing && pkg.pricing.length > 0 ? pkg.pricing[0].price : 0;

  return {
    id: packageId,
    title: pkg.package_name,
    summary: pkg.description || "Catering package for your special event",
    description: pkg.description || "Catering package for your special event",
    serving: `Up to ${pkg.max_pax} guests`,
    priceLabel: `₱${Number(startingPrice).toLocaleString()}`,
    image: getNormalizedImage(pkg.image, pkg.package_name),
    pricing: pkg.pricing || [],
    maxPax: pkg.max_pax,
    isMostPicked: Boolean(pkg.is_most_picked),
    menuSections,
    inclusions: [
      "Premium table setup",
      "Service staff",
      "Event coordination",
      "Sound system",
      "Basic table décor",
    ],
  };
}

// Calculate price based on pax from pricing table
function getPackagePriceForPax(pricing: PackagePricing[], pax: number) {
  const pricingEntry = pricing.find((p) => p.pax_count === pax);
  return pricingEntry ? pricingEntry.price : 0;
}

export function PackageSelectionPage() {
  const navigate = useNavigate();
  const { user, isBootstrapping } = useAuth();
  const [searchParams] = useSearchParams();
  const eventType = searchParams.get("event") || "Birthday";
  const selectedPackageQuery = searchParams.get("package") || "1";
  const initialPax = Number(searchParams.get("pax") || 30);
  const [selectedPackageId, setSelectedPackageId] =
    useState<string>(selectedPackageQuery);
  const [selectedPax, setSelectedPax] = useState<number>(initialPax);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  const handleSelectPackage = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    // scroll is handled by the useEffect below
  };

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  // Data fetching state
  const [packages, setPackages] = useState<Package[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "Don't show again" is scoped to the current browser session AND the
  // current account, so it is suppressed only for this visit/session — the
  // modal always comes back when a new session starts or another user logs in.
  const dismissStorageKey = `af-booking-rules-dismissed-${user?.user_id ?? "guest"}`;
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(true);
  // Tracks whether the modal was opened by tapping the "Booking Policies &
  // Rules" button (manual) vs. shown automatically on page load. The "Don't
  // show again" checkbox only applies to the automatic popup.
  const [rulesOpenedManually, setRulesOpenedManually] = useState(false);
  const [canContinueBooking, setCanContinueBooking] = useState(false);

  // Scroll to the details section whenever a package is selected.
  // Using requestAnimationFrame ensures React has committed the DOM
  // before we measure the element position — fixing the "needs a refresh" bug.
  useEffect(() => {
    if (loading || !detailsRef.current) return;
    const navOffset = 80;
    const raf = requestAnimationFrame(() => {
      if (!detailsRef.current) return;
      const elementPosition = detailsRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedPackageId, loading]);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [packagesData, categoriesData, itemsData] = await Promise.all([
          getPackages(),
          getMenuCategories(),
          getMenuItems(),
        ]);

        setPackages(packagesData.packages);
        setCategories(categoriesData.categories);
        setItems(itemsData.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Live promotion per package card, resolved at each package's starting
  // (lowest) tier so the displayed "starting price" reflects any discount.
  const [cardPromos, setCardPromos] = useState<Record<string, Promotion | null>>(
    {},
  );
  useEffect(() => {
    if (packages.length === 0) return;
    let cancelled = false;
    setCardPromos({});
    packages.forEach((pkg) => {
      const startingPax = pkg.pricing?.[0]?.pax_count;
      getPromotion(pkg.package_id, startingPax)
        .then((promo) => {
          if (!cancelled) {
            setCardPromos((prev) => ({
              ...prev,
              [String(pkg.package_id)]: promo,
            }));
          }
        })
        .catch(() => {
          // Promo lookup failure must never break the package list.
        });
    });
    return () => {
      cancelled = true;
    };
  }, [packages]);

  // Live promotion for the selected package at the currently selected pax,
  // used by the detail panel price and the estimated total.
  const [detailPromo, setDetailPromo] = useState<Promotion | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDetailPromo(null);
    const pkg = packages.find(
      (p) => String(p.package_id) === String(selectedPackageId),
    );
    if (pkg) {
      getPromotion(pkg.package_id, selectedPax)
        .then((promo) => {
          if (!cancelled) setDetailPromo(promo);
        })
        .catch(() => {
          // Promo lookup failure must never break the booking flow.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedPackageId, selectedPax, packages]);

  const transformedPackages = useMemo(() => {
    return packages.map((pkg) => transformPackage(pkg, categories, items));
  }, [packages, categories, items]);

  // Filter packages based on search query
  const filteredPackages = useMemo(() => {
    if (!searchQuery.trim()) {
      return transformedPackages;
    }

    const query = searchQuery.toLowerCase();
    return transformedPackages.filter((pkg) => {
      return (
        pkg.title.toLowerCase().includes(query) ||
        pkg.description.toLowerCase().includes(query) ||
        pkg.summary.toLowerCase().includes(query)
      );
    });
  }, [transformedPackages, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPackages.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPackages = filteredPackages.slice(startIndex, endIndex);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Update items per page based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setItemsPerPage(4);
      } else if (window.innerWidth < 1024) {
        setItemsPerPage(6);
      } else {
        setItemsPerPage(6);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const selectedPackage = useMemo(
    () =>
      transformedPackages.find((pkg) => pkg.id === selectedPackageId) ??
      transformedPackages[0],
    [selectedPackageId, transformedPackages],
  );

  // Generate pax options from pricing data
  const paxOptions = useMemo(() => {
    if (
      selectedPackage &&
      selectedPackage.pricing &&
      selectedPackage.pricing.length > 0
    ) {
      return selectedPackage.pricing.map((p) => p.pax_count);
    }
    return [30, 40, 50, 60, 70, 80, 90, 100]; // Fallback
  }, [selectedPackage]);

  // Update selected pax if it's not in the available options
  useEffect(() => {
    if (!paxOptions.includes(selectedPax) && paxOptions.length > 0) {
      setSelectedPax(paxOptions[0]);
    }
  }, [paxOptions, selectedPax]);

  // Respect the session/account-scoped "don't show again" preference once the
  // auth state has settled. Re-evaluates when the logged-in account changes,
  // so the modal pops up again after a fresh login.
  useEffect(() => {
    if (isBootstrapping) return;
    let dismissed = false;
    try {
      dismissed = Boolean(sessionStorage.getItem(dismissStorageKey));
    } catch {
      dismissed = false;
    }
    setRulesOpenedManually(false);
    setShowRulesModal(!dismissed);
  }, [isBootstrapping, dismissStorageKey]);

  // Enable continue button after 5 seconds when modal opens
  useEffect(() => {
    if (showRulesModal) {
      setCanContinueBooking(false);
      const timer = setTimeout(() => {
        setCanContinueBooking(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showRulesModal]);

  const handleCloseRules = () => {
    if (dontShowAgain && !rulesOpenedManually) {
      try {
        sessionStorage.setItem(dismissStorageKey, "1");
      } catch {
        // Ignore storage errors (e.g., private mode)
      }
    }
    setDontShowAgain(false);
    setShowRulesModal(false);
  };

  const handleOpenRulesManually = () => {
    setRulesOpenedManually(true);
    setShowRulesModal(true);
  };

  const handleProceedToBooking = () => {
    const targetUrl = `/booking?event=${encodeURIComponent(eventType)}&package=${selectedPackage.id}&pax=${selectedPax}`;
    if (!user) {
      navigate("/auth", { state: { from: targetUrl } });
    } else {
      navigate(targetUrl);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 250, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="bg-[#F5F0E8] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="animate-spin text-[#C8922A] mx-auto mb-4"
          />
          <p className="text-[#2C1810] font-['Lato']">Loading packages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F5F0E8] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#C4541A] font-['Lato'] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#C8922A] text-[#F5F0E8] rounded-full font-['Lato'] hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0E8] min-h-screen">
      {/* Rules Popup Modal */}
      <Dialog open={showRulesModal && !isBootstrapping}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#2C1810] border-[#C8922A]/30 text-[#F5F0E8] max-h-[85vh] overflow-y-auto outline-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-['Playfair_Display'] text-[#C8922A] text-xl">
              Booking Policies & Rules
            </DialogTitle>
            <DialogDescription className="text-[#F5F0E8]/60 font-['Lato'] text-sm">
              Please review the following policies before proceeding with your
              booking.
            </DialogDescription>
          </DialogHeader>
          <BookingRules />
          <DialogFooter>
            {!rulesOpenedManually && (
              <label className="flex items-center justify-center gap-2.5 cursor-pointer select-none mb-4">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-[#C8922A]/40 bg-[#1A0E08] text-[#C8922A] accent-[#C8922A] cursor-pointer"
                />
                <span className="text-sm text-[#F5F0E8]/80 font-['Lato']">
                  Don't show this again for this session
                </span>
              </label>
            )}
            <button
              onClick={handleCloseRules}
              disabled={!canContinueBooking}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!canContinueBooking && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {canContinueBooking ? (
                <>
                  <CheckCircle size={16} /> I Understand, Continue Booking
                </>
              ) : (
                "Please read the policies..."
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div
          className="relative overflow-hidden rounded-[32px] p-10 text-center text-white"
          style={{
            backgroundImage: `url(${selectedPackage.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A0E08]/90 via-[#1A0E08]/70 to-[#1A0E08]/50" />
          <div className="relative z-10">
            <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
              Package Details
            </p>
            <h1 className="font-['Playfair_Display'] text-4xl mb-4">
              View Packages Menus
            </h1>
            <p className="max-w-2xl mx-auto text-sm text-[#F5F0E8]/75 font-['Lato']">
              Review the complete food inclusions here. You can make your food
              choices on the booking page.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-8 mb-6">
          <div className="relative max-w-2xl mx-auto">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2C1810]/40"
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search packages by name or description..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#C8922A]/20 bg-white text-[#2C1810] outline-none focus:border-[#C8922A] text-sm font-['Lato'] placeholder-[#2C1810]/30"
            />
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-[#2C1810]/60 font-['Lato'] mt-2">
              {filteredPackages.length === 0
                ? "No packages found"
                : `Found ${filteredPackages.length} package${filteredPackages.length !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>

        {/* Booking Policies & Rules — reopen modal */}
        <div className="flex justify-center mb-8">
          <button
            type="button"
            onClick={handleOpenRulesManually}
            className="inline-flex w-full max-w-2xl items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C8922A]/60 bg-[#C8922A]/10 px-5 py-3 text-sm font-['Lato'] font-semibold text-[#2C1810]/80 hover:border-[#C8922A] hover:bg-[#C8922A]/20 transition-colors"
          >
            <AlertTriangle size={18} className="text-[#C4541A] shrink-0" />
            Booking Policies &amp; Rules
            <span className="hidden sm:inline font-normal text-[#2C1810]/60">
              — Review these before booking
            </span>
          </button>
        </div>

        {/* Package Grid */}
        {filteredPackages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#2C1810]/60 font-['Lato'] text-lg">
              No packages found
            </p>
            <p className="text-[#2C1810]/40 font-['Lato'] text-sm mt-2">
              Try adjusting your search terms
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handleSelectPackage(pkg.id)}
                  className={`flex h-full flex-col overflow-hidden rounded-3xl border text-left transition-all ${
                    selectedPackageId === pkg.id
                      ? "border-[#C8922A] shadow-lg"
                      : "border-[#C8922A]/20 bg-white hover:border-[#C8922A]/40"
                  }`}
                >
                  <div className="relative shrink-0 overflow-hidden">
                    <img
                      src={pkg.image}
                      alt={pkg.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E08]/85 via-[#1A0E08]/20 to-transparent" />
                    {pkg.isMostPicked && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#C8922A] to-[#C4541A] px-2.5 py-1 text-[11px] font-['Lato'] font-bold uppercase tracking-wide text-[#F5F0E8] shadow-md">
                        <Trophy size={12} /> Most Picked
                      </span>
                    )}
                    {selectedPackageId === pkg.id ? (
                      <span className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-[#C8922A] p-2 text-white shadow-md">
                        <Check size={16} />
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-5 bg-white">
                    <p className="text-xs uppercase tracking-[0.3em] text-[#C8922A] font-['Lato']">
                      {getPackageLabel(pkg.title)}
                    </p>
                    <h2 className="mt-1 text-lg font-['Playfair_Display'] text-[#2C1810]">
                      {pkg.title}
                    </h2>
                    <p className="mt-2 text-sm text-[#2C1810]/70 font-['Lato'] leading-relaxed line-clamp-2">
                      {pkg.summary}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-sm font-['Lato'] text-[#2C1810]/60">
                      <span>{pkg.serving}</span>
                      {(() => {
                        const raw = Number(pkg.pricing?.[0]?.price ?? 0);
                        const amount = getPromoAmount(raw, cardPromos[pkg.id]);
                        if (!amount) {
                          return <span>{pkg.priceLabel}</span>;
                        }
                        return (
                          <div className="flex flex-col items-end leading-tight">
                            {!pkg.priceLabel.includes("—") && (
                              <span className="text-xs text-[#C4541A] line-through">
                                {pkg.priceLabel}
                              </span>
                            )}
                            <span className="font-semibold text-[#C4541A]">
                              ₱{(raw - amount).toLocaleString()}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[#C4541A]">
                              Promo
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-full border border-[#C8922A]/30 text-[#2C1810] text-sm font-['Lato'] hover:border-[#C8922A] hover:text-[#C8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  First
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => {
                      // Show first page, last page, current page, and pages around current
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => goToPage(page)}
                            className={`w-10 h-10 rounded-full text-sm font-['Lato'] transition-colors ${
                              currentPage === page
                                ? "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8]"
                                : "border border-[#C8922A]/30 text-[#2C1810] hover:border-[#C8922A] hover:text-[#C8922A]"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return (
                          <span key={page} className="text-[#2C1810]/40 px-1">
                            ...
                          </span>
                        );
                      }
                      return null;
                    },
                  )}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-full border border-[#C8922A]/30 text-[#2C1810] text-sm font-['Lato'] hover:border-[#C8922A] hover:text-[#C8922A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        <div ref={detailsRef} id="package-details" className="mt-12 grid gap-10 lg:grid-cols-[2fr_1fr] scroll-mt-24">
          <section className="rounded-[32px] bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
              <div>
                <p className="text-[#C8922A] text-xs uppercase tracking-[0.3em] font-['Lato']">
                  {getPackageLabel(selectedPackage.title)}
                </p>
                <h2 className="mt-2 text-3xl font-['Playfair_Display'] text-[#2C1810]">
                  {selectedPackage.title}
                </h2>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-[#2C1810]/60">Starting Price</p>
                {(() => {
                  const raw = Number(
                    getPackagePriceForPax(selectedPackage.pricing, selectedPax),
                  );
                  const amount = getPromoAmount(raw, detailPromo);
                  if (!amount) {
                    return (
                      <p className="text-3xl font-semibold text-[#C8922A]">
                        ₱{raw.toLocaleString()}
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-wrap items-baseline justify-end gap-2">
                      <span className="text-sm text-[#C4541A] line-through">
                        ₱{raw.toLocaleString()}
                      </span>
                      <p className="text-3xl font-semibold text-[#C4541A]">
                        ₱{(raw - amount).toLocaleString()}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-[#C4541A] bg-[#C4541A]/10 px-2 py-0.5 rounded-full font-bold">
                        Promo −₱{amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="grid gap-8">
              <div>
                <h3 className="text-lg font-semibold text-[#2C1810] mb-3">
                  Overview
                </h3>
                <p className="text-[#2C1810]/70 leading-relaxed font-['Lato']">
                  {selectedPackage.description}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#2C1810] mb-4">
                  Menu Inclusions
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {selectedPackage.menuSections.map((section) => (
                    <div key={section.label}>
                      <p className="text-sm uppercase tracking-[0.2em] text-[#C8922A] mb-3 font-['Lato']">
                        {section.label}
                      </p>
                      <ul className="space-y-2 text-[#2C1810]/75 text-sm font-['Lato']">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#C8922A] shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#2C1810] mb-4">
                  What's Included
                </h3>
                <ul className="grid gap-3 text-[#2C1810]/75 text-sm font-['Lato']">
                  {selectedPackage.inclusions.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#C8922A] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <aside className="rounded-[32px] bg-[#2C1810] p-8 text-white shadow-sm">
            <h3 className="text-xl font-['Playfair_Display'] mb-4">
              Ready to Book?
            </h3>
            <p className="text-sm leading-relaxed text-[#F5F0E8]/80 mb-6 font-['Lato']">
              Continue to the booking form to add event details, choose one food
              item from each category, and confirm your estimated total.
            </p>
            <div className="rounded-3xl bg-[#1A0E08]/80 p-5 mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[#C8922A]/90 font-['Lato'] mb-3">
                Selected Package
              </p>
              <p className="text-lg font-semibold">{selectedPackage.title}</p>
            </div>
            <div className="rounded-3xl bg-[#1A0E08]/80 p-5 mb-6">
              <label className="block text-xs uppercase tracking-[0.3em] text-[#C8922A]/90 font-['Lato'] mb-3">
                Number of Pax
              </label>
              <select
                value={selectedPax}
                onChange={(e) => setSelectedPax(Number(e.target.value))}
                className="w-full rounded-full border border-[#C8922A]/30 bg-[#F5F0E8] px-4 py-2.5 text-sm font-['Lato'] text-[#2C1810] outline-none"
              >
                {paxOptions.map((pax) => (
                  <option key={pax} value={pax}>
                    {pax} pax
                  </option>
                ))}
              </select>
              <p className="mt-3 text-sm text-[#F5F0E8]/70 font-['Lato']">
                Estimated total:{" "}
                {(() => {
                  const raw = Number(
                    getPackagePriceForPax(selectedPackage.pricing, selectedPax),
                  );
                  const amount = getPromoAmount(raw, detailPromo);
                  if (!amount) {
                    return (
                      <span className="font-semibold text-[#C8922A]">
                        ₱{raw.toLocaleString()}
                      </span>
                    );
                  }
                  return (
                    <span className="font-semibold text-[#C4541A]">
                      ₱{(raw - amount).toLocaleString()}
                      <span className="ml-1 text-xs text-[#F5F0E8]/50 line-through">
                        ₱{raw.toLocaleString()}
                      </span>
                    </span>
                  );
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenRulesManually}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#C8922A]/40 px-4 py-2.5 mb-4 text-sm font-['Lato'] text-[#C8922A] hover:bg-[#C8922A]/10 hover:border-[#C8922A] transition-colors"
            >
              <AlertTriangle size={15} />
              View Booking Policies &amp; Rules
            </button>
            <button
              type="button"
              onClick={handleProceedToBooking}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C8922A] px-6 py-3 text-sm font-semibold text-[#F5F0E8] transition-colors hover:bg-[#C4541A] cursor-pointer"
            >
              Proceed to Booking <ArrowRight size={16} />
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
