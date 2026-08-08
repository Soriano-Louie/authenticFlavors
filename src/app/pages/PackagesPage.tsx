import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Star, Users, Search, Loader2, X } from "lucide-react";
import { getPackages } from "../api/packageApi";
import type { Package } from "../api/packageApi";

// Transform database package to match expected structure
function transformPackage(pkg: Package) {
  const includedItemIds = new Set(
    (pkg.menu_inclusions || []).map((inc) => inc.menu_item_id),
  );
  const hasInclusions = includedItemIds.size > 0;

  // Get starting price (lowest pax)
  const startingPrice =
    pkg.pricing && pkg.pricing.length > 0 ? pkg.pricing[0].price : 0;

  // Detect event type from package name
  const nameLower = pkg.package_name.toLowerCase();
  let eventType = "Private Dining";
  if (nameLower.includes("birthday")) eventType = "Birthday";
  else if (nameLower.includes("wedding")) eventType = "Wedding";
  else if (nameLower.includes("corporate")) eventType = "Corporate";
  else if (nameLower.includes("anniversary")) eventType = "Anniversary";
  else if (nameLower.includes("family")) eventType = "Family";

  // Determine package type based on capacity
  let packageType = "Standard";
  if (pkg.max_pax <= 30) packageType = "Intimate";
  else if (pkg.max_pax <= 60) packageType = "Signature";
  else if (pkg.max_pax > 60) packageType = "Grand";

  // Base rating on package quality signals (pricing + capacity)
  const rating = startingPrice > 2000 ? 5 : startingPrice > 1200 ? 4.5 : 4;

  const dishes = hasInclusions
    ? pkg.menu_inclusions!.map((inc) => inc.item_name).slice(0, 4)
    : ["Multiple menu options available"];

  return {
    id: String(pkg.package_id),
    name: pkg.package_name,
    image: pkg.image || "/packagesFood.png",
    dishes,
    guestRange: `Up to ${pkg.max_pax} guests`,
    pricePerPerson: startingPrice.toLocaleString(),
    description: pkg.description || "Catering package for your special event",
    eventType,
    packageType,
    rating,
    menu: {
      appetizers: ["Selection available"],
      mains: ["Selection available"],
      desserts: ["Selection available"],
      drinks: ["Selection available"],
    },
    inclusions: [
      "Premium table setup",
      "Service staff",
      "Event coordination",
      "Sound system",
      "Basic table décor",
    ],
  };
}

export function PackagesPage() {
  const [search, setSearch] = useState("");

  // Data fetching state
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await getPackages();
        setPackages(data.packages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load packages",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const transformedPackages = packages.map(transformPackage);

  const filtered = transformedPackages.filter((p) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    // Search by package name only
    return p.name.toLowerCase().includes(query);
  });

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
    <div>
      {/* Hero */}
      <section className="bg-[#2C1810] pt-16 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
            ✦ Our Offerings
          </p>
          <h1
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-4"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 600 }}
          >
            Menu Packages
          </h1>
          <p className="text-[#F5F0E8]/65 font-['Lato'] leading-relaxed max-w-xl mx-auto">
            Discover our thoughtfully crafted event packages — each designed to
            celebrate your occasion with exquisite food, impeccable service, and
            unforgettable ambiance.
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="sticky top-16 z-40 bg-[#F5F0E8] border-b border-[#C8922A]/15 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40"
              />
              <input
                type="text"
                placeholder="Search packages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 rounded-full border border-[#C8922A]/30 bg-white text-[#2C1810] text-sm outline-none focus:border-[#C8922A] font-['Lato'] placeholder-[#2C1810]/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#C4541A] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="py-14 bg-[#F5F0E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#2C1810]/40 font-['Lato'] text-lg">
                No packages found matching{" "}
                <span className="text-[#C4541A] font-semibold">
                  "{search.trim()}"
                </span>
              </p>
              <button
                onClick={() => setSearch("")}
                className="mt-4 px-6 py-2 text-[#C8922A] border border-[#C8922A] rounded-full text-sm font-['Lato'] hover:bg-[#C8922A] hover:text-[#F5F0E8] transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <>
              <p className="text-[#2C1810]/50 text-sm font-['Lato'] mb-6">
                {filtered.length} package{filtered.length !== 1 ? "s" : ""}{" "}
                found
                {search.trim() && (
                  <>
                    {" "}
                    for{" "}
                    <span className="text-[#C8922A] font-semibold">
                      "{search.trim()}"
                    </span>
                  </>
                )}
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filtered.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all group"
                  >
                    <div
                      className="relative overflow-hidden group-hover:scale-105 transition-transform duration-500"
                      style={{
                        height: "220px",
                        backgroundImage: `url(${pkg.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E08]/85 via-[#1A0E08]/20 to-transparent" />

                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-[#C8922A]/90 text-[#F5F0E8] text-[11px] font-['Lato']">
                          {pkg.eventType}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-[#2C1810]/70 text-[#F5F0E8] text-[11px] font-['Lato']">
                          {pkg.packageType}
                        </span>
                      </div>

                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#1A0E08]/70 rounded-full px-2.5 py-1">
                        <Star
                          size={12}
                          className="text-[#C8922A] fill-[#C8922A]"
                        />
                        <span className="text-[#F5F0E8] text-xs font-['Lato']">
                          {pkg.rating}
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="font-['Playfair_Display'] text-[#F5F0E8] text-xl">
                          {pkg.name}
                        </h3>
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="text-[#2C1810]/60 text-sm font-['Lato'] leading-relaxed mb-4 line-clamp-2">
                        {pkg.description}
                      </p>

                      {/* Dishes Preview */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {pkg.dishes.map((d) => (
                          <span
                            key={d}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[#EDE8DF] text-[#C4541A] font-['Lato'] border border-[#C4541A]/15"
                          >
                            {d}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mb-4 text-[#2C1810]/60 text-sm font-['Lato']">
                        <Users size={14} className="text-[#C8922A]" />
                        {pkg.guestRange}
                      </div>

                      <div className="flex items-center justify-end pt-3 border-t border-[#C8922A]/10">
                        <Link
                          to={`/package-selection?event=${encodeURIComponent(pkg.eventType)}&package=${pkg.id}`}
                          className="px-4 py-2 border border-[#C8922A] text-[#C8922A] rounded-full text-sm hover:bg-[#C8922A] hover:text-[#F5F0E8] transition-colors font-['Lato']"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
