import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { PACKAGE_OPTIONS, getPackagePriceForPax } from "../data/mockData";

const PACKAGE_LABELS = {
  "package-a": "Package A",
  "package-b": "Package B",
  "package-c": "Package C",
  "package-d": "Package D",
};

export function PackageSelectionPage() {
  const [searchParams] = useSearchParams();
  const eventType = searchParams.get("event") || "Birthday";
  const selectedPackageQuery = searchParams.get("package") || "package-a";
  const paxOptions = [30, 40, 50, 60, 70, 80, 90, 100];
  const initialPax = Number(searchParams.get("pax") || 30);
  const normalizedInitialPax = paxOptions.includes(initialPax)
    ? initialPax
    : 30;
  const [selectedPackageId, setSelectedPackageId] =
    useState<string>(selectedPackageQuery);
  const [selectedPax, setSelectedPax] = useState<number>(normalizedInitialPax);

  const selectedPackage = useMemo(
    () =>
      PACKAGE_OPTIONS.find((pkg) => pkg.id === selectedPackageId) ??
      PACKAGE_OPTIONS[0],
    [selectedPackageId],
  );

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
          {PACKAGE_OPTIONS.map((pkg) => (
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
                    {PACKAGE_LABELS[pkg.id]}
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
                  {PACKAGE_LABELS[selectedPackage.id]}
                </p>
                <h2 className="mt-2 text-3xl font-['Playfair_Display'] text-[#2C1810]">
                  {selectedPackage.title}
                </h2>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-[#2C1810]/60">Starting Price</p>
                <p className="text-3xl font-semibold text-[#C8922A]">
                  {selectedPackage.priceLabel}
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
                  {getPackagePriceForPax(
                    selectedPackage,
                    selectedPax,
                  ).toLocaleString()}
                </span>
              </p>
            </div>
            <Link
              to={`/booking?event=${encodeURIComponent(eventType)}&package=${selectedPackage.id}&pax=${selectedPax}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C8922A] px-6 py-3 text-sm font-semibold text-[#F5F0E8] transition-colors hover:bg-[#C4541A]"
            >
              Proceed to Booking <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
