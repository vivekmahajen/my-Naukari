import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

// Shared test password for all demo candidates.
export const CANDIDATE_PASSWORD = "password123";

/* Five senior academic leaders whose skills/experience match a President /
   Vice-Chancellor style role (PhD, NAAC/NBA, NIRF, NEP 2020, UGC/AICTE,
   fundraising, institution-building). All data is fictional / for testing. */
export const CANDIDATES = [
  {
    name: "Dr. Rajesh Menon",
    email: "rajesh.menon@example.com",
    gender: "Male",
    city: "Pune, Maharashtra",
    phone: "+91 98200 11001",
    headline: "Vice-Chancellor | Institution Builder | NAAC A++ & NIRF Top-100",
    experience: "22 years",
    skills: ["Academic Leadership", "Institution Building", "NAAC Accreditation", "NIRF Rankings",
      "NEP 2020", "UGC & AICTE Compliance", "Research Strategy", "Fundraising & Grants",
      "Strategic Planning", "Change Management"],
    resume: {
      summary: "Vice-Chancellor with 22 years in higher education, credited with taking a state university from NAAC B++ to A++ and into the NIRF Top-100. Deep regulatory fluency (UGC, AICTE, NEP 2020) and a strong record in research growth and fundraising.",
      education: [
        "Ph.D., Management, Savitribai Phule Pune University, 2004",
        "M.B.A., Symbiosis International University, 1999",
      ],
      experience: [
        { role: "Vice-Chancellor", org: "Deccan State University, Pune", period: "2017 – Present",
          points: ["Led NAAC re-accreditation from B++ to A++ (CGPA 3.6)",
            "Improved NIRF University rank from 130s into the Top-100",
            "Raised ₹120 cr in research grants, CSR and alumni endowments"] },
        { role: "Pro-Vice-Chancellor", org: "Deccan State University, Pune", period: "2012 – 2017",
          points: ["Implemented NEP 2020 multidisciplinary curriculum across 8 schools",
            "Established the IQAC and a centralized examination reform"] },
        { role: "Professor & Dean (Academics)", org: "Pune Institute of Management", period: "2006 – 2012",
          points: ["Launched 4 new PG programmes; doubled research publications"] },
      ],
      achievements: ["NAAC A++ (CGPA 3.6, 2021)", "NIRF Top-100 University (2022, 2023)",
        "₹120 cr cumulative funds mobilized", "MoUs with 12 global universities"],
      affiliations: ["Member, UGC Curriculum Committee", "Fellow, All India Management Association"],
    },
  },
  {
    name: "Dr. Priya Deshpande",
    email: "priya.deshpande@example.com",
    gender: "Female",
    city: "Mumbai, Maharashtra",
    phone: "+91 98200 11002",
    headline: "Pro-Vice-Chancellor | NEP 2020 & Research | Accreditation Leader",
    experience: "18 years",
    skills: ["Academic Leadership", "NEP 2020", "Research Strategy", "NAAC Accreditation",
      "Curriculum Reform", "Faculty Development", "UGC Compliance", "Internationalization",
      "Fundraising & Grants", "Governance"],
    resume: {
      summary: "Pro-Vice-Chancellor and researcher with 18 years driving academic quality, NEP 2020 rollout and internationalization. Led two successful NAAC cycles and grew sponsored research three-fold.",
      education: [
        "Ph.D., Biotechnology, IIT Bombay, 2007",
        "M.Sc., Life Sciences, University of Mumbai, 2002",
      ],
      experience: [
        { role: "Pro-Vice-Chancellor", org: "Mumbai Metropolitan University", period: "2018 – Present",
          points: ["Designed and rolled out NEP 2020 framework for 40,000+ students",
            "Grew sponsored research from ₹8 cr to ₹26 cr annually",
            "Signed 9 international dual-degree partnerships"] },
        { role: "Dean (Research & Development)", org: "Mumbai Metropolitan University", period: "2013 – 2018",
          points: ["Set up Central Research Facility and IPR cell",
            "Led NAAC A grade accreditation as coordinator"] },
        { role: "Professor", org: "Ramnarain Ruia College", period: "2006 – 2013",
          points: ["Mentored 14 PhD scholars; 60+ peer-reviewed papers"] },
      ],
      achievements: ["NAAC A (two cycles)", "3× growth in sponsored research",
        "9 international partnerships", "Recipient, State Best Teacher Award 2016"],
      affiliations: ["Member, NEP State Steering Committee, Maharashtra"],
    },
  },
  {
    name: "Dr. Arvind Krishnan",
    email: "arvind.krishnan@example.com",
    gender: "Male",
    city: "Pune, Maharashtra",
    phone: "+91 98200 11003",
    headline: "Dean & Director | NBA/AICTE Accreditation | Industry & Employability",
    experience: "16 years",
    skills: ["Academic Administration", "NBA Accreditation", "AICTE Compliance", "Industry Partnerships",
      "Placements & Employability", "Research Growth", "Fundraising & Grants", "Strategic Planning",
      "Institution Building"],
    resume: {
      summary: "Engineering Dean and Director with 16 years building industry-aligned programmes, NBA accreditation and placement outcomes. Strong AICTE/UGC compliance and grant fundraising track record.",
      education: [
        "Ph.D., Computer Engineering, College of Engineering Pune (COEP), 2009",
        "B.Tech, Computer Science, VJTI Mumbai, 2003",
      ],
      experience: [
        { role: "Director", org: "Sahyadri Institute of Technology, Pune", period: "2019 – Present",
          points: ["Secured NBA accreditation for 6 UG programmes",
            "Lifted placement rate from 62% to 91% via 80+ industry MoUs",
            "Won ₹18 cr in AICTE/DST research and infrastructure grants"] },
        { role: "Dean (Engineering)", org: "Sahyadri Institute of Technology, Pune", period: "2014 – 2019",
          points: ["Launched AI & Data Science department; set up incubation centre"] },
        { role: "Associate Professor & HoD", org: "MIT Pune", period: "2008 – 2014",
          points: ["Built industry-sponsored labs with TCS and Persistent"] },
      ],
      achievements: ["NBA accreditation (6 programmes)", "91% placements",
        "₹18 cr grants", "2 startups incubated to seed stage"],
      affiliations: ["Member, AICTE Approval Committee (expert panel)"],
    },
  },
  {
    name: "Dr. Sunita Rao",
    email: "sunita.rao@example.com",
    gender: "Female",
    city: "Nagpur, Maharashtra",
    phone: "+91 98200 11004",
    headline: "Registrar & Professor | University Governance | UGC/Statutory Compliance",
    experience: "15 years",
    skills: ["University Governance", "UGC Compliance", "NAAC Accreditation", "Statutory Affairs",
      "Academic Administration", "Policy & Process", "Quality Assurance (IQAC)", "Examination Reform"],
    resume: {
      summary: "University Registrar and Professor with 15 years leading governance, statutory compliance and IQAC-driven quality. Anchored two NAAC accreditations and modernized examination systems.",
      education: [
        "Ph.D., Commerce, Rashtrasant Tukadoji Maharaj Nagpur University, 2010",
        "M.Com, Nagpur University, 2005",
      ],
      experience: [
        { role: "Registrar", org: "Vidarbha State University, Nagpur", period: "2018 – Present",
          points: ["Led statutory governance: Academic Council, BoS, Executive Council",
            "Anchored NAAC A grade accreditation as IQAC Director",
            "Digitized examinations for 60,000 students; cut result time by 50%"] },
        { role: "Deputy Registrar (Academic)", org: "Vidarbha State University, Nagpur", period: "2013 – 2018",
          points: ["Implemented CBCS and UGC regulation compliance across affiliated colleges"] },
        { role: "Assistant Professor", org: "Hislop College, Nagpur", period: "2008 – 2013",
          points: ["NAAC coordinator; published 22 papers in commerce & governance"] },
      ],
      achievements: ["NAAC A grade (IQAC Director)", "End-to-end exam digitization",
        "100% UGC statutory compliance in audits"],
      affiliations: ["Member, Maharashtra Universities Registrars' Forum"],
    },
  },
  {
    name: "Dr. Imran Sheikh",
    email: "imran.sheikh@example.com",
    gender: "Male",
    city: "Pune, Maharashtra",
    phone: "+91 98200 11005",
    headline: "Director-General | Private University Builder | Global Rankings & Fundraising",
    experience: "20 years",
    skills: ["Institution Building", "Global Rankings (QS/THE)", "NIRF", "Fundraising & Endowments",
      "Strategic Planning", "Change Management", "Internationalization", "Research Strategy", "NEP 2020"],
    resume: {
      summary: "Director-General who built a greenfield private university to 15,000 students and global ranking visibility in a decade. Expert in fundraising, internationalization and large-scale change.",
      education: [
        "Ph.D., Economics, Jawaharlal Nehru University (JNU), 2005",
        "M.A., Economics, University of Delhi, 2000",
      ],
      experience: [
        { role: "Director-General", org: "Pune Global University (Private)", period: "2015 – Present",
          points: ["Scaled a new private university from launch to 15,000 students",
            "Achieved QS Asia ranking band and NIRF visibility within 8 years",
            "Raised ₹300 cr in capital, endowments and CSR partnerships"] },
        { role: "Vice-President (Academic Affairs)", org: "Horizon Education Group", period: "2009 – 2015",
          points: ["Set up 3 campuses; led NEP-aligned multidisciplinary model"] },
        { role: "Professor & Director (Strategy)", org: "Symbiosis (constituent)", period: "2004 – 2009",
          points: ["Designed internationalization and dual-degree strategy"] },
      ],
      achievements: ["Built university to 15,000 students", "QS Asia ranking band",
        "₹300 cr funds raised", "12 international campus partnerships"],
      affiliations: ["Board Member, Association of Indian Universities (AIU) committee"],
    },
  },
];

export async function seedCandidates() {
  const hash = await bcrypt.hash(CANDIDATE_PASSWORD, 10);
  let n = 0;
  for (const c of CANDIDATES) {
    await pool.query(
      `INSERT INTO users (name,email,password_hash,role,gender,headline,experience,city,skills,resume)
       VALUES ($1,$2,$3,'candidate',$4,$5,$6,$7,$8,$9)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name, gender = EXCLUDED.gender, headline = EXCLUDED.headline,
         experience = EXCLUDED.experience, city = EXCLUDED.city, skills = EXCLUDED.skills,
         resume = EXCLUDED.resume`,
      [c.name, c.email, hash, c.gender, c.headline, c.experience, c.city, c.skills, JSON.stringify(c.resume)]
    );
    n++;
  }
  console.log(`✓ Seeded ${n} test candidates (password: ${CANDIDATE_PASSWORD}).`);
  return CANDIDATES.map((c) => ({ name: c.name, email: c.email }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedCandidates()
    .then(() => pool.end())
    .catch((e) => { console.error("Candidate seed failed:", e); process.exit(1); });
}
