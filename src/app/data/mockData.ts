export const IMAGES = {
  hero: "/AuthenticFlavor_backgroundImage.png",
  chef: "/OurStory_chefRamos.png",
  birthday: "/Birthday_Celebrations.png",
  corporate: "/Corporate_Dinners.png",
  wedding: "/Wedding_Receptions.png",
  gourmetPlating:
    "https://images.unsplash.com/photo-1761095596757-db038313df59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  buffet: "/Gourmet_Buffet.png",
  dessert:
    "https://images.unsplash.com/photo-1612723554566-88f9075be12f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  ambiance: "/Venue_Ambiance.jpg",
  familyStyle: "/Family_Fiesta.png",
  anniversary: "/Anniversary_Dinners.png",
};

export const UPCOMING_EVENTS = [
  {
    date: "2026-07-08",
    title: "Summer Terrace Dinner",
    type: "Private Dining",
    time: "7:00 PM",
    guests: "24 guests",
  },
  {
    date: "2026-07-14",
    title: "Wedding Tasting Menu",
    type: "Planning Session",
    time: "2:00 PM",
    guests: "8 guests",
  },
  {
    date: "2026-07-18",
    title: "Live Acoustic Singing Night",
    type: "Live Performance",
    time: "8:30 PM",
    guests: "18 guests",
  },
  {
    date: "2026-07-22",
    title: "Corporate Gala Preview",
    type: "Catering Preview",
    time: "5:30 PM",
    guests: "60 guests",
  },
  {
    date: "2026-07-29",
    title: "Anniversary Chef's Table",
    type: "Chef's Table",
    time: "8:00 PM",
    guests: "12 guests",
  },
  {
    date: "2026-08-03",
    title: "Family Fiesta Showcase",
    type: "Open House",
    time: "11:00 AM",
    guests: "40 guests",
  },
];

export const TESTIMONIALS = [
  {
    id: 1,
    name: "Maria Santos",
    event: "Birthday Celebration",
    rating: 5,
    text: "Chef Ramos and his team made my 50th birthday absolutely magical. Every dish was a masterpiece — the herb-crusted salmon was divine. Our guests couldn't stop talking about the food!",
    avatar: "MS",
  },
  {
    id: 2,
    name: "James Reyes",
    event: "Corporate Annual Dinner",
    rating: 5,
    text: "We've hosted corporate events at many venues, but Authentic Flavors stands apart. The professionalism, the quality, and the attention to detail were exceptional. Will be booking again.",
    avatar: "JR",
  },
  {
    id: 3,
    name: "Ana & Miguel Cruz",
    event: "Wedding Reception",
    rating: 5,
    text: "Our wedding day was perfect, and a huge part of that was the catering. Chef Ramos accommodated all our guests' dietary needs without compromising taste. Pure magic.",
    avatar: "AM",
  },
  {
    id: 4,
    name: "Linda Gomez",
    event: "Anniversary Dinner",
    rating: 5,
    text: "The anniversary package was incredibly romantic. Chef Ramos personally came out to greet us, and the molten chocolate cake finale was perfection. Truly a 5-star experience.",
    avatar: "LG",
  },
  {
    id: 5,
    name: "Roberto Tan",
    event: "Family Reunion",
    rating: 4,
    text: "The family-style feast brought everyone together beautifully. The Filipino menu was authentic and generous. Highly recommend for family milestones!",
    avatar: "RT",
  },
];

export const ADMIN_BOOKINGS = [
  {
    id: "BK001",
    customer: "Maria Santos",
    event: "Birthday Bliss 3-Course",
    date: "2026-05-15",
    guests: 25,
    status: "Confirmed",
    dietary: "Nut-free",
    total: 45000,
  },
  {
    id: "BK002",
    customer: "James Reyes",
    event: "Corporate Feast Buffet",
    date: "2026-05-22",
    guests: 60,
    status: "Pending",
    dietary: "Vegetarian options",
    total: 90000,
  },
  {
    id: "BK003",
    customer: "Ana Cruz",
    event: "Wedding Elegance",
    date: "2026-06-01",
    guests: 50,
    status: "Confirmed",
    dietary: "Gluten-free, shellfish allergy",
    total: 160000,
  },
  {
    id: "BK004",
    customer: "Linda Gomez",
    event: "Anniversary Romance",
    date: "2026-06-10",
    guests: 12,
    status: "Confirmed",
    dietary: "None",
    total: 30000,
  },
  {
    id: "BK005",
    customer: "Roberto Tan",
    event: "Family Fiesta Feast",
    date: "2026-06-15",
    guests: 35,
    status: "Cancelled",
    dietary: "Pork restrictions",
    total: 42000,
  },
  {
    id: "BK006",
    customer: "Christine Lim",
    event: "Birthday Bliss 3-Course",
    date: "2026-06-20",
    guests: 20,
    status: "Pending",
    dietary: "Dairy-free",
    total: 36000,
  },
];

