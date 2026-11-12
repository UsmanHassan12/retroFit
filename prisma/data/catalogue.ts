/**
 * StepSoft service catalogue — seed data from "Retrofit Portal — Draft Service Catalogue &
 * Commercial Rules (for Dev)", 11 Nov 2026.
 *
 * Every price, turnaround and percentage here is a PLACEHOLDER until Jalil confirms the
 * final sheet. This file only seeds the database; after that, admins edit everything from
 * the console (services, stages, questions, documents, add-ons, bundles, settings).
 */
import { MEASURES } from "../../src/server/domain";

type Role = "ASSESSOR" | "DESIGNER" | "COORDINATOR" | "ADMIN";
type Column = "BACKLOG" | "AWAITING_CLIENT" | "ASSESSMENT" | "DESIGN" | "COORDINATION" | "QA" | "DONE";
type Status = "SCHEDULED" | "IN_PROGRESS" | "IN_QA" | "DELIVERED" | "COMPLETED" | null;
type Condition = Record<string, unknown> | null;

export type SeedStage = { name: string; description?: string; role: Role; column: Column; sla: number | null; status: Status; clientVisible?: boolean };
export type SeedQuestion = { key: string; label: string; type: "TEXT" | "NUMBER" | "SELECT" | "MULTISELECT" | "DATE" | "FILE" | "BOOLEAN"; required?: boolean; options?: Array<{ value: string; label: string }>; condition?: Condition; help?: string; scope?: "ORDER" | "LINE"; step?: number };
export type SeedDocument = { key: string; label: string; required?: boolean; condition?: Condition; timing?: "BEFORE_START" | "DURING_WORK"; types?: string[] };
export type SeedDeliverable = { name: string; description: string; kind?: "PDF" | "SPREADSHEET" | "REPORT"; versioned?: boolean };

export type SeedService = {
  code: string;
  slug: string;
  title: string;
  summary: string;
  category: "ASSESSMENT" | "DESIGN" | "COORDINATION" | "CALCULATIONS" | "SURVEYS" | "FUNDING" | "COMPLIANCE";
  schemes: Array<"ECO4" | "GBIS" | "WHLG" | "SHDF">;
  priceUnit: "PROPERTY" | "ELEMENT" | "JUNCTION" | "VISIT" | "PACKAGE";
  listPricePence: number;
  siteVisit: "NONE" | "REQUIRED" | "OPTIONAL";
  standardDays: number | null;
  fastTrackDays: number | null;
  standardLabel?: string;
  fastTrackLabel?: string;
  requiresProperty?: boolean;
  image: string;
  gallery: string[];
  included: string[];
  keyAreas: string[];
  stages: SeedStage[];
  questions: SeedQuestion[];
  documents: SeedDocument[];
  deliverables: SeedDeliverable[];
};

const opts = (...pairs: Array<[string, string]>) => pairs.map(([value, label]) => ({ value, label }));
const confirmed: SeedStage = { name: "Order confirmed", description: "Payment received and your project created.", role: "COORDINATOR", column: "DONE", sla: null, status: null };
const visitBooked: SeedStage = { name: "Visit booked", description: "We agree a date and AM/PM window for the site visit.", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null };

const notOrdered = (code: string): Condition => ({ key: "$services", op: "notIncludes", value: code });

// ─── Common intake (serviceId = null) ───────────────────────────────────────

const FUNDED = ["ECO4", "GBIS", "WHLG", "SHDF"];

export const COMMON_QUESTIONS: SeedQuestion[] = [
  // Step 5 — Funding scheme. Drives which documents are required.
  { step: 5, scope: "ORDER", key: "scheme", label: "Funding scheme", type: "SELECT", required: true, options: opts(["ECO4", "ECO4"], ["GBIS", "GBIS"], ["WHLG", "Warm Homes Local Grant"], ["SHDF", "SHDF"], ["PRIVATE", "Private"], ["OTHER", "Other"]) },
  { step: 5, scope: "ORDER", key: "funderName", label: "Managing agent or funder name", type: "TEXT", condition: { key: "scheme", op: "in", value: FUNDED } },
  { step: 5, scope: "ORDER", key: "schemeReference", label: "Scheme reference (if known)", type: "TEXT", condition: { key: "scheme", op: "in", value: FUNDED } },
  // Step 6 — Installer. Required when a partner books a scheme job, and for services that work with the installer.
  ...(["installerCompany", "trustmarkLicence", "pas2030Certified"] as const).map((key) => ({
    step: 6,
    scope: "ORDER" as const,
    key,
    label: key === "installerCompany" ? "Installer company" : key === "trustmarkLicence" ? "Installer TrustMark licence number" : "Installer holds PAS 2030 certification",
    type: key === "pas2030Certified" ? ("BOOLEAN" as const) : ("TEXT" as const),
    required: true,
    condition: {
      any: [
        { all: [{ key: "$tier", op: "eq", value: "PARTNER" }, { key: "scheme", op: "in", value: FUNDED }] },
        { key: "$services", op: "includes", value: ["RC", "OA", "TM"] },
      ],
    },
  })),
  // Step 7 — Measures. Used by design, coordination, surveys and calculations.
  {
    step: 7,
    scope: "ORDER",
    key: "measures",
    label: "Measures",
    type: "MULTISELECT",
    required: true,
    options: MEASURES.map((measure) => ({ value: measure.value, label: measure.label })),
    condition: { key: "$services", op: "includes", value: ["RD", "RC", "UV", "TB", "CR", "TS", "ES", "OA", "TM"] },
  },
];

