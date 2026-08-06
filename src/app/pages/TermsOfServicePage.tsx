import { Link } from "react-router";
import {
  FileText,
  UserCheck,
  ClipboardCheck,
  Upload,
  Eye,
  AlertTriangle,
  Ban,
  Lock,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

const LAST_UPDATED = "August 6, 2026";

const SECTIONS = [
  {
    icon: UserCheck,
    title: "Accurate Information",
    description:
      "When creating an account or making a booking on our website, you agree to provide accurate and truthful information. This includes your name, contact details, event details, and any other information we may ask for. Providing false or misleading information may result in your booking being rejected.",
  },
  {
    icon: ClipboardCheck,
    title: "Booking Approval & Payment Verification",
    description:
      "All bookings are subject to administrator approval. Submitting a booking does not automatically guarantee that your reservation is confirmed. Your booking will be reviewed by our administrators, and final confirmation depends on the successful verification of your payment.",
  },
  {
    icon: Upload,
    title: "Payment Receipts",
    description:
      "Customers may upload payment receipts for the following purposes:",
    items: [
      "Reservation fees — to secure and confirm your booking",
      "Down payments — to reserve your event date and package",
      "Final payments — to complete your booking payment",
    ],
    footnote:
      "All payment receipts are manually reviewed and verified by an authorized administrator before they are marked as paid.",
  },
  {
    icon: Eye,
    title: "Manual Verification of Payments",
    description:
      "Payment receipts are manually verified by the administrator. Please ensure that your receipt is clear, readable, and shows the correct payment amount and reference details. This helps our administrators process your payment faster and reduces the chance of verification delays.",
  },
  {
    icon: AlertTriangle,
    title: "Cancellation Policy",
    description:
      "If a booking is canceled, the reservation fee is non-refundable. This is because the reservation fee is used to secure your event date and allocate resources for your booking. Please make sure of your plans before making a reservation.",
  },
  {
    icon: Ban,
    title: "Prohibited Activities",
    description:
      "Our system reserves the right to reject or cancel any booking that is suspected to be fraudulent, and to reject fake or altered payment receipts. This includes, but is not limited to:",
    items: [
      "Submitting fake or edited payment receipts",
      "Using false personal information to create bookings",
      "Attempting to access other users' accounts or data",
      "Any activity that disrupts the normal operation of the website",
    ],
  },
  {
    icon: Lock,
    title: "Account Security",
    description:
      "You are responsible for maintaining the security of your account. This means:",
    items: [
      "Keeping your password private and secure",
      "Not sharing your login credentials with others",
      "Notifying us immediately if you suspect unauthorized access to your account",
    ],
  },
  {
    icon: GraduationCap,
    title: "Academic Capstone Project Disclaimer",
    description:
      "This website was developed as part of an academic capstone project titled 'AI-Driven Booking, Customer Support, and Feedback Analysis System for Authentic Flavors by Chef Ramos.' This system is intended for demonstration and educational purposes only. The Terms of Service described on this page are provided to explain how the system works within the scope of this academic project and should not be treated as legally binding terms for a commercial service.",
  },
];

export function TermsOfServicePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 overflow-hidden bg-[#2C1810]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A0E08]/90 via-[#2C1810]/85 to-[#C8922A]/20" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
            ✦ Please Read Carefully
          </p>
          <h1
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 600 }}
          >
            Terms of Service
          </h1>
          <p className="text-[#F5F0E8]/70 font-['Lato'] text-lg max-w-2xl mx-auto leading-relaxed">
            The rules and guidelines for using our booking, payment, and
            feedback system.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#C8922A]/40 bg-[#C8922A]/10 px-4 py-2">
            <FileText size={16} className="text-[#C8922A]" />
            <span className="text-sm font-['Lato'] text-[#F5F0E8]">
              Last Updated: {LAST_UPDATED}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-[#F5F0E8]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="rounded-3xl border border-[#C8922A]/20 bg-white p-8 mb-8 shadow-sm">
            <h2 className="font-['Playfair_Display'] text-2xl text-[#2C1810] mb-4">
              Welcome to Our Terms of Service
            </h2>
            <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-4">
              These Terms of Service explain the rules and guidelines for using
              the{" "}
              <strong className="text-[#2C1810]">
                AI-Driven Booking, Customer Support, and Feedback Analysis
                System for Authentic Flavors by Chef Ramos
              </strong>
              . By using this website, you agree to follow these terms.
            </p>
            <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed">
              Please note that this website is an{" "}
              <strong className="text-[#C4541A]">
                academic capstone project
              </strong>{" "}
              created for educational and demonstration purposes. The terms
              described here guide how the system is used within this academic
              project.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {SECTIONS.map((section, index) => (
              <div
                key={section.title}
                className="rounded-3xl border border-[#C8922A]/20 bg-white p-8 shadow-sm"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
                    <section.icon size={22} className="text-[#F5F0E8]" />
                  </div>
                  <div>
                    <p className="text-xs font-['Lato'] text-[#C8922A] uppercase tracking-widest mb-1">
                      Section {index + 1}
                    </p>
                    <h2 className="font-['Playfair_Display'] text-xl text-[#2C1810]">
                      {section.title}
                    </h2>
                  </div>
                </div>
                <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-4">
                  {section.description}
                </p>
                {section.items && (
                  <ul className="space-y-2.5 mb-4">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-[#2C1810]/70 font-['Lato']"
                      >
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-[#C8922A] flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.footnote && (
                  <p className="text-sm text-[#C8922A] font-['Lato'] bg-[#C8922A]/10 border border-[#C8922A]/20 rounded-xl px-4 py-3">
                    {section.footnote}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Agreement / Back */}
          <div className="mt-10 text-center">
            <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
              By continuing to use our website, you agree to these Terms of
              Service. If you have any questions, feel free to email us at{" "}
              <span className="text-[#C8922A] font-semibold">
                ramosauthenticflavors@gmail.com
              </span>
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] font-['Lato'] hover:opacity-90 transition-opacity"
            >
              Back to Home <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
