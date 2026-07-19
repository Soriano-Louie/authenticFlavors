import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { ArrowRight, Check, Loader2 } from "lucide-react";
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

// Transform database package to match expected structure
function transformPackage(
  pkg: Package,
  categories: MenuCategory[],
  items: MenuItem[],
) {
  const packageId = String(pkg.package_id);

  // Group menu items by category
  const menuSections = categories
    .map((category) => {
      const categoryItems = items
        .filter((item) => item.category_id === category.category_id)
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
    image: pkg.image || "/packagesFood.png",
    pricing: pkg.pricing || [],
    maxPax: pkg.max_pax,
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

  const handleProceedToBooking = () => {
    const targetUrl = `/booking?event=${encodeURIComponent(eventType)}&package=${selectedPackage.id}&pax=${selectedPax}`;
    if (!user) {
      navigate("/auth", { state: { from: targetUrl } });
    } else {
      navigate(targetUrl);
    }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <Link
            to="/packages"
            className="inline-flex items-center gap-2 text-[#C8922A] text-sm font-['Lato'] hover:underline"
          >
            ← Back to Packages
          </Link>
        </div>

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
              View Package Menus for {eventType}
            </h1>
            <p className="max-w-2xl mx-auto text-sm text-[#F5F0E8]/75 font-['Lato']">
              Review the complete food inclusions here. You can make your food
              choices on the booking page.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {transformedPackages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackageId(pkg.id)}
              className={`rounded-3xl border p-6 text-left transition-all ${
                selectedPackageId === pkg.id
                  ? "border-[#C8922A] bg-[#C8922A]/10 shadow-lg"
                  : "border-[#C8922A]/20 bg-white hover:border-[#C8922A]/40"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#C8922A] font-['Lato']">
                    {getPackageLabel(pkg.title)}
                  </p>
                  <h2 className="mt-2 text-lg font-['Playfair_Display'] text-[#2C1810]">
                    {pkg.title}
                  </h2>
                </div>
                {selectedPackageId === pkg.id ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-[#C8922A] p-2 text-white">
                    <Check size={16} />
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-[#2C1810]/70 font-['Lato'] mb-6">
                {pkg.summary}
              </p>
              <div className="flex items-center justify-between text-sm font-['Lato'] text-[#2C1810]/60">
                <span>{pkg.serving}</span>
                <span>{pkg.priceLabel}</span>
              </div>
            </button>
          ))}
        </div>

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
                  What’s Included
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
                Event Type
              </p>
              <p className="text-lg font-semibold">{eventType}</p>
            </div>
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
