import {
  AlertTriangle,
  CalendarX,
  CalendarClock,
  Clock,
  Utensils,
  Percent,
  Ban,
  Wallet,
} from "lucide-react";

const RULES = [
  {
    icon: Wallet,
    title: "Reservation Fee",
    description:
      "Non-refundable and non-transferable reservation fee of ₱5,000 upon booking. No reservation fee serves as no booking.",
  },
  {
    icon: CalendarClock,
    title: "Booking Lead Time",
    description:
      "Booking should be made more than two weeks before the event date.",
  },
  {
    icon: CalendarClock,
    title: "Payment Schedule",
    description:
      "50% downpayment should be made at least 2 weeks before the event date. The remaining balance to be paid on the event date.",
  },
  {
    icon: CalendarX,
    title: "Cancellation Policy",
    description:
      "Client will pay 50% of the total amount if cancelled less than five days before the event.",
  },
  {
    icon: CalendarX,
    title: "Cancellation Policy",
    description:
      "Client will pay 100% of the total amount if cancelled a day before the event.",
  },
  {
    icon: Utensils,
    title: "Menu Changes",
    description:
      "Any changes on the menu should be made at least two weeks before the event.",
  },
  {
    icon: Ban,
    title: "Outside Food & Drinks",
    description:
      "Strictly no bringing of outside food and drinks except for cake and lechon. Cake — free of corkage. Lechon — ₱1,500 corkage (any size).",
  },
  {
    icon: Clock,
    title: "Overtime Charge",
    description: "Charge in excess of 4 hours — ₱3,000/hour.",
  },
  {
    icon: Percent,
    title: "Discounts",
    description:
      "Senior discount and PWD discount are not applicable for event packages.",
  },
];

export function BookingRules() {
  return (
    <div className="rounded-2xl border border-[#C8922A]/20 bg-[#2C1810] p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={18} className="text-[#C8922A] shrink-0" />
        <h4 className="text-[#C8922A] text-xs uppercase tracking-widest font-['Lato'] font-semibold">
          Booking Policies & Rules
        </h4>
      </div>
      <ul className="space-y-3">
        {RULES.map((rule, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-sm font-['Lato'] text-[#F5F0E8]/80"
          >
            <rule.icon size={15} className="text-[#C8922A] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#C8922A] font-semibold">
                {rule.title}:
              </strong>{" "}
              {rule.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