export const FEEDBACK_DATA = [
  {
    id: 1,
    customer: "Maria Santos",
    event: "Birthday Bliss",
    rating: 5,
    comment:
      "Exceptional service! The food was phenomenal and the team was so attentive.",
    sentiment: "positive",
    date: "2026-04-10",
  },
  {
    id: 2,
    customer: "James Reyes",
    event: "Corporate Feast",
    rating: 4,
    comment:
      "Great food and service. Slight delay in setup but overall excellent experience.",
    sentiment: "positive",
    date: "2026-04-12",
  },
  {
    id: 3,
    customer: "Ana Cruz",
    event: "Wedding Elegance",
    rating: 5,
    comment:
      "Absolutely perfect for our wedding day. Chef Ramos exceeded every expectation.",
    sentiment: "positive",
    date: "2026-04-15",
  },
  {
    id: 4,
    customer: "Robert Kim",
    event: "Corporate Feast",
    rating: 3,
    comment:
      "Food was good but communication prior to the event could be improved.",
    sentiment: "neutral",
    date: "2026-04-18",
  },
  {
    id: 5,
    customer: "Sofia Dela Cruz",
    event: "Family Fiesta",
    rating: 5,
    comment:
      "The Kare-Kare was authentic and absolutely delicious! Family loved every bite.",
    sentiment: "positive",
    date: "2026-04-20",
  },
];

export const ANALYTICS = {
  popularPackages: [
    { name: "Birthday Bliss", bookings: 42 },
    { name: "Wedding Elegance", bookings: 35 },
    { name: "Corporate Feast", bookings: 28 },
    { name: "Anniversary Romance", bookings: 22 },
    { name: "Family Fiesta", bookings: 18 },
    { name: "Grand Buffet", bookings: 15 },
  ],
  bookingTrends: [
    { month: "Jan", bookings: 8 },
    { month: "Feb", bookings: 12 },
    { month: "Mar", bookings: 15 },
    { month: "Apr", bookings: 20 },
    { month: "May", bookings: 28 },
    { month: "Jun", bookings: 35 },
    { month: "Jul", bookings: 30 },
    { month: "Aug", bookings: 25 },
    { month: "Sep", bookings: 22 },
    { month: "Oct", bookings: 18 },
    { month: "Nov", bookings: 32 },
    { month: "Dec", bookings: 45 },
  ],
  satisfactionByEventType: [
    { type: "Birthday", score: 4.9 },
    { type: "Wedding", score: 5.0 },
    { type: "Corporate", score: 4.7 },
    { type: "Anniversary", score: 4.8 },
    { type: "Family", score: 4.6 },
  ],
  ratingDistribution: [
    { rating: "5 Stars", count: 68 },
    { rating: "4 Stars", count: 22 },
    { rating: "3 Stars", count: 7 },
    { rating: "2 Stars", count: 2 },
    { rating: "1 Star", count: 1 },
  ],
};

