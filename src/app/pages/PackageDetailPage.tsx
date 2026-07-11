import { useParams, Link } from "react-router";
import { useState, useEffect } from "react";
import {
  Star,
  Users,
  CheckCircle,
  ArrowLeft,
  UtensilsCrossed,
  Wine,
  Leaf,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  getPackageById,
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

// Transform database package to match expected structure
function transformPackage(
  pkg: Package,
  categories: MenuCategory[],
  items: MenuItem[],
) {
  // Group menu items by category
  const menuData = {
    appetizers: items
      .filter((i) => i.category_name === "Appetizer")
      .map((i) => i.item_name),
    mains: items
      .filter(
        (i) =>
          i.category_name === "Chicken" ||
          i.category_name === "Pork" ||
          i.category_name === "Beef" ||
          i.category_name === "Seafood",
      )
      .map((i) => i.item_name),
    desserts: items
      .filter((i) => i.category_name === "Dessert")
      .map((i) => i.item_name),
    drinks: items
      .filter((i) => i.category_name === "Drinks")
      .map((i) => i.item_name),
  };

  // Get starting price (lowest pax)
  const startingPrice =
    pkg.pricing && pkg.pricing.length > 0 ? pkg.pricing[0].price : 0;

  return {
    id: String(pkg.package_id),
    name: pkg.package_name,
    eventType: "Birthday", // Default since database doesn't have event types in packages
    packageType: "Plated", // Default since database doesn't have service styles in packages
    image: pkg.image || "/packagesFood.png",
    dishes: items.slice(0, 4).map((i) => i.item_name), // Show first 4 items as preview
    guestRange: `Up to ${pkg.max_pax} guests`,
    pricePerPerson: startingPrice.toLocaleString(),
    description: pkg.description || "Catering package for your special event",
    menu: menuData,
    inclusions: [
      "Premium table setup",
      "Service staff",
      "Event coordination",
      "Sound system",
      "Basic table décor",
    ],
    serviceStyle: "Plated",
  };
}

export function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Data fetching state
  const [pkg, setPkg] = useState<Package | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      try {
        setLoading(true);
        const [packageData, categoriesData, itemsData] = await Promise.all([
          getPackageById(Number(id)),
          getMenuCategories(),
          getMenuItems(),
        ]);

        setPkg(packageData.package);
        setCategories(categoriesData.categories);
        setItems(itemsData.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load package");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const transformedPkg = pkg ? transformPackage(pkg, categories, items) : null;

  if (loading) {
    return (
      <div className="bg-[#F5F0E8] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="animate-spin text-[#C8922A] mx-auto mb-4"
          />
          <p className="text-[#2C1810] font-['Lato']">
            Loading package details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !transformedPkg) {
    return (
      <div className="bg-[#F5F0E8] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#C4541A] font-['Lato'] mb-4">
            {error || "Package not found"}
          </p>
          <Link
            to="/packages"
            className="px-6 py-2 bg-[#C8922A] text-[#F5F0E8] rounded-full font-['Lato'] hover:opacity-90"
          >
            Back to Packages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0E8] min-h-screen">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link
          to="/packages"
          className="inline-flex items-center gap-2 text-[#C8922A] text-sm font-['Lato'] hover:gap-3 transition-all"
        >
          <ArrowLeft size={16} /> Back to Packages
        </Link>
      </div>

      {/* Hero Image */}
      <div
        className="relative mt-4 overflow-hidden"
        style={{ height: "400px" }}
      >
        <img
          src={transformedPkg.image}
          alt={transformedPkg.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E08]/80 via-[#1A0E08]/30 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8 max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-[#C8922A] text-[#F5F0E8] text-xs font-['Lato']">
              {transformedPkg.eventType}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#2C1810]/70 text-[#F5F0E8] text-xs font-['Lato'] border border-[#F5F0E8]/20">
              {transformedPkg.packageType}
            </span>
          </div>
          <h1
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-2"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 600 }}
          >
            {transformedPkg.name}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={
                    i < Math.round(transformedPkg.rating)
                      ? "text-[#C8922A] fill-[#C8922A]"
                      : "text-white/30"
                  }
                />
              ))}
              <span className="text-[#F5F0E8] text-sm font-['Lato'] ml-1">
                {transformedPkg.rating} rating
              </span>
            </div>
            <div className="flex items-center gap-1 text-[#F5F0E8]/75 text-sm font-['Lato']">
              <Users size={14} />
              {transformedPkg.guestRange}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-3">
                About This Package
              </h2>
              <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed">
                {transformedPkg.description}
              </p>
            </div>

            {/* Full Menu */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-6">
                Complete Menu
              </h2>
              <div className="space-y-6">
                {[
                  {
                    label: "Appetizers",
                    icon: Leaf,
                    items: transformedPkg.menu.appetizers,
                    color: "#7A8C5C",
                  },
                  {
                    label: "Main Courses",
                    icon: UtensilsCrossed,
                    items: transformedPkg.menu.mains,
                    color: "#C4541A",
                  },
                  {
                    label: "Desserts",
                    icon: Star,
                    items: transformedPkg.menu.desserts,
                    color: "#C8922A",
                  },
                  {
                    label: "Drinks",
                    icon: Wine,
                    items: transformedPkg.menu.drinks,
                    color: "#2C1810",
                  },
                ].map(({ label, icon: Icon, items, color }) => (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: color + "20" }}
                      >
                        <Icon size={14} style={{ color }} />
                      </div>
                      <h4 className="font-['Playfair_Display'] text-[#2C1810]">
                        {label}
                      </h4>
                    </div>
                    <ul className="grid sm:grid-cols-2 gap-2 ml-9">
                      {items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm text-[#2C1810]/70 font-['Lato']"
                        >
                          <span className="w-1 h-1 rounded-full bg-[#C8922A] mt-2 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Inclusions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-['Playfair_Display'] text-[#2C1810] text-2xl mb-5">
                What's Included
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {transformedPkg.inclusions.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle
                      size={16}
                      className="text-[#7A8C5C] shrink-0 mt-0.5"
                    />
                    <span className="text-[#2C1810]/75 text-sm font-['Lato']">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customization Note */}
            <div className="bg-gradient-to-br from-[#C8922A]/10 to-[#C4541A]/5 rounded-2xl p-6 border border-[#C8922A]/20">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-2">
                Customization Available
              </h3>
              <p className="text-[#2C1810]/70 text-sm font-['Lato'] leading-relaxed">
                Every package can be tailored to your preferences. Chef Ramos
                personally accommodates menu substitutions, dietary
                restrictions, cultural food requirements, and special additions.
                Discuss your vision with our team during the booking process.
              </p>
            </div>
          </div>

          {/* Sidebar – Booking Card */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#C8922A]/10 sticky top-24">
              <div className="mb-5">
                <p className="text-[#2C1810]/50 text-xs font-['Lato'] mb-1">
                  Starting from
                </p>
                <p className="font-['Playfair_Display'] text-[#2C1810] text-3xl">
                  ₱{transformedPkg.pricePerPerson.toLocaleString()}
                </p>
                <p className="text-[#2C1810]/50 text-sm font-['Lato']">
                  per person
                </p>
              </div>

              <div className="space-y-3 mb-6 text-sm font-['Lato']">
                <div className="flex justify-between items-center py-2 border-b border-[#C8922A]/10">
                  <span className="text-[#2C1810]/60">Service Style</span>
                  <span className="text-[#2C1810] font-medium">
                    {transformedPkg.serviceStyle}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#C8922A]/10">
                  <span className="text-[#2C1810]/60">Guest Capacity</span>
                  <span className="text-[#2C1810] font-medium">
                    {transformedPkg.guestRange}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#C8922A]/10">
                  <span className="text-[#2C1810]/60">Event Type</span>
                  <span className="text-[#2C1810] font-medium">
                    {transformedPkg.eventType}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[#2C1810]/60">Guest Rating</span>
                  <span className="text-[#C8922A] font-medium flex items-center gap-1">
                    <Star size={12} className="fill-[#C8922A]" />{" "}
                    {transformedPkg.rating}/5.0
                  </span>
                </div>
              </div>

              <Link
                to={`/booking?event=${encodeURIComponent(transformedPkg.eventType)}&package=${transformedPkg.id}`}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full hover:opacity-90 transition-all font-['Lato'] shadow-md shadow-[#C8922A]/20"
              >
                Proceed to Booking <ArrowRight size={16} />
              </Link>
              <Link
                to="/packages"
                className="w-full flex items-center justify-center gap-2 mt-3 py-3 border border-[#C8922A] text-[#C8922A] rounded-full hover:bg-[#C8922A] hover:text-[#F5F0E8] transition-all font-['Lato'] text-sm"
              >
                Browse Other Packages
              </Link>
            </div>

            {/* Quick Highlights */}
            <div className="bg-[#2C1810] rounded-2xl p-5">
              <h4 className="font-['Playfair_Display'] text-[#F5F0E8] mb-3">
                Signature Dishes
              </h4>
              <div className="space-y-2">
                {transformedPkg.dishes.map((d) => (
                  <div
                    key={d}
                    className="flex items-center gap-2 text-[#F5F0E8]/70 text-sm font-['Lato']"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8922A] shrink-0" />
                    {d}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
