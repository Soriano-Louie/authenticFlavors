import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { ArrowRight, Check, CheckCircle, Loader2, Search, Trophy } from "lucide-react";
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

// Function to get package label from package name
function getPackageLabel(packageName: string): string {
  return packageName;
}

// Normalize package images to a consistent 16:9 crop so cards render
// with the same aspect ratio and zoom regardless of the source image.
function getNormalizedImage(image: string | null): string {
  if (!image) return "/packagesFood.png";
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
    image: getNormalizedImage(pkg.image),
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const eventType = searchParams.get("event") || "Birthday";
  const selectedPackageQuery = searchParams.get("package") || "1";
  const initialPax = Number(searchParams.get("pax") || 30);
  const [selectedPackageId, setSelectedPackageId] =
    useState<string>(selectedPackageQuery);
  const [selectedPax, setSelectedPax] = useState<number>(initialPax);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const [canContinueBooking, setCanContinueBooking] = useState(false);

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

  // Enable continue button after 10 seconds when modal opens
  useEffect(() => {
    if (showRulesModal) {
      setCanContinueBooking(false);
      const timer = setTimeout(() => {
        setCanContinueBooking(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showRulesModal]);

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
      <Dialog open={showRulesModal}>
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
            <button
              onClick={() => setShowRulesModal(false)}
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
                  onClick={() => setSelectedPackageId(pkg.id)}
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
                      <span>{pkg.priceLabel}</span>
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

        <div className="mt-12 grid gap-10 lg:grid-cols-[2fr_1fr]">
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
                <p className="text-3xl font-semibold text-[#C8922A]">
                  ₱
                  {Number(
                    getPackagePriceForPax(selectedPackage.pricing, selectedPax),
                  ).toLocaleString()}
                </p>
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
                <span className="font-semibold text-[#C8922A]">
                  ₱
                  {Number(
                    getPackagePriceForPax(selectedPackage.pricing, selectedPax),
                  ).toLocaleString()}
                </span>
              </p>
            </div>
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
