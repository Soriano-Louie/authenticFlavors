import { Link } from "react-router";
import {
  ShieldCheck,
  User,
  Eye,
  Lock,
  Receipt,
  Share2,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

const LAST_UPDATED = "August 6, 2026";

const SECTIONS = [
  {
    icon: User,
    title: "Information We Collect",
    description:
      "When you use our website, we collect the following information to provide our services:",
    items: [
      "Your full name",
      "Your email address",
      "Your contact number",
      "Booking details (such as event type, package, number of guests, and event date)",
      "Payment receipt uploads (images or files you submit for payment verification)",
      "Your feedback and reviews about our services",
    ],
  },
  {
    icon: Eye,
    title: "Why We Collect This Information",
    description:
      "We use the information you provide for the following purposes:",
    items: [
      "To manage your event bookings and reservations",
      "To verify and process your payments",
      "To provide customer support and respond to your inquiries",
      "To analyze your feedback and improve our services",
      "To keep you informed about your bookings and account updates",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Who Can Access Your Information",
    description:
      "Your personal information is accessible only to authorized administrators of Authentic Flavors by Chef Ramos. We do not display your personal details publicly, and only the administrators who manage bookings, payments, and customer support have access to your data.",
  },
  {
    icon: Lock,
    title: "How We Protect Your Data",
    description:
      "We take reasonable measures to protect your personal information, including secure storage of data, restricted access to authorized personnel only, and careful handling of all submitted files and records. While no method of data transmission is 100% secure, we do our best to keep your information safe.",
  },
  {
    icon: Receipt,
    title: "Payment Receipts",
    description:
      "When you upload a payment receipt, it is used solely for payment verification purposes. Our administrators will review the receipt to confirm that your payment has been made correctly. Your receipt is not shared publicly and is not used for any other purpose.",
  },
  {
    icon: Share2,
    title: "Sharing Your Information",
    description:
      "We do not sell, rent, or share your personal information with third parties, except when required to do so by law. Your data stays within our system and is used only for the purposes described in this Privacy Policy.",
  },
  {
    icon: GraduationCap,
    title: "Academic Capstone Project Notice",
    description:
      "This website was developed as part of an academic capstone project titled 'AI-Driven Booking, Customer Support, and Feedback Analysis System for Authentic Flavors by Chef Ramos.' It is intended for demonstration and educational purposes only. The Privacy Policy on this page is provided to explain how data is handled within the scope of this academic project and should not be treated as a legally binding policy for a commercial website.",
  },
];

export function PrivacyPolicyPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 overflow-hidden bg-[#2C1810]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A0E08]/90 via-[#2C1810]/85 to-[#C8922A]/20" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">
            ✦ Your Privacy Matters
          </p>
          <h1
            className="font-['Playfair_Display'] text-[#F5F0E8] mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 600 }}
          >
            Privacy Policy
          </h1>
          <p className="text-[#F5F0E8]/70 font-['Lato'] text-lg max-w-2xl mx-auto leading-relaxed">
            How we collect, use, and protect your information when you use our
            booking and feedback system.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#C8922A]/40 bg-[#C8922A]/10 px-4 py-2">
            <ShieldCheck size={16} className="text-[#C8922A]" />
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
              Welcome to Our Privacy Policy
            </h2>
            <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed mb-4">
              This Privacy Policy explains how the{" "}
              <strong className="text-[#2C1810]">
                AI-Driven Booking, Customer Support, and Feedback Analysis
                System for Authentic Flavors by Chef Ramos
              </strong>{" "}
              handles your personal information. We want to be clear and
              transparent about what we collect and why, so you can feel
              comfortable using our website.
            </p>
            <p className="text-[#2C1810]/70 font-['Lato'] leading-relaxed">
              Please note that this website is an{" "}
              <strong className="text-[#C4541A]">
                academic capstone project
              </strong>{" "}
              created for educational and demonstration purposes. The
              information you provide is handled within the scope of this
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
                  <ul className="space-y-2.5">
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
              </div>
            ))}
          </div>

          {/* Contact / Back */}
          <div className="mt-10 text-center">
            <p className="text-[#2C1810]/60 font-['Lato'] text-sm mb-6">
              If you have any questions about this Privacy Policy, feel free to
              reach out to us through our contact page or email us at{" "}
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
