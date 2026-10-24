import type {
  ComplianceItem,
  Deliverable,
  Milestone,
  Service,
  ServiceAddOn,
  ServiceTier,
} from "../types";

/**
 * Seed catalogue. In production this comes from the services API (admin → Services).
 * Prices are in GBP and exclude VAT; VAT is added at checkout.
 */

const ADD_ONS: ServiceAddOn[] = [
  {
    id: "express-48h",
    name: "Express 48h Delivery",
    description: "Priority scheduling with a 48-hour report turnaround.",
    price: 150,
    icon: "express",
  },
  {
    id: "extended-review",
    name: "Property Review (Extended)",
    description: "Extended condition and ventilation review for older properties.",
    price: 85,
    icon: "review",
  },
  {
    id: "regulatory-filing",
    name: "Expedited Regulatory Filing",
    description: "Accelerated processing for municipal permits.",
    price: 249,
    icon: "filing",
  },
  {
    id: "performance-training",
    name: "Post-Retrofit Performance Training",
    description: "1-on-1 session for smart-home energy management.",
    price: 120,
    icon: "training",
  },
];

const COMPLIANCE: ComplianceItem[] = [
  {
    title: "Audit Readiness",
    description: "Full documentation prepared for potential TrustMark audits or funding body inspections.",
    icon: "audit",
  },
  {
    title: "Qualified Assessors",
    description: "All assessments are performed by Level 3 or higher accredited Retrofit Assessors.",
    icon: "shield",
  },
  {
    title: "PAS 2035:2023 Aligned",
    description: "Every stage follows the latest PAS 2035 whole-house retrofit specification.",
    icon: "badge",
  },
  {
    title: "TrustMark Lodgement",
    description: "Certificates and evidence are lodged with the TrustMark Data Warehouse on completion.",
    icon: "file",
  },
];

const DELIVERABLES: Deliverable[] = [
  { title: "Final PDF Report", description: "Full technical breakdown and project roadmap.", icon: "report" },
  {
    title: "EPC Rating Certificate",
    description: "Official certification for the property and project records.",
    icon: "certificate",
  },
  { title: "Vendor RFP Package", description: "Standardised bid documents for the contractors.", icon: "package" },
];

const ASSESSMENT_TIMELINE: Milestone[] = [
  { title: "Day 1: Project Onboarding", description: "Gathering existing EPC data and scheduling site visit." },
  {
    title: "Day 3–5: Site Assessment",
    description: "Qualified assessor visits property for measurements and ventilation check.",
  },
  {
    title: "Day 10: Technical Report & MTIP",
    description: "Final delivery of all compliance documents and certified recommendations.",
  },
];

const tiers = (
  prices: [number, number, number],
  days: [number, number, number],
  overrides: Partial<Record<"basic" | "standard" | "premium", Partial<ServiceTier>>> = {},
): ServiceTier[] => [
  {
    id: "basic",
    name: "Basic",
    price: prices[0],
    summary: "Ideal for small residential properties (up to 2 beds) requiring standard compliance assessment.",
    deliveryDays: days[0],
    inclusions: ["1 Site Survey Included"],
    highlights: ["Site Survey", "Compliance Assessment", "Digital Report", "Email Support"],
    ...overrides.basic,
  },
  {
    id: "standard",
    name: "Standard",
    price: prices[1],
    summary: "For 3–4 bed homes needing a full assessment plus ventilation and occupancy reporting.",
    deliveryDays: days[1],
    inclusions: ["1 Site Survey Included", "Ventilation Report"],
    highlights: ["Thermal Imaging", "Ventilation Report", "Occupancy Assessment", "Coordinator Review"],
    ...overrides.standard,
  },
  {
    id: "premium",
    name: "Premium",
    price: prices[2],
    summary: "Comprehensive architectural and energy auditing for properties seeking net-zero status.",
    deliveryDays: days[2],
    inclusions: ["2 Site Surveys Included", "Dedicated Coordinator"],
    highlights: [
      "3D Thermal Mapping",
      "Priority Scheduling",
      "Certification Guarantee",
      "On-site Consultation",
      "Funding Eligibility Check",
      "Dedicated Coordinator",
    ],
    ...overrides.premium,
  },
];

