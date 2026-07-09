import { useState } from "react";
import { Star, TrendingUp, ThumbsUp, Smile, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { TESTIMONIALS, ANALYTICS, FEEDBACK_DATA } from "../data/mockData";

const PIE_COLORS = ["#C8922A", "#C4541A", "#7A8C5C", "#EDE8DF50", "#2C1810"];

export function FeedbackPage() {
  const [filter, setFilter] = useState<"all" | "positive" | "neutral">("all");

  const filtered = filter === "all" ? FEEDBACK_DATA : FEEDBACK_DATA.filter((f) => f.sentiment === filter);

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#2C1810] pt-16 pb-12 px-4 text-center">
        <p className="text-[#C8922A] text-xs tracking-widest uppercase font-['Lato'] mb-3">✦ Feedback & Analysis</p>
        <h1 className="font-['Playfair_Display'] text-[#F5F0E8] mb-3" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 600 }}>
          What Our Guests Say
        </h1>
        <p className="text-[#F5F0E8]/60 font-['Lato'] max-w-xl mx-auto text-sm leading-relaxed">
          Real reviews from real celebrations — powered by AI sentiment analysis to continuously improve your experience.
        </p>
      </section>

      {/* AI Summary Banner */}
      <section className="bg-gradient-to-r from-[#C8922A] to-[#C4541A] py-5 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <TrendingUp size={18} className="text-[#F5F0E8]" />
            </div>
            <div>
              <p className="text-[#F5F0E8] text-sm font-['Playfair_Display']">AI Sentiment Summary</p>
              <p className="text-[#F5F0E8]/80 text-xs font-['Lato']">Updated in real-time based on all customer reviews</p>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {[
              { icon: ThumbsUp, label: "Positive", value: "87%" },
              { icon: Smile, label: "Neutral", value: "10%" },
              { icon: AlertCircle, label: "Negative", value: "3%" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5">
                <Icon size={14} className="text-[#F5F0E8]" />
                <span className="text-[#F5F0E8] text-sm font-['Lato']">{label}: <strong>{value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-[#F5F0E8] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">Satisfaction by Event Type</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ANALYTICS.satisfactionByEventType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE8DF" />
                  <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#2C181070" }} />
                  <YAxis domain={[4, 5.2]} tick={{ fontSize: 11, fill: "#2C181070" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #C8922A30", fontFamily: "Lato" }}
                    formatter={(v: number) => [`${v} / 5.0`, "Score"]}
                  />
                  <Bar dataKey="score" fill="#C8922A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-['Playfair_Display'] text-[#2C1810] text-xl mb-5">Rating Distribution</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={ANALYTICS.ratingDistribution}
                      dataKey="count"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                    >
                      {ANALYTICS.ratingDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontFamily: "Lato", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {ANALYTICS.ratingDistribution.map((r, i) => (
                    <div key={r.rating} className="flex items-center gap-2 text-xs font-['Lato']">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i] }} />
                      <span className="text-[#2C1810]/70">{r.rating}</span>
                      <span className="text-[#2C1810] font-medium">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Highlight */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-['Playfair_Display'] text-[#2C1810]" style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)", fontWeight: 600 }}>
                Featured Reviews
              </h2>
              <div className="flex items-center gap-1">
                <Star size={16} className="text-[#C8922A] fill-[#C8922A]" />
                <span className="text-[#2C1810] font-['Playfair_Display']">4.9</span>
                <span className="text-[#2C1810]/50 text-sm font-['Lato']">/ 5.0 avg</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-[#C8922A]/5">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} className={i < t.rating ? "text-[#C8922A] fill-[#C8922A]" : "text-[#C8922A]/20"} />
                    ))}
                  </div>
                  <p className="text-[#2C1810]/75 text-sm font-['Lato'] leading-relaxed mb-5 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[#C8922A]/10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center shrink-0">
                      <span className="text-[#F5F0E8] text-sm font-['Playfair_Display']">{t.avatar}</span>
                    </div>
                    <div>
                      <p className="text-[#2C1810] text-sm font-['Playfair_Display']">{t.name}</p>
                      <p className="text-[#C8922A]/80 text-xs font-['Lato']">{t.event}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Feedback with Sentiment Filter */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h2 className="font-['Playfair_Display'] text-[#2C1810]" style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)", fontWeight: 600 }}>
                All Feedback
              </h2>
              <div className="flex gap-2">
                {(["all", "positive", "neutral"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-full text-sm font-['Lato'] capitalize transition-colors ${
                      filter === f
                        ? "bg-[#C8922A] text-[#F5F0E8]"
                        : "bg-white border border-[#C8922A]/30 text-[#2C1810]/60 hover:border-[#C8922A]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filtered.map((f) => (
                <div key={f.id} className={`bg-white rounded-2xl p-5 shadow-sm border ${f.sentiment === "positive" ? "border-[#7A8C5C]/15" : "border-[#C8922A]/15"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8922A] to-[#C4541A] flex items-center justify-center">
                        <span className="text-[#F5F0E8] text-sm font-['Playfair_Display']">{f.customer.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-['Playfair_Display'] text-[#2C1810]">{f.customer}</p>
                        <p className="text-[#2C1810]/50 text-xs font-['Lato']">{f.event} · {f.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={13} className={i < f.rating ? "text-[#C8922A] fill-[#C8922A]" : "text-[#C8922A]/20"} />
                        ))}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-['Lato'] capitalize ${f.sentiment === "positive" ? "bg-[#7A8C5C]/15 text-[#7A8C5C]" : "bg-[#C8922A]/15 text-[#C8922A]"}`}>
                        {f.sentiment}
                      </span>
                    </div>
                  </div>
                  <p className="text-[#2C1810]/70 font-['Lato'] text-sm leading-relaxed">"{f.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