// AI Feedback Analysis Data
export const AI_FEEDBACK_ANALYSIS = {
  sentimentBreakdown: [
    { sentiment: "Positive", count: 142, percentage: 71 },
    { sentiment: "Neutral", count: 38, percentage: 19 },
    { sentiment: "Negative", count: 20, percentage: 10 },
  ],
  categorizedFeedback: [
    {
      id: "cat-1",
      category: "Food Quality",
      priority: "High",
      count: 85,
      sentiment: "Positive",
      samples: [
        "The filet mignon was absolutely divine! Cooked to perfection.",
        "Herb-crusted salmon exceeded expectations. Best I've had!",
        "Desserts were outstanding, especially the crème brûlée.",
      ],
    },
    {
      id: "cat-2",
      category: "Service Speed",
      priority: "Medium",
      count: 32,
      sentiment: "Neutral",
      samples: [
        "Service was good but dishes came out slightly delayed during cocktail hour.",
        "Wait time for main course was longer than expected.",
        "Staff were friendly but seemed understaffed during peak service.",
      ],
    },
    {
      id: "cat-3",
      category: "Presentation",
      priority: "Low",
      count: 58,
      sentiment: "Positive",
      samples: [
        "Plating was restaurant-quality. Very elegant!",
        "Table setup and décor were beautiful. Instagram-worthy!",
        "Loved the attention to detail on the menu cards.",
      ],
    },
    {
      id: "cat-4",
      category: "Pricing",
      priority: "Medium",
      count: 28,
      sentiment: "Neutral",
      samples: [
        "Great value for the quality received.",
        "Slightly pricey but worth it for special occasions.",
        "Would appreciate more budget-friendly options for smaller events.",
      ],
    },
    {
      id: "cat-5",
      category: "Dietary Accommodations",
      priority: "High",
      count: 15,
      sentiment: "Negative",
      samples: [
        "Needed more vegetarian options in the buffet lineup.",
        "Vegan alternatives were limited.",
        "Would love to see gluten-free desserts added to the menu.",
      ],
    },
  ],
  aiSuggestions: [
    {
      id: "sug-1",
      title: "Expand Vegetarian & Vegan Options",
      description:
        "15 feedback entries highlighted limited dietary accommodations. Consider adding 2-3 plant-based mains per package.",
      impact: "High",
      actionable:
        "Add Vegetarian Wellington, Vegan Paella, and Gluten-Free Dessert options",
    },
    {
      id: "sug-2",
      title: "Optimize Service Timing During Peak Hours",
      description:
        "32 feedback entries mentioned slight delays in service. Analyze staffing levels for events with 50+ guests.",
      impact: "Medium",
      actionable: "Increase service staff ratio during high-volume events",
    },
    {
      id: "sug-3",
      title: "Introduce Mid-Tier Pricing Package",
      description:
        "28 feedback entries suggested pricing concerns. A mid-tier option could capture budget-conscious clients.",
      impact: "Medium",
      actionable: "Create 'Essential Elegance' package at ₱1,000-₱1,200/person",
    },
    {
      id: "sug-4",
      title: "Leverage Presentation Excellence",
      description:
        "58 feedback entries praised presentation quality. Use this as a marketing differentiator.",
      impact: "Low",
      actionable:
        "Feature customer photos in marketing materials and social media",
    },
  ],
};

// Recent Admin Activity Feed
export const RECENT_ACTIVITIES = [
  {
    id: "act-1",
    type: "booking",
    user: "Maria Santos",
    action: "Created new booking",
    details: "Wedding Elegance Package - June 15, 2026",
    timestamp: "2 minutes ago",
    icon: "Calendar",
  },
  {
    id: "act-2",
    type: "feedback",
    user: "Juan Dela Cruz",
    action: "Submitted feedback",
    details: "5-star review for Birthday Bliss package",
    timestamp: "15 minutes ago",
    icon: "MessageSquare",
  },
  {
    id: "act-3",
    type: "package",
    user: "Admin",
    action: "Updated package",
    details: "Corporate Feast - Added new dessert options",
    timestamp: "1 hour ago",
    icon: "Package",
  },
  {
    id: "act-4",
    type: "user",
    user: "Anna Reyes",
    action: "New user registered",
    details: "Customer account created",
    timestamp: "2 hours ago",
    icon: "Users",
  },
  {
    id: "act-5",
    type: "booking",
    user: "Carlos Mendoza",
    action: "Cancelled booking",
    details: "Anniversary Romance - April 20, 2026",
    timestamp: "3 hours ago",
    icon: "XCircle",
  },
  {
    id: "act-6",
    type: "report",
    user: "AI System",
    action: "Generated monthly report",
    details: "April 2026 analytics summary",
    timestamp: "5 hours ago",
    icon: "BarChart2",
  },
  {
    id: "act-7",
    type: "feedback",
    user: "Lisa Garcia",
    action: "Submitted feedback",
    details: "4-star review for Family Fiesta package",
    timestamp: "6 hours ago",
    icon: "MessageSquare",
  },
  {
    id: "act-8",
    type: "dietary",
    user: "Sofia Hernandez",
    action: "Dietary request submitted",
    details: "Gluten-free and nut-free preferences",
    timestamp: "8 hours ago",
    icon: "AlertCircle",
  },
];

// Enhanced Admin Stats
export const ADMIN_STATS = {
  totalUsers: { value: 342, change: +12.5, trend: "up" },
  activeSessions: { value: 28, change: +8.3, trend: "up" },
  feedbackCount: { value: 200, change: +15.2, trend: "up" },
  reportsGenerated: { value: 47, change: -2.1, trend: "down" },
  totalRevenue: { value: "₱2.4M", change: +18.7, trend: "up" },
  avgRating: { value: 4.8, change: +0.2, trend: "up" },
};