export const SERVICES: Service[] = [
  {
    slug: "whole-house-retrofit-assessment",
    title: "Retrofit Whole-House Assessment",
    headline: "Whole-House Retrofit Assessment & Coordination",
    summary: "Comprehensive technical survey and digital energy model according to PAS 2035.",
    intro:
      "Professional compliance-led assessment for domestic energy efficiency projects, ensuring eligibility for government funding and institutional standards.",
    category: "assessment",
    badge: "PAS 2035",
    schemes: ["ECO4", "GBIS"],
    turnaround: "5–7 Days",
    image: "/images/services/onsite-survey.webp",
    gallery: [
      "/images/services/whole-house-facade.webp",
      "/images/services/digital-coordination.webp",
      "/images/services/thermal-model.webp",
      "/images/services/blueprint-inspection.webp",
    ],
    tiers: tiers([450, 850, 1450], [5, 7, 10]),
    addOns: ADD_ONS,
    overview: {
      paragraphs: [
        "Your Whole-House Retrofit Assessment is a comprehensive, PAS 2035-compliant evaluation designed to improve the energy performance, comfort, and long-term sustainability of residential properties. It provides property owners, landlords, housing associations, and professional housing providers with a clear, data-driven roadmap for reducing carbon emissions, lowering operational costs, and preparing buildings for future energy standards.",
        "The assessment takes a whole-house approach, meaning the property is evaluated as a complete system rather than focusing on isolated upgrades. This helps ensure that all recommended improvements work together effectively, avoiding issues such as poor ventilation, condensation, overheating, or inefficient energy use.",
      ],
      keyAreas: [
        "Building fabric performance (walls, roof, floors, windows, and insulation)",
        "Heating and hot water systems",
        "Ventilation and indoor air quality",
        "Air tightness and thermal bridging",
        "Existing energy efficiency measures",
        "Occupancy patterns and property usage",
        "Moisture risks and building condition",
        "Renewable energy opportunities",
        "Compliance with current UK retrofit and energy regulations",
      ],
    },
    included: [
      "On-site property survey (Full PAS 2035)",
      "Energy performance modelling (RdSAP)",
      "Ventilation & Condition reports",
      "Occupancy assessment documentation",
      "Medium-term Improvement Plan (MTIP)",
      "Retrofit Coordinator oversight",
    ],
    timeline: ASSESSMENT_TIMELINE,
    compliance: COMPLIANCE,
    deliverables: DELIVERABLES,
  },
  {
    slug: "retrofit-design-package",
    title: "Retrofit Design Package",
    headline: "Retrofit Design Package & Thermal Detailing",
    summary: "Detailed technical drawings and thermal bridging calculations for installers.",
    intro:
      "Installer-ready retrofit designs with U-value and thermal bridging calculations, produced by accredited Retrofit Designers.",
    category: "design",
    badge: "PAS 2035",
    schemes: ["ECO4", "GBIS"],
    turnaround: "7–10 Days",
    image: "/images/services/design-workstation.webp",
    gallery: [
      "/images/services/design-workstation.webp",
      "/images/services/thermal-model.webp",
      "/images/services/blueprint-inspection.webp",
      "/images/services/digital-coordination.webp",
    ],
    tiers: tiers([690, 980, 1650], [7, 10, 14]),
    addOns: ADD_ONS,
    overview: {
      paragraphs: [
        "Our Retrofit Design Package turns the assessment findings into a coordinated, installer-ready design. Each measure is specified with the detailing needed to avoid unintended consequences such as interstitial condensation and cold bridging.",
        "Designs are produced to PAS 2035 by accredited Retrofit Designers and reviewed by your Retrofit Coordinator before issue.",
      ],
      keyAreas: [
        "Measure specification and sequencing",
        "U-value and condensation risk calculations",
        "Thermal bridging junction details",
        "Ventilation strategy design",
        "Installer drawings and method statements",
      ],
    },
    included: [
      "Measure-by-measure retrofit design",
      "U-value & condensation risk analysis",
      "Thermal bridging calculations",
      "Ventilation strategy",
      "Installer-ready drawings",
      "Coordinator design sign-off",
    ],
    timeline: [
      { title: "Day 1: Design Brief", description: "Reviewing the assessment, MTIP and client objectives." },
      { title: "Day 3–7: Detailed Design", description: "Drawings, calculations and specifications prepared." },
      { title: "Day 10: Design Issue", description: "Coordinator-approved design pack released to installers." },
    ],
    compliance: COMPLIANCE,
    deliverables: DELIVERABLES,
  },
  {
    slug: "retrofit-coordination",
    title: "Retrofit Coordination",
    headline: "End-to-End Retrofit Coordination",
    summary: "End-to-end management from risk assessment to final sign-off.",
    intro:
      "A dedicated Retrofit Coordinator manages risk, installers and evidence so your project lodges first time.",
    category: "coordination",
    badge: "PAS 2035",
    schemes: ["ECO4", "GBIS"],
    turnaround: "Project-based",
    image: "/images/services/facade-coordination.webp",
    gallery: [
      "/images/services/facade-coordination.webp",
      "/images/services/digital-coordination.webp",
      "/images/services/whole-house-facade.webp",
      "/images/services/onsite-survey.webp",
    ],
    tiers: tiers([520, 890, 1390], [10, 14, 21]),
    addOns: ADD_ONS,
    overview: {
      paragraphs: [
        "Retrofit Coordination covers the full PAS 2035 journey: risk assessment, appointment of assessors and designers, installer management, evaluation and lodgement.",
        "Your coordinator is your single point of contact and keeps every document version-controlled inside the portal.",
      ],
      keyAreas: [
        "Project risk assessment (path A, B or C)",
        "Installer appointment and oversight",
        "Handover and evaluation",
        "TrustMark lodgement",
      ],
    },
    included: [
      "Dedicated Retrofit Coordinator",
      "PAS 2035 risk assessment",
      "Installer liaison",
      "Quality assurance checks",
      "Post-installation evaluation",
      "TrustMark lodgement",
    ],
    timeline: [
      { title: "Week 1: Risk Assessment", description: "Project pathway agreed and team appointed." },
      { title: "Week 2–4: Installation", description: "Installer progress monitored with photo evidence." },
      { title: "Week 5: Sign-off", description: "Evaluation completed and lodgement submitted." },
    ],
    compliance: COMPLIANCE,
    deliverables: DELIVERABLES,
  },
  {
    slug: "eco4-funding-application",
    title: "ECO4 Funding Application",
    headline: "ECO4 & GBIS Funding Application Support",
    summary: "Eligibility checks and complete funding applications handled for you.",
    intro: "We check eligibility, prepare evidence and submit your ECO4 or GBIS application end to end.",
    category: "funding",
    badge: "Funding",
    schemes: ["ECO4", "GBIS"],
    turnaround: "3–5 Days",
    image: "/images/services/funding-documents.webp",
    gallery: [
      "/images/services/funding-documents.webp",
      "/images/services/blueprint-inspection.webp",
      "/images/services/digital-coordination.webp",
      "/images/services/onsite-survey.webp",
    ],
    tiers: tiers([295, 450, 690], [3, 5, 7]),
    addOns: ADD_ONS,
    overview: {
      paragraphs: [
        "Navigating government funding schemes can be slow and confusing. Our funding specialists confirm eligibility, collect the right evidence and submit a complete application on your behalf.",
      ],
      keyAreas: ["Household eligibility checks", "Evidence collection", "Scheme application", "Contribution breakdown"],
    },
    included: [
      "Eligibility assessment",
      "Evidence checklist",
      "Application preparation",
      "Contribution breakdown",
      "Submission tracking",
      "Funder liaison",
    ],
    timeline: [
      { title: "Day 1: Eligibility Check", description: "Household and property eligibility confirmed." },
      { title: "Day 2–3: Evidence", description: "Documents gathered and verified." },
      { title: "Day 5: Submission", description: "Application submitted and tracked in your dashboard." },
    ],
    compliance: COMPLIANCE,
    deliverables: DELIVERABLES,
  },
  {
    slug: "thermal-energy-modelling",
    title: "Thermal & Energy Modelling",
    headline: "Thermal Imaging & Energy Modelling",
    summary: "Thermal imaging survey with a digital twin energy model of your home.",
    intro: "Pinpoint heat loss with thermal imaging and model the impact of every measure before you spend.",
    category: "assessment",
    badge: "PAS 2035",
    schemes: ["ECO4"],
    turnaround: "5–7 Days",
    image: "/images/services/thermal-model.webp",
    gallery: [
      "/images/services/thermal-model.webp",
      "/images/services/design-workstation.webp",
      "/images/services/whole-house-facade.webp",
      "/images/services/blueprint-inspection.webp",
    ],
    tiers: tiers([380, 640, 990], [5, 7, 10]),
    addOns: ADD_ONS,
    overview: {
      paragraphs: [
        "A thermal imaging survey combined with a calibrated energy model shows exactly where your home loses heat and which measures deliver the best return.",
      ],
      keyAreas: ["Thermal imaging survey", "Heat loss calculation", "Measure scenario modelling", "Carbon & bill savings"],
    },
    included: [
      "Thermal imaging survey",
      "Room-by-room heat loss",
      "Energy model (RdSAP / PHPP)",
      "Scenario comparison",
      "Savings forecast",
      "Assessor walkthrough call",
    ],
    timeline: ASSESSMENT_TIMELINE,
    compliance: COMPLIANCE,
    deliverables: DELIVERABLES,
  },
  {
    slug: "full-retrofit-package",
    title: "Full Retrofit Package",
    headline: "Full Retrofit Package — Assessment to Sign-off",
    summary: "Assessment, design, coordination and funding in one managed package.",
    intro: "One price, one team: assessment, design, coordination and funding support for your whole project.",
    category: "full-package",
    badge: "PAS 2035",
    schemes: ["ECO4", "GBIS"],
    turnaround: "4–6 Weeks",
    image: "/images/services/digital-coordination.webp",
    gallery: [
      "/images/services/digital-coordination.webp",
      "/images/services/whole-house-facade.webp",
      "/images/services/design-workstation.webp",
      "/images/services/onsite-survey.webp",
    ],
    tiers: tiers([1250, 1950, 2950], [28, 35, 42]),
    addOns: ADD_ONS,
    overview: {
      paragraphs: [
        "The Full Retrofit Package bundles every PAS 2035 role into a single managed project, with one coordinator and one dashboard from first survey to final certificate.",
      ],
      keyAreas: ["Whole-house assessment", "Retrofit design", "Coordination & QA", "Funding support", "Lodgement"],
    },
    included: [
      "Whole-House Assessment",
      "Retrofit Design Package",
      "Retrofit Coordination",
      "Funding application support",
      "Installer management",
      "Final compliance certificate",
    ],
    timeline: [
      { title: "Week 1: Assessment", description: "Survey, modelling and MTIP." },
      { title: "Week 2–3: Design & Funding", description: "Installer-ready design and funding submission." },
      { title: "Week 4–6: Install & Sign-off", description: "Coordinated installation, evaluation and lodgement." },
    ],
    compliance: COMPLIANCE,
    deliverables: DELIVERABLES,
  },
];
