/* ============================================================
   Naukri+ mock data
   Every job carries the fields that close Naukri's gaps:
   verified, salaryMin/Max (never hidden), postedDays (freshness),
   applicants (transparency), matchScore + matchReason (explainable AI).
   ============================================================ */

const JOBS = [
  {
    id: "j1",
    title: "Senior Frontend Engineer",
    company: "Razorpay",
    logoColor: "#1875e5", logoText: "Rz",
    verified: true,
    location: "Bengaluru", remote: "Hybrid",
    type: "Full-time", experience: "5–8 yrs",
    salaryMin: 35, salaryMax: 55, // LPA
    postedDays: 1,
    applicants: 47, openings: 3,
    skills: ["React", "TypeScript", "System Design", "Next.js"],
    matchScore: 94,
    matchReason: "Matches 4/4 of your top skills (React, TypeScript) and your preferred salary band.",
    category: "Engineering",
    about: "Razorpay is building the financial backbone for businesses across India. We're hiring frontend engineers to own customer-facing payment experiences used by millions.",
    responsibilities: [
      "Build and own high-traffic React applications end-to-end",
      "Drive frontend architecture and performance budgets",
      "Mentor mid-level engineers and review designs"
    ],
    requirements: [
      "5+ years building production React apps",
      "Strong TypeScript and component-design fundamentals",
      "Experience with performance optimization at scale"
    ]
  },
  {
    id: "j2",
    title: "Product Designer (UX)",
    company: "Zomato",
    logoColor: "#e23744", logoText: "Zo",
    verified: true,
    location: "Gurugram", remote: "On-site",
    type: "Full-time", experience: "3–6 yrs",
    salaryMin: 22, salaryMax: 38,
    postedDays: 2,
    applicants: 31, openings: 2,
    skills: ["Figma", "User Research", "Design Systems", "Prototyping"],
    matchScore: 81,
    matchReason: "Strong overlap on Figma & Design Systems; location is outside your saved preference.",
    category: "Design",
    about: "Join Zomato's design org to shape ordering experiences for hundreds of millions of users.",
    responsibilities: [
      "Own end-to-end design for key consumer flows",
      "Run user research and translate insights into design",
      "Contribute to and evolve the design system"
    ],
    requirements: [
      "3+ years in product/UX design",
      "Portfolio showing shipped consumer products",
      "Fluency in Figma and prototyping tools"
    ]
  },
  {
    id: "j3",
    title: "Backend Engineer (Go)",
    company: "Cred",
    logoColor: "#12283f", logoText: "Cr",
    verified: true,
    location: "Bengaluru", remote: "Remote",
    type: "Full-time", experience: "2–5 yrs",
    salaryMin: 28, salaryMax: 45,
    postedDays: 4,
    applicants: 88, openings: 4,
    skills: ["Go", "PostgreSQL", "Microservices", "Kafka"],
    matchScore: 76,
    matchReason: "Matches your interest in backend roles; Go is a stretch skill not on your profile yet.",
    category: "Engineering",
    about: "CRED is a members-only platform rewarding creditworthy individuals. Our backend team builds resilient, high-scale financial systems.",
    responsibilities: [
      "Design and build microservices in Go",
      "Own data models and event pipelines",
      "Ensure reliability for financial-grade systems"
    ],
    requirements: [
      "2+ years backend experience",
      "Comfort with Go or strong willingness to learn",
      "Solid understanding of databases and queues"
    ]
  },
  {
    id: "j4",
    title: "Data Analyst",
    company: "Swiggy",
    logoColor: "#fc8019", logoText: "Sw",
    verified: true,
    location: "Bengaluru", remote: "Hybrid",
    type: "Full-time", experience: "1–3 yrs",
    salaryMin: 12, salaryMax: 20,
    postedDays: 3,
    applicants: 120, openings: 5,
    skills: ["SQL", "Python", "Tableau", "Statistics"],
    matchScore: 69,
    matchReason: "SQL & Python align well; experience band is below your seniority.",
    category: "Data",
    about: "Swiggy's analytics team turns billions of data points into decisions that move the business.",
    responsibilities: [
      "Build dashboards and self-serve analytics",
      "Partner with ops teams on KPIs",
      "Run deep-dive analyses on growth levers"
    ],
    requirements: [
      "1+ years in analytics",
      "Strong SQL; Python a plus",
      "Comfortable with BI tools (Tableau/Looker)"
    ]
  },
  {
    id: "j5",
    title: "Engineering Manager",
    company: "Postman",
    logoColor: "#ff6c37", logoText: "Pm",
    verified: true,
    location: "Bengaluru", remote: "Remote",
    type: "Full-time", experience: "8–12 yrs",
    salaryMin: 60, salaryMax: 90,
    postedDays: 6,
    applicants: 19, openings: 1,
    skills: ["Leadership", "System Design", "Hiring", "Agile"],
    matchScore: 72,
    matchReason: "Leadership & System Design match; seniority slightly above your current level.",
    category: "Engineering",
    about: "Postman is the world's leading API platform. Lead a team building tools used by 30M+ developers.",
    responsibilities: [
      "Lead and grow a team of 6–10 engineers",
      "Own delivery, quality and team health",
      "Drive technical strategy with product"
    ],
    requirements: [
      "3+ years managing engineers",
      "Strong technical background",
      "Track record of shipping at scale"
    ]
  },
  {
    id: "j6",
    title: "Marketing Manager",
    company: "Meesho",
    logoColor: "#9c1ab1", logoText: "Me",
    verified: false,
    location: "Bengaluru", remote: "On-site",
    type: "Full-time", experience: "4–7 yrs",
    salaryMin: 18, salaryMax: 30,
    postedDays: 21,
    applicants: 210, openings: 2,
    skills: ["Growth", "Performance Marketing", "SEO", "Analytics"],
    matchScore: 54,
    matchReason: "Limited overlap with your engineering profile — shown for transparency only.",
    category: "Marketing",
    about: "Meesho enables small businesses to sell online across India.",
    responsibilities: [
      "Own growth marketing channels",
      "Run performance campaigns",
      "Report on CAC and ROAS"
    ],
    requirements: [
      "4+ years in growth/performance marketing",
      "Strong analytical skills",
      "Experience with large budgets"
    ]
  },
  {
    id: "j7",
    title: "DevOps Engineer",
    company: "Groww",
    logoColor: "#00b386", logoText: "Gr",
    verified: true,
    location: "Bengaluru", remote: "Hybrid",
    type: "Full-time", experience: "3–6 yrs",
    salaryMin: 24, salaryMax: 40,
    postedDays: 5,
    applicants: 64, openings: 2,
    skills: ["Kubernetes", "AWS", "Terraform", "CI/CD"],
    matchScore: 78,
    matchReason: "Cloud & CI/CD skills align with your profile; Terraform is a growth area.",
    category: "Engineering",
    about: "Groww is one of India's largest investment platforms. Our infra team keeps it fast and reliable.",
    responsibilities: [
      "Own CI/CD and cloud infrastructure",
      "Improve reliability and observability",
      "Automate everything that can be automated"
    ],
    requirements: [
      "3+ years in DevOps/SRE",
      "Hands-on Kubernetes and AWS",
      "Infrastructure-as-code experience"
    ]
  },
  {
    id: "j8",
    title: "Full Stack Developer",
    company: "Zerodha",
    logoColor: "#387ed1", logoText: "Ze",
    verified: true,
    location: "Bengaluru", remote: "On-site",
    type: "Full-time", experience: "2–5 yrs",
    salaryMin: 20, salaryMax: 36,
    postedDays: 2,
    applicants: 73, openings: 3,
    skills: ["React", "Node.js", "PostgreSQL", "TypeScript"],
    matchScore: 88,
    matchReason: "Matches 3/4 top skills (React, TypeScript, Node) and your salary expectation.",
    category: "Engineering",
    about: "Zerodha is India's largest stockbroker, built by a small, sharp engineering team.",
    responsibilities: [
      "Build features across the stack",
      "Own quality from DB to UI",
      "Keep the product fast and simple"
    ],
    requirements: [
      "2+ years full-stack experience",
      "Comfort with React and Node",
      "Pragmatic, ownership mindset"
    ]
  }
];

/* Candidate application tracker — fixes Naukri's "black hole after apply".
   stage index maps to STAGES below. status: active | rejected | offer */
const STAGES = ["Applied", "Viewed", "Shortlisted", "Interview", "Decision"];

const APPLICATIONS = [
  { jobId: "j1", appliedDays: 3, stage: 3, status: "active",   note: "Interview scheduled for Thu, 11:00 AM" },
  { jobId: "j8", appliedDays: 5, stage: 2, status: "active",   note: "Shortlisted by recruiter — assessment sent" },
  { jobId: "j3", appliedDays: 8, stage: 1, status: "active",   note: "Recruiter viewed your profile 2 days ago" },
  { jobId: "j2", appliedDays: 12, stage: 4, status: "offer",   note: "Offer extended 🎉 — respond by Jun 25" },
  { jobId: "j4", appliedDays: 15, stage: 4, status: "rejected",note: "Position filled — feedback: seeking more BI depth" }
];