// ─── Services ───────────────────────────────────────────────────────────────

export const SERVICES: SeedService[] = [
  {
    code: "RA",
    slug: "retrofit-assessment",
    title: "Retrofit Assessment",
    summary: "PAS 2035:2023 whole-house assessment with RdSAP, floor plan, condition and occupancy review.",
    category: "ASSESSMENT",
    schemes: ["ECO4", "GBIS", "WHLG", "SHDF"],
    priceUnit: "PROPERTY",
    listPricePence: 22_500,
    siteVisit: "REQUIRED",
    standardDays: 5,
    fastTrackDays: 2,
    image: "/images/services/whole-house-facade.webp",
    gallery: ["/images/services/whole-house-facade.webp", "/images/services/onsite-survey.webp", "/images/services/blueprint-inspection.webp"],
    included: [
      "PAS 2035:2023 Retrofit Assessment report",
      "RdSAP assessment and EPC data",
      "Measured floor plan",
      "Condition report",
      "Occupancy assessment",
      "Ventilation and moisture review",
      "Dated photo evidence",
      "Data for the design and for TrustMark lodgement",
    ],
    keyAreas: ["RdSAP and EPC data", "Condition and occupancy", "Ventilation and moisture"],
    stages: [
      confirmed,
      visitBooked,
      { name: "Site visit (1–3 hours)", description: "A Retrofit Assessor surveys the property.", role: "ASSESSOR", column: "ASSESSMENT", sla: 0, status: "SCHEDULED" },
      { name: "Data entry and RdSAP", role: "ASSESSOR", column: "ASSESSMENT", sla: 1, status: "IN_PROGRESS" },
      { name: "Report drafted", role: "ASSESSOR", column: "ASSESSMENT", sla: 2, status: null },
      { name: "QA review", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "DELIVERED" },
    ],
    questions: [
      { key: "customerIsOwner", label: "Are you the property owner?", type: "BOOLEAN", required: true },
      { key: "mainHeating", label: "Main heating system and fuel", type: "TEXT", required: true },
      { key: "knownIssues", label: "Known damp, mould or structural issues", type: "TEXT" },
      { key: "previousEpc", label: "Previous EPC reference", type: "TEXT" },
      { key: "occupants", label: "Number of occupants", type: "NUMBER", required: true },
      { key: "vulnerableOccupants", label: "Any vulnerable occupants?", type: "BOOLEAN", required: true },
      { key: "measuresConsidered", label: "Measures being considered", type: "MULTISELECT", options: MEASURES.map((measure) => ({ value: measure.value, label: measure.label })) },
    ],
    documents: [
      { key: "existingEpc", label: "Existing EPC", required: false },
      { key: "ownerConsent", label: "Landlord or owner consent to visit", required: true, condition: { key: "customerIsOwner", op: "eq", value: false } },
      { key: "schemeEvidence", label: "Scheme eligibility evidence (ECO4/GBIS)", required: false, condition: { key: "scheme", op: "in", value: ["ECO4", "GBIS"] } },
    ],
    deliverables: [
      { name: "Retrofit Assessment report", description: "PAS 2035:2023 assessment report.", kind: "REPORT" },
      { name: "RdSAP and EPC data", description: "RdSAP assessment and EPC data file.", kind: "SPREADSHEET" },
      { name: "Measured floor plan", description: "Measured floor plan of the property." },
      { name: "Photo evidence", description: "Dated photo evidence from the visit.", versioned: false },
    ],
  },
  {
    code: "RD",
    slug: "retrofit-design",
    title: "Retrofit Design",
    summary: "Retrofit Design and Medium-Term Improvement Plan: measures, U-value targets, ventilation and moisture strategy.",
    category: "DESIGN",
    schemes: ["ECO4", "GBIS", "WHLG", "SHDF"],
    priceUnit: "PROPERTY",
    listPricePence: 29_500,
    siteVisit: "NONE",
    standardDays: 7,
    fastTrackDays: 3,
    image: "/images/services/design-workstation.webp",
    gallery: ["/images/services/design-workstation.webp", "/images/services/thermal-model.webp", "/images/services/blueprint-inspection.webp"],
    included: [
      "Retrofit Design document",
      "Specification of measures and how they combine",
      "U-value targets",
      "Ventilation strategy",
      "Moisture and condensation risk review",
      "Medium-Term Improvement Plan (MTIP)",
      "Design sign-off for TrustMark",
      "Two revision rounds included",
    ],
    keyAreas: ["Measures specification", "Ventilation strategy", "MTIP"],
    stages: [
      confirmed,
      { name: "Assessment received and reviewed", role: "DESIGNER", column: "DESIGN", sla: 1, status: "IN_PROGRESS" },
      { name: "Design drafted", role: "DESIGNER", column: "DESIGN", sla: 3, status: null },
      { name: "Calculations", description: "U-value, ψ-value and condensation calculations (ordered as add-ons or bundled).", role: "DESIGNER", column: "DESIGN", sla: 1, status: null },
      { name: "QA and compliance check", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "DELIVERED" },
      { name: "Revisions (2 rounds included)", role: "DESIGNER", column: "DESIGN", sla: null, status: null },
    ],
    questions: [
      { key: "measuresToDesign", label: "Measures to design", type: "MULTISELECT", required: true, options: MEASURES.map((measure) => ({ value: measure.value, label: measure.label })) },
      { key: "manufacturer", label: "Product or system manufacturer (if chosen)", type: "TEXT" },
      { key: "installerName", label: "Installer name", type: "TEXT" },
      { key: "riskPathway", label: "Risk pathway (if known)", type: "SELECT", options: opts(["A", "A"], ["B", "B"], ["C", "C"]) },
      { key: "installStartDeadline", label: "Deadline for install start", type: "DATE" },
    ],
    documents: [
      { key: "assessmentReport", label: "Retrofit Assessment report", required: true, condition: notOrdered("RA") },
      { key: "rdsapFile", label: "RdSAP or EPC data file", required: true, condition: notOrdered("RA") },
      { key: "elevationPhotos", label: "Photos of the elevations", required: true, condition: notOrdered("RA") },
      { key: "productDataSheets", label: "Installer's product data sheets", required: false },
    ],
    deliverables: [
      { name: "Retrofit Design document", description: "Specification of measures, U-value targets and ventilation strategy.", kind: "REPORT" },
      { name: "Medium-Term Improvement Plan", description: "MTIP for the property." },
      { name: "Design sign-off", description: "Design sign-off for TrustMark.", versioned: false },
    ],
  },
  {
    code: "RC",
    slug: "retrofit-coordination",
    title: "Retrofit Coordination",
    summary: "Retrofit Coordinator from risk pathway to TrustMark lodgement: reviews, installation oversight and the project file.",
    category: "COORDINATION",
    schemes: ["ECO4", "GBIS", "WHLG", "SHDF"],
    priceUnit: "PROPERTY",
    listPricePence: 45_000,
    siteVisit: "NONE",
    standardDays: null,
    fastTrackDays: null,
    standardLabel: "Runs to lodgement",
    fastTrackLabel: "Priority queue",
    image: "/images/services/facade-coordination.webp",
    gallery: ["/images/services/facade-coordination.webp", "/images/services/digital-coordination.webp", "/images/dashboard/project-modern.webp"],
    included: [
      "Coordinator appointment",
      "Risk pathway assignment",
      "Review of assessment and design",
      "MTIP review",
      "Pre-installation checks",
      "Communication between assessor, designer and installer",
      "Installation oversight",
      "Compliance records and project file",
      "Final TrustMark lodgement",
    ],
    keyAreas: ["Risk pathway", "Installation oversight", "TrustMark lodgement"],
    stages: [
      confirmed,
      { name: "Coordinator assigned", role: "COORDINATOR", column: "COORDINATION", sla: null, status: "IN_PROGRESS" },
      { name: "Assessment review and risk pathway", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Design review and MTIP", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Pre-installation checks", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Installation monitoring", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Post-installation verification", role: "COORDINATOR", column: "QA", sla: null, status: "IN_QA" },
      { name: "Handover pack and TrustMark lodgement", role: "COORDINATOR", column: "COORDINATION", sla: null, status: "DELIVERED" },
      { name: "Closed", role: "COORDINATOR", column: "DONE", sla: null, status: "COMPLETED" },
    ],
    questions: [
      { key: "plannedInstallDates", label: "Planned install dates", type: "TEXT", required: true },
      { key: "stepsoftAssessment", label: "Is StepSoft also providing the assessment?", type: "BOOLEAN", required: true, condition: notOrdered("RA") },
      { key: "stepsoftDesign", label: "Is StepSoft also providing the design?", type: "BOOLEAN", required: true, condition: notOrdered("RD") },
    ],
    documents: [
      { key: "assessmentReport", label: "Retrofit Assessment", required: true, condition: { all: [notOrdered("RA"), { key: "stepsoftAssessment", op: "neq", value: true }] } },
      { key: "designDocument", label: "Retrofit Design", required: true, condition: { all: [notOrdered("RD"), { key: "stepsoftDesign", op: "neq", value: true }] } },
      { key: "pas2030Certificate", label: "Installer's PAS 2030 certificate", required: true },
      { key: "productCertificates", label: "Product certificates and BBA certificates", required: true },
      { key: "installationPhotos", label: "Installation photos (uploaded during works)", required: true, timing: "DURING_WORK" },
      { key: "handoverDocuments", label: "Installer's handover documents and guarantees", required: true, timing: "DURING_WORK" },
    ],
    deliverables: [
      { name: "Risk pathway assessment", description: "Risk pathway assignment and rationale." },
      { name: "Pre-installation checks", description: "Signed pre-installation checklist." },
      { name: "Handover pack", description: "Compliance records, project file and handover pack.", kind: "REPORT" },
      { name: "TrustMark lodgement record", description: "Confirmation of lodgement with TrustMark.", versioned: false },
    ],
  },
  {
    code: "UV",
    slug: "u-value-calculation",
    title: "U-value Calculation",
    summary: "U-value per element to BS EN ISO 6946 (BS EN ISO 13370 for ground floors), for building control, Part L and SAP/RdSAP.",
    category: "CALCULATIONS",
    schemes: ["ECO4", "GBIS"],
    priceUnit: "ELEMENT",
    listPricePence: 4_500,
    siteVisit: "NONE",
    standardDays: 3,
    fastTrackDays: 0,
    image: "/images/services/thermal-model.webp",
    gallery: ["/images/services/thermal-model.webp", "/images/services/design-workstation.webp"],
    included: [
      "U-value report per element (wall, roof, floor, window)",
      "Method, layer build-up, material assumptions and result",
      "Calculated to BS EN ISO 6946 (BS EN ISO 13370 for ground floors)",
      "Suitable for building control, Part L and SAP/RdSAP",
    ],
    keyAreas: ["BS EN ISO 6946", "Part L", "SAP/RdSAP"],
    stages: [
      confirmed,
      { name: "Build-up details checked", role: "DESIGNER", column: "DESIGN", sla: 0, status: "IN_PROGRESS" },
      { name: "Calculation", role: "DESIGNER", column: "DESIGN", sla: 1, status: null },
      { name: "QA", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "DELIVERED" },
    ],
    questions: [
      { key: "elementTypes", label: "Type of elements", type: "MULTISELECT", required: true, options: opts(["WALL", "Wall"], ["ROOF", "Roof"], ["FLOOR", "Floor"], ["WINDOW", "Window"]) },
      { key: "existingConstruction", label: "Existing construction of each element (layers and thickness)", type: "TEXT", required: true },
      { key: "proposedInsulation", label: "Proposed insulation product and thickness", type: "TEXT", required: true },
      { key: "purpose", label: "Purpose", type: "SELECT", required: true, options: opts(["BUILDING_CONTROL", "Building control"], ["SAP", "SAP"], ["SCHEME_EVIDENCE", "Scheme evidence"]) },
    ],
    documents: [
      { key: "sectionDrawings", label: "Section drawings or build-up description per element", required: true },
      { key: "productDataSheets", label: "Product data sheets for insulation", required: true },
      { key: "photos", label: "Photos", required: false },
    ],
    deliverables: [{ name: "U-value report", description: "One calculation per element with build-up and result.", kind: "REPORT" }],
  },
  {
    code: "TB",
    slug: "thermal-bridging-calculations",
    title: "Thermal Bridging (ψ-value)",
    summary: "2D thermal model per junction to BS EN ISO 10211: ψ-values for SAP and an fRSI check against 0.75.",
    category: "CALCULATIONS",
    schemes: ["ECO4", "GBIS"],
    priceUnit: "JUNCTION",
    listPricePence: 7_500,
    siteVisit: "NONE",
    standardDays: 5,
    fastTrackDays: 2,
    image: "/images/services/blueprint-inspection.webp",
    gallery: ["/images/services/blueprint-inspection.webp", "/images/services/thermal-model.webp"],
    included: [
      "2D thermal model per junction to BS EN ISO 10211",
      "ψ-value for SAP (instead of the Appendix K defaults)",
      "fRSI check against the 0.75 minimum",
      "Report with recommended detailing",
    ],
    keyAreas: ["BS EN ISO 10211", "ψ-values for SAP", "fRSI ≥ 0.75"],
    stages: [
      confirmed,
      { name: "Junctions identified and details checked", role: "DESIGNER", column: "DESIGN", sla: 1, status: "IN_PROGRESS" },
      { name: "2D modelling", role: "DESIGNER", column: "DESIGN", sla: 2, status: null },
      { name: "Performance check (ψ and fRSI)", role: "DESIGNER", column: "DESIGN", sla: 1, status: null },
      { name: "QA", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 0, status: "DELIVERED" },
    ],
    questions: [
      {
        key: "junctionTypes",
        label: "Junction types",
        type: "MULTISELECT",
        required: true,
        options: opts(["WALL_FLOOR", "Wall–floor"], ["WALL_ROOF", "Wall–roof"], ["WINDOW_REVEAL", "Window reveal"], ["SILL", "Sill"], ["LINTEL", "Lintel"], ["EAVES", "Eaves"], ["PARTY_WALL", "Party wall"]),
      },
      { key: "measure", label: "Measure", type: "SELECT", required: true, options: opts(["EWI", "EWI"], ["IWI", "IWI"], ["RIR", "RIR"]) },
      { key: "proposedProduct", label: "Proposed product and thickness", type: "TEXT", required: true },
    ],
    documents: [
      { key: "junctionDrawings", label: "Junction detail drawings or sketches", required: true },
      { key: "buildUps", label: "Build-up per element", required: true },
      { key: "productDataSheets", label: "Product data sheets", required: true },
      { key: "junctionPhotos", label: "Photos of the existing junctions", required: true },
    ],
    deliverables: [{ name: "Thermal bridging report", description: "ψ-values, fRSI results and recommended detailing.", kind: "REPORT" }],
  },
  {
    code: "CR",
    slug: "condensation-risk-analysis",
    title: "Condensation Risk Analysis",
    summary: "Interstitial and surface condensation check to BS EN ISO 13788 (Glaser method) per element, with a pass/fail result.",
    category: "CALCULATIONS",
    schemes: ["ECO4", "GBIS"],
    priceUnit: "ELEMENT",
    listPricePence: 6_500,
    siteVisit: "NONE",
    standardDays: 3,
    fastTrackDays: 0,
    image: "/images/services/thermal-model.webp",
    gallery: ["/images/services/thermal-model.webp", "/images/services/blueprint-inspection.webp"],
    included: [
      "Interstitial and surface condensation check to BS EN ISO 13788 (Glaser method) per element",
      "Pass or fail result",
      "Recommendations: vapour control layer, more breathable insulation or ventilation changes",
      "Flag where a dynamic hygrothermal (WUFI) study is needed (quoted separately)",
    ],
    keyAreas: ["BS EN ISO 13788", "Pass / fail", "WUFI flag"],
    stages: [
      confirmed,
      { name: "Build-up checked", role: "DESIGNER", column: "DESIGN", sla: 0, status: "IN_PROGRESS" },
      { name: "Modelling", role: "DESIGNER", column: "DESIGN", sla: 1, status: null },
      { name: "Risk review", role: "DESIGNER", column: "DESIGN", sla: 0, status: null },
      { name: "QA", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "DELIVERED" },
    ],
    questions: [
      { key: "elementOrientation", label: "Element type and orientation", type: "TEXT", required: true },
      { key: "buildUp", label: "Existing and proposed build-up", type: "TEXT", required: true },
      { key: "internalConditions", label: "Internal conditions (humidity class or room use)", type: "TEXT", required: true },
      { key: "existingDamp", label: "Any existing damp or mould?", type: "BOOLEAN", required: true },
    ],
    documents: [
      { key: "buildUps", label: "Build-up per element", required: true },
      { key: "productDataSheets", label: "Product data sheets", required: true },
      { key: "dampPhotos", label: "Photos of existing damp or mould", required: true, condition: { key: "existingDamp", op: "eq", value: true } },
    ],
    deliverables: [{ name: "Condensation risk report", description: "Result per element with recommendations.", kind: "REPORT" }],
  },
  {
    code: "TS",
    slug: "technical-survey",
    title: "Technical Survey",
    summary: "On-site inspection of construction, fabric condition, defects and suitability for each measure; suited to non-standard construction.",
    category: "SURVEYS",
    schemes: ["ECO4", "GBIS", "WHLG", "SHDF"],
    priceUnit: "PROPERTY",
    listPricePence: 25_000,
    siteVisit: "REQUIRED",
    standardDays: 5,
    fastTrackDays: 2,
    image: "/images/services/onsite-survey.webp",
    gallery: ["/images/services/onsite-survey.webp", "/images/services/whole-house-facade.webp"],
    included: [
      "On-site inspection report",
      "Construction type and fabric condition",
      "Defects (damp, cracking, structure) and ventilation",
      "Suitability for each proposed measure and required pre-works",
      "Photo evidence, formatted for the PAS 2035 project file and scheme packs",
      "Suited to timber frame, BISF, Wimpey no-fines, solid stone and heritage",
    ],
    keyAreas: ["Non-standard construction", "Defects", "Pre-works"],
    stages: [
      confirmed,
      visitBooked,
      { name: "Site inspection", role: "ASSESSOR", column: "ASSESSMENT", sla: 0, status: "SCHEDULED" },
      { name: "Report drafted", role: "ASSESSOR", column: "ASSESSMENT", sla: 3, status: "IN_PROGRESS" },
      { name: "QA", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "DELIVERED" },
    ],
    questions: [
      { key: "surveyReason", label: "Reason for the survey", type: "SELECT", required: true, options: opts(["NON_STANDARD", "Non-standard construction"], ["PRE_PROGRAMME", "Pre-programme condition data"], ["ASSESSMENT_CONCERN", "Concern raised in the assessment"]) },
      { key: "constructionType", label: "Construction type (if known)", type: "TEXT" },
      { key: "listedOrConservation", label: "Is the property listed or in a conservation area?", type: "BOOLEAN", required: true },
    ],
    documents: [
      { key: "previousAssessment", label: "Previous Retrofit Assessment", required: false },
      { key: "earlierSurveys", label: "Earlier survey reports", required: false },
      { key: "ownerAccessPermission", label: "Access permission from the owner", required: true },
    ],
    deliverables: [{ name: "Technical survey report", description: "Inspection findings, suitability per measure and photo evidence.", kind: "REPORT" }],
  },
  {
    code: "ES",
    slug: "eco-submission-support",
    title: "ECO Submission Support",
    summary: "Review and completion of the ECO/GBIS submission pack: gap list and a corrected, submission-ready pack. Retrospective reviews too.",
    category: "FUNDING",
    schemes: ["ECO4", "GBIS"],
    priceUnit: "PACKAGE",
    listPricePence: 9_500,
    siteVisit: "NONE",
    standardDays: 3,
    fastTrackDays: 1,
    image: "/images/services/funding-documents.webp",
    gallery: ["/images/services/funding-documents.webp", "/images/services/digital-coordination.webp"],
    included: [
      "Review of assessment, design, SAP/RdSAP before and after, U-values, ventilation and condensation records",
      "Photos, installation certificates, TrustMark lodgement record and managing agent forms",
      "Gap list",
      "Corrected, submission-ready pack",
      "Option for a retrospective review of rejected jobs",
    ],
    keyAreas: ["Gap list", "Submission-ready pack", "Retrospective reviews"],
    stages: [
      confirmed,
      { name: "Documents uploaded", role: "COORDINATOR", column: "AWAITING_CLIENT", sla: null, status: null },
      { name: "Gap check", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "IN_PROGRESS" },
      { name: "Missing items requested from the customer", role: "COORDINATOR", column: "AWAITING_CLIENT", sla: null, status: null },
      { name: "Pack compiled and checked", role: "COORDINATOR", column: "QA", sla: 1, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: 1, status: "DELIVERED" },
      { name: "Resubmission support (if the funder rejects it)", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
    ],
    questions: [
      { key: "energySupplier", label: "Energy supplier or managing agent", type: "TEXT", required: true },
      { key: "submissionType", label: "New submission or retrospective review?", type: "SELECT", required: true, options: opts(["NEW", "New submission"], ["RETROSPECTIVE", "Retrospective review"]) },
      { key: "rejectionReason", label: "Rejection reason", type: "TEXT", required: true, condition: { key: "submissionType", op: "eq", value: "RETROSPECTIVE" } },
      { key: "completionDate", label: "Installation completion date", type: "DATE", required: true },
    ],
    documents: [
      { key: "assessmentReport", label: "Retrofit Assessment", required: true },
      { key: "designDocument", label: "Retrofit Design", required: true },
      { key: "sapBeforeAfter", label: "Pre and post SAP/RdSAP", required: true },
      { key: "installationCertificates", label: "Installation certificates and guarantees", required: true },
      { key: "photos", label: "Before, during and after photos", required: true },
      { key: "trustmarkCertificate", label: "TrustMark lodgement certificate", required: true },
      { key: "managingAgentForms", label: "Managing agent forms", required: true },
      { key: "rejectionNotice", label: "Rejection notice", required: true, condition: { key: "submissionType", op: "eq", value: "RETROSPECTIVE" } },
    ],
    deliverables: [
      { name: "Gap list", description: "What is missing or wrong in the pack.", versioned: false },
      { name: "Submission-ready pack", description: "Corrected pack ready for the funder.", kind: "REPORT" },
    ],
  },
  {
    code: "OA",
    slug: "on-site-audit-support",
    title: "On-Site Audit Support",
    summary: "Inspection of installed measures against the design, PAS 2035 and manufacturer guidance, with a non-conformance list and fixes.",
    category: "COMPLIANCE",
    schemes: ["ECO4", "GBIS", "WHLG", "SHDF"],
    priceUnit: "VISIT",
    listPricePence: 19_500,
    siteVisit: "REQUIRED",
    standardDays: 2,
    fastTrackDays: 1,
    standardLabel: "Report 2 days after visit",
    fastTrackLabel: "Report next day",
    image: "/images/services/onsite-survey.webp",
    gallery: ["/images/services/onsite-survey.webp", "/images/services/solar-roof.webp"],
    included: [
      "Site inspection of installed measures against the design, PAS 2035 and manufacturer guidance",
      "Workmanship, insulation coverage and thickness, junctions, ventilation, fixings, substrate",
      "Photo evidence",
      "Non-conformance list with fixes",
      "Report for TrustMark and the ECO file",
      "Two visits recommended: mid-installation and post-installation",
    ],
    keyAreas: ["Workmanship", "Non-conformances", "TrustMark / ECO file"],
    stages: [
      confirmed,
      visitBooked,
      { name: "Inspection", role: "ASSESSOR", column: "ASSESSMENT", sla: 0, status: "SCHEDULED" },
      { name: "Findings report", role: "ASSESSOR", column: "ASSESSMENT", sla: 2, status: "IN_PROGRESS" },
      { name: "Fixes uploaded by the installer", role: "COORDINATOR", column: "AWAITING_CLIENT", sla: null, status: null },
      { name: "Close-out", role: "COORDINATOR", column: "QA", sla: null, status: "IN_QA" },
      { name: "Delivered", role: "COORDINATOR", column: "COORDINATION", sla: null, status: "DELIVERED" },
    ],
    questions: [
      { key: "visitStage", label: "Visit stage", type: "SELECT", required: true, options: opts(["MID", "Mid-installation"], ["POST", "Post-installation"]) },
      { key: "installerSiteContact", label: "Installer site contact", type: "TEXT", required: true },
      { key: "followsFailure", label: "Does this follow a failed audit or a non-conformance notice?", type: "BOOLEAN", required: true },
    ],
    documents: [
      { key: "designDocument", label: "Retrofit Design", required: true, condition: notOrdered("RD") },
      { key: "methodStatement", label: "Installation method statement", required: true },
      { key: "productCertificates", label: "Product certificates", required: true },
      { key: "nonConformanceNotice", label: "Non-conformance notice", required: true, condition: { key: "followsFailure", op: "eq", value: true } },
    ],
    deliverables: [
      { name: "Audit report", description: "Findings for TrustMark and the ECO file.", kind: "REPORT" },
      { name: "Non-conformance list", description: "Each issue with the required fix.", kind: "SPREADSHEET" },
    ],
  },
  {
    code: "TM",
    slug: "technical-monitoring",
    title: "Technical Monitoring",
    summary: "Independent technical monitoring: design review, mid and post-installation visits, non-conformance log and report. Quidos Protect approved.",
    category: "COMPLIANCE",
    schemes: ["ECO4", "GBIS", "WHLG", "SHDF"],
    priceUnit: "VISIT",
    listPricePence: 19_500,
    siteVisit: "REQUIRED",
    standardDays: 2,
    fastTrackDays: 1,
    standardLabel: "Report 2 days after visit",
    fastTrackLabel: "Report next day",
    image: "/images/services/solar-roof.webp",
    gallery: ["/images/services/solar-roof.webp", "/images/services/facade-coordination.webp"],
    included: [
      "Independent technical monitoring, appointed separately from the installer",
      "Pre-installation design review",
      "Mid and post-installation visits",
      "Photo evidence review",
      "Non-conformance log",
      "Technical Monitoring report for the project file",
      "StepSoft is an approved provider with Quidos Protect",
    ],
    keyAreas: ["Independent", "Mid & post visits", "Quidos Protect"],
    stages: [
      confirmed,
      { name: "Design review", role: "ASSESSOR", column: "ASSESSMENT", sla: null, status: null },
      { name: "Mid-installation visit", role: "ASSESSOR", column: "ASSESSMENT", sla: 0, status: "SCHEDULED" },
      { name: "Post-installation visit", role: "ASSESSOR", column: "ASSESSMENT", sla: null, status: "IN_PROGRESS" },
      { name: "Non-conformances resolved", role: "COORDINATOR", column: "QA", sla: null, status: "IN_QA" },
      { name: "Report delivered", role: "COORDINATOR", column: "COORDINATION", sla: 2, status: "DELIVERED" },
    ],
    questions: [
      { key: "appointedBy", label: "Who is appointing?", type: "SELECT", required: true, options: opts(["COORDINATOR", "Retrofit coordinator"], ["MANAGING_AGENT", "Managing agent"], ["CLIENT", "Client"]) },
      { key: "riskPathway", label: "Risk pathway", type: "SELECT", required: true, options: opts(["A", "A"], ["B", "B"], ["C", "C"]) },
      { key: "installationDates", label: "Installation dates", type: "TEXT", required: true },
    ],
    documents: [
      { key: "designDocument", label: "Retrofit Design", required: true, condition: notOrdered("RD") },
      { key: "installationProgramme", label: "Installation programme", required: true },
      { key: "pas2030Certificate", label: "Installer's PAS 2030 certificate", required: true },
      { key: "installationPhotos", label: "Installation photos", required: true, timing: "DURING_WORK" },
    ],
    deliverables: [
      { name: "Technical Monitoring report", description: "Report for the project file.", kind: "REPORT" },
      { name: "Non-conformance log", description: "Issues found and how they were resolved.", kind: "SPREADSHEET" },
    ],
  },
  {
    code: "TA",
    slug: "trustmark-audit-support",
    title: "TrustMark Audit Support",
    summary: "Pre-audit review of your QMS and project files, gap analysis, audit coaching, support on the day and post-audit remediation.",
    category: "COMPLIANCE",
    schemes: [],
    priceUnit: "PACKAGE",
    listPricePence: 69_500,
    siteVisit: "OPTIONAL",
    standardDays: null,
    fastTrackDays: null,
    standardLabel: "Agreed per audit (4–6 weeks' notice advised)",
    fastTrackLabel: "Priority booking",
    requiresProperty: false,
    image: "/images/services/digital-coordination.webp",
    gallery: ["/images/services/digital-coordination.webp", "/images/services/funding-documents.webp"],
    included: [
      "Pre-audit review of quality management system, project files and evidence packs",
      "Compliance gap analysis",
      "Preparation of missing technical evidence",
      "Audit coaching",
      "Support on the day",
      "Post-audit remediation: root cause, corrective actions, formal response to TrustMark",
    ],
    keyAreas: ["QMS review", "Gap analysis", "Remediation"],
    stages: [
      confirmed,
      { name: "Discovery call", role: "COORDINATOR", column: "COORDINATION", sla: null, status: "IN_PROGRESS" },
      { name: "Document review", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Gap report", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Remediation", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Audit day", role: "COORDINATOR", column: "COORDINATION", sla: null, status: null },
      { name: "Post-audit response", role: "COORDINATOR", column: "QA", sla: null, status: "DELIVERED" },
      { name: "Closed", role: "COORDINATOR", column: "DONE", sla: null, status: "COMPLETED" },
    ],
    questions: [
      { key: "auditDate", label: "Audit date", type: "DATE", required: true },
      { key: "auditType", label: "Audit type", type: "SELECT", required: true, options: opts(["SCHEDULED", "Scheduled"], ["SPOT", "Spot"], ["FOLLOW_UP", "Follow-up"]) },
      { key: "projectsInScope", label: "Number of projects in scope", type: "NUMBER", required: true },
      { key: "licenceNumber", label: "Your TrustMark licence number", type: "TEXT", required: true },
      { key: "nonConformanceReceived", label: "Have you received a non-conformance notice?", type: "BOOLEAN", required: true },
    ],
    documents: [
      { key: "qmsDocuments", label: "Quality management system documents", required: true },
      { key: "projectsList", label: "List of projects in scope", required: true },
      { key: "sampleProjectFiles", label: "Sample project files", required: true },
      { key: "nonConformanceNotices", label: "Non-conformance notices", required: true, condition: { key: "nonConformanceReceived", op: "eq", value: true } },
    ],
    deliverables: [
      { name: "Compliance gap analysis", description: "Gaps against TrustMark requirements.", kind: "REPORT" },
      { name: "Post-audit response", description: "Root cause, corrective actions and formal response.", kind: "REPORT" },
    ],
  },
];

/** Add-ons (all configurable). Express is Basic-only (partners get fast-track anyway). */
export function addonsFor(service: SeedService) {
  const addons: Array<{ key: string; name: string; description: string; kind: "PERCENT_OF_LIST" | "PER_UNIT" | "PER_MILE" | "FIXED"; amount: number; freeAllowance?: number; audience: "ALL" | "BASIC" | "PARTNER"; fastTrack?: boolean; icon: string }> = [];
  if (service.fastTrackDays !== null) {
    addons.push({ key: "express", name: "Express delivery", description: "Partner turnaround for this order (+30% of the list price).", kind: "PERCENT_OF_LIST", amount: 3_000, audience: "BASIC", fastTrack: true, icon: "express" });
  }
  if (service.siteVisit !== "NONE") {
    addons.push({ key: "extra-visit", name: "Additional site visit", description: "Another visit to the property.", kind: "PER_UNIT", amount: 15_000, audience: "ALL", icon: "review" });
    addons.push({ key: "travel", name: "Travel outside the core area", description: "45p per mile beyond 30 miles.", kind: "PER_MILE", amount: 45, freeAllowance: 30, audience: "ALL", icon: "filing" });
  }
  return addons;
}

export const BUNDLES = [
  {
    code: "RA-RD-RC",
    slug: "assessment-design-coordination",
    name: "Assessment + Design + Coordination",
    description: "The full PAS 2035 route for one property at a bundle price.",
    pricePence: 85_000,
    services: ["RA", "RD", "RC"],
  },
];

/** England & Wales bank holidays (gov.uk). Admin-editable at /api/admin/bank-holidays. */
export const BANK_HOLIDAYS = [
  ["2026-01-01", "New Year’s Day"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-06", "Easter Monday"],
  ["2026-05-04", "Early May bank holiday"],
  ["2026-05-25", "Spring bank holiday"],
  ["2026-08-31", "Summer bank holiday"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-28", "Boxing Day (substitute day)"],
  ["2027-01-01", "New Year’s Day"],
  ["2027-03-26", "Good Friday"],
  ["2027-03-29", "Easter Monday"],
  ["2027-05-03", "Early May bank holiday"],
  ["2027-05-31", "Spring bank holiday"],
  ["2027-08-30", "Summer bank holiday"],
  ["2027-12-27", "Christmas Day (substitute day)"],
  ["2027-12-28", "Boxing Day (substitute day)"],
] as const;

export const COMPLIANCE_CARDS = [
  { title: "PAS 2035:2023 aligned", description: "Every stage follows the PAS 2035 whole-house retrofit specification.", icon: "badge" },
  { title: "Qualified professionals", description: "Work is carried out by accredited assessors, designers and coordinators.", icon: "shield" },
  { title: "Audit ready", description: "Documentation prepared for TrustMark audits and funder inspections.", icon: "audit" },
  { title: "TrustMark evidence", description: "Outputs are formatted for the project file and TrustMark lodgement.", icon: "file" },
];
