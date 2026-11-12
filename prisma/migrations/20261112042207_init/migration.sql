-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ASSESSOR', 'DESIGNER', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('HOMEOWNER', 'LANDLORD', 'INSTALLER', 'MANAGING_AGENT', 'HOUSING_ASSOCIATION', 'LOCAL_AUTHORITY', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('BASIC', 'PARTNER');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('APPLIED', 'OFFERED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('ADVANCE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('ASSESSMENT', 'DESIGN', 'COORDINATION', 'CALCULATIONS', 'SURVEYS', 'FUNDING', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "Scheme" AS ENUM ('ECO4', 'GBIS', 'WHLG', 'SHDF', 'PRIVATE', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PROPERTY', 'ELEMENT', 'JUNCTION', 'VISIT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "SiteVisit" AS ENUM ('NONE', 'REQUIRED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "StageRole" AS ENUM ('ASSESSOR', 'DESIGNER', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AddonKind" AS ENUM ('PERCENT_OF_LIST', 'PER_UNIT', 'PER_MILE', 'FIXED');

-- CreateEnum
CREATE TYPE "AddonAudience" AS ENUM ('ALL', 'BASIC', 'PARTNER');

-- CreateEnum
CREATE TYPE "IntakeFieldType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'DATE', 'FILE', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "IntakeScope" AS ENUM ('ORDER', 'LINE');

-- CreateEnum
CREATE TYPE "DocumentTiming" AS ENUM ('BEFORE_START', 'DURING_WORK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CREDIT', 'CREDIT_AND_CARD', 'WEEKLY_INVOICE');

-- CreateEnum
CREATE TYPE "DiscountSource" AS ENUM ('NONE', 'CODE', 'PARTNER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('AWAITING_PAYMENT', 'AWAITING_INFO', 'SCHEDULED', 'IN_PROGRESS', 'IN_QA', 'DELIVERED', 'REVISION', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'DELAYED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'QA_REJECT');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('DONE', 'CURRENT', 'UPCOMING');

-- CreateEnum
CREATE TYPE "TaskColumn" AS ENUM ('BACKLOG', 'AWAITING_CLIENT', 'ASSESSMENT', 'DESIGN', 'COORDINATION', 'QA', 'DONE');

-- CreateEnum
CREATE TYPE "VisitWindow" AS ENUM ('AM', 'PM');

-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('INITIAL', 'ADDITIONAL', 'MID_INSTALL', 'POST_INSTALL');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('BOOKED', 'COMPLETED', 'NO_ACCESS', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "DeliverableKind" AS ENUM ('PDF', 'SPREADSHEET', 'REPORT');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "DeliverableVersionLabel" AS ENUM ('INITIAL', 'REVISED', 'FINAL');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ORDER', 'WEEKLY', 'SUBSCRIPTION', 'CREDIT_TOPUP', 'CHARGE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "CreditEntryType" AS ENUM ('TOPUP', 'DEDUCTION', 'REFUND', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "companyName" TEXT,
    "customerType" "CustomerType",
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "canViewAllProjects" BOOLEAN NOT NULL DEFAULT false,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "canViewAllProjects" BOOLEAN NOT NULL DEFAULT false,
    "projectIds" TEXT[],
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyNumber" TEXT,
    "vatNumber" TEXT,
    "trustmarkLicence" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'APPLIED',
    "discountBps" INTEGER NOT NULL DEFAULT 1000,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'ADVANCE',
    "creditLimitPence" INTEGER,
    "applicationNote" TEXT,
    "adminNotes" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionRenewsAt" TIMESTAMP(3),
    "agreementVersion" TEXT,
    "agreementSignedAt" TIMESTAMP(3),
    "agreementSignedName" TEXT,
    "agreementSignedIp" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerServiceDiscount" (
    "partnerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "discountBps" INTEGER NOT NULL,

    CONSTRAINT "PartnerServiceDiscount_pkey" PRIMARY KEY ("partnerId","serviceId")
);

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditEntryType" NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "balanceAfterPence" INTEGER NOT NULL,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "note" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountHold" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "invoiceId" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "liftReason" TEXT,

    CONSTRAINT "AccountHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT,
    "uprn" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "propertyType" TEXT NOT NULL,
    "builtForm" TEXT,
    "buildYear" INTEGER,
    "storeys" INTEGER,
    "bedrooms" INTEGER,
    "tenure" TEXT,
    "occupantName" TEXT,
    "occupantPhone" TEXT,
    "accessNotes" TEXT,
    "epcNumber" TEXT,
    "epcCertificateKey" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "badge" TEXT NOT NULL DEFAULT 'PAS 2035',
    "schemes" "Scheme"[],
    "priceUnit" "PriceUnit" NOT NULL DEFAULT 'PROPERTY',
    "listPricePence" INTEGER NOT NULL,
    "siteVisit" "SiteVisit" NOT NULL DEFAULT 'NONE',
    "standardDays" INTEGER,
    "fastTrackDays" INTEGER,
    "standardLabel" TEXT,
    "fastTrackLabel" TEXT,
    "revisionRounds" INTEGER NOT NULL DEFAULT 2,
    "discountable" BOOLEAN NOT NULL DEFAULT true,
    "requiresProperty" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT NOT NULL,
    "gallery" TEXT[],
    "overview" JSONB NOT NULL,
    "included" TEXT[],
    "compliance" JSONB NOT NULL,
    "deliverablesInfo" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStage" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "defaultRole" "StageRole" NOT NULL DEFAULT 'COORDINATOR',
    "slaDays" INTEGER,
    "boardColumn" "TaskColumn" NOT NULL DEFAULT 'BACKLOG',
    "projectStatus" "ProjectStatus",

    CONSTRAINT "ServiceStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDocumentRequirement" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "condition" JSONB,
    "timing" "DocumentTiming" NOT NULL DEFAULT 'BEFORE_START',
    "acceptedTypes" TEXT[],
    "maxBytes" INTEGER NOT NULL DEFAULT 26214400,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDeliverable" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "DeliverableKind" NOT NULL DEFAULT 'PDF',
    "versioned" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeQuestion" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "help" TEXT,
    "type" "IntakeFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "condition" JSONB,
    "scope" "IntakeScope" NOT NULL DEFAULT 'LINE',
    "step" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IntakeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAddon" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "AddonKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "freeAllowance" INTEGER NOT NULL DEFAULT 0,
    "audience" "AddonAudience" NOT NULL DEFAULT 'ALL',
    "fastTrack" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT NOT NULL DEFAULT 'express',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pricePence" INTEGER NOT NULL,
    "discountable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "bundleId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("bundleId","serviceId")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "regionPrefix" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "window" "VisitWindow" NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "availabilityId" TEXT,
    "assessorId" TEXT,
    "date" DATE NOT NULL,
    "window" "VisitWindow" NOT NULL,
    "kind" "VisitKind" NOT NULL DEFAULT 'INITIAL',
    "status" "VisitStatus" NOT NULL DEFAULT 'BOOKED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankHoliday" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BankHoliday_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerTier" "CustomerTier" NOT NULL DEFAULT 'BASIC',
    "paymentMethod" "PaymentMethod",
    "bundleId" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "shareDataConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentIp" TEXT,
    "listPence" INTEGER NOT NULL,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "discountSource" "DiscountSource" NOT NULL DEFAULT 'NONE',
    "addonsPence" INTEGER NOT NULL DEFAULT 0,
    "netPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "creditAppliedPence" INTEGER NOT NULL DEFAULT 0,
    "discountCodeId" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "propertyId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "serviceCode" TEXT NOT NULL,
    "serviceTitle" TEXT NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL,
    "unitPricePence" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "listPence" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "addonsPence" INTEGER NOT NULL DEFAULT 0,
    "netPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "fastTrack" BOOLEAN NOT NULL DEFAULT false,
    "turnaroundDays" INTEGER,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "availabilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineAddon" (
    "lineId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AddonKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPence" INTEGER NOT NULL,

    CONSTRAINT "OrderLineAddon_pkey" PRIMARY KEY ("lineId","addonId")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "description" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "subtotalPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "vatRateBps" INTEGER NOT NULL DEFAULT 2000,
    "seller" JSONB,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidVia" TEXT,
    "paidNote" TEXT,
    "remindersSent" TEXT[],
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSessionId" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderLineId" TEXT,
    "description" TEXT NOT NULL,
    "listPence" INTEGER NOT NULL DEFAULT 0,
    "discountPence" INTEGER NOT NULL DEFAULT 0,
    "netPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT,
    "orderLineId" TEXT,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "propertyId" TEXT,
    "coordinatorId" TEXT,
    "title" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'AWAITING_INFO',
    "statusBeforeHold" "ProjectStatus",
    "health" "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "partnerPriority" BOOLEAN NOT NULL DEFAULT false,
    "phaseDescription" TEXT,
    "phaseNotice" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "fastTrack" BOOLEAN NOT NULL DEFAULT false,
    "turnaroundDays" INTEGER,
    "intakeCompleteAt" TIMESTAMP(3),
    "clockStartAt" TIMESTAMP(3),
    "clockRestartAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "revisionRoundsIncluded" INTEGER NOT NULL DEFAULT 2,
    "revisionRoundsUsed" INTEGER NOT NULL DEFAULT 0,
    "compliancePercent" INTEGER NOT NULL DEFAULT 100,
    "fundingSecuredPence" INTEGER NOT NULL DEFAULT 0,
    "scheme" "Scheme",
    "hasIssues" BOOLEAN NOT NULL DEFAULT false,
    "criticalIssue" BOOLEAN NOT NULL DEFAULT false,
    "issueSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workStartedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationFeePence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "defaultRole" "StageRole" NOT NULL DEFAULT 'COORDINATOR',
    "projectStatus" "ProjectStatus",
    "status" "MilestoneStatus" NOT NULL DEFAULT 'UPCOMING',
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "column" "TaskColumn" NOT NULL DEFAULT 'BACKLOG',
    "position" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "milestoneId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "requirementKey" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceDeliverableId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "DeliverableKind" NOT NULL DEFAULT 'PDF',
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "versioned" BOOLEAN NOT NULL DEFAULT true,
    "currentLabel" "DeliverableVersionLabel",
    "documentId" TEXT,
    "estimatedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverableVersion" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" "DeliverableVersionLabel" NOT NULL,
    "documentId" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "pricePence" INTEGER,
    "status" "RevisionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_stripeSubscriptionId_key" ON "PartnerProfile"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "PartnerProfile_status_idx" ON "PartnerProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_stripePaymentIntentId_key" ON "CreditEntry"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "CreditEntry_userId_createdAt_idx" ON "CreditEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountHold_userId_liftedAt_idx" ON "AccountHold"("userId", "liftedAt");

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

-- CreateIndex
CREATE INDEX "Property_postcode_idx" ON "Property"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_active_category_idx" ON "Service"("active", "category");

-- CreateIndex
CREATE INDEX "ServiceStage_serviceId_position_idx" ON "ServiceStage"("serviceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDocumentRequirement_serviceId_key_key" ON "ServiceDocumentRequirement"("serviceId", "key");

-- CreateIndex
CREATE INDEX "IntakeQuestion_serviceId_position_idx" ON "IntakeQuestion"("serviceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAddon_serviceId_key_key" ON "ServiceAddon"("serviceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_code_key" ON "Bundle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_slug_key" ON "Bundle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "Availability_regionPrefix_date_idx" ON "Availability"("regionPrefix", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_assessorId_date_window_key" ON "Availability"("assessorId", "date", "window");

-- CreateIndex
CREATE INDEX "Visit_projectId_idx" ON "Visit"("projectId");

-- CreateIndex
CREATE INDEX "Visit_date_idx" ON "Visit"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_status_confirmedAt_idx" ON "Order"("status", "confirmedAt");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeSessionId_key" ON "Invoice"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Invoice_userId_issuedAt_idx" ON "Invoice"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_status_dueAt_idx" ON "Invoice"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Invoice_kind_periodEnd_idx" ON "Invoice"("kind", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_orderLineId_key" ON "InvoiceLine"("orderLineId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_reference_key" ON "Project"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Project_orderLineId_key" ON "Project"("orderLineId");

-- CreateIndex
CREATE INDEX "Project_clientId_status_idx" ON "Project"("clientId", "status");

-- CreateIndex
CREATE INDEX "Project_coordinatorId_idx" ON "Project"("coordinatorId");

-- CreateIndex
CREATE INDEX "Project_status_health_idx" ON "Project"("status", "health");

-- CreateIndex
CREATE INDEX "Project_dueDate_idx" ON "Project"("dueDate");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMilestone_projectId_position_key" ON "ProjectMilestone"("projectId", "position");

-- CreateIndex
CREATE INDEX "Task_projectId_column_position_idx" ON "Task"("projectId", "column", "position");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_projectId_fileName_idx" ON "Document"("projectId", "fileName");

-- CreateIndex
CREATE INDEX "Document_projectId_requirementKey_idx" ON "Document"("projectId", "requirementKey");

-- CreateIndex
CREATE INDEX "Message_projectId_createdAt_idx" ON "Message"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Deliverable_projectId_idx" ON "Deliverable"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverableVersion_deliverableId_number_key" ON "DeliverableVersion"("deliverableId", "number");

-- CreateIndex
CREATE INDEX "RevisionRequest_projectId_idx" ON "RevisionRequest"("projectId");

-- CreateIndex
CREATE INDEX "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerServiceDiscount" ADD CONSTRAINT "PartnerServiceDiscount_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerServiceDiscount" ADD CONSTRAINT "PartnerServiceDiscount_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStage" ADD CONSTRAINT "ServiceStage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDocumentRequirement" ADD CONSTRAINT "ServiceDocumentRequirement_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDeliverable" ADD CONSTRAINT "ServiceDeliverable_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeQuestion" ADD CONSTRAINT "IntakeQuestion_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineAddon" ADD CONSTRAINT "OrderLineAddon_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineAddon" ADD CONSTRAINT "OrderLineAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ServiceStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_serviceDeliverableId_fkey" FOREIGN KEY ("serviceDeliverableId") REFERENCES "ServiceDeliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableVersion" ADD CONSTRAINT "DeliverableVersion_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableVersion" ADD CONSTRAINT "DeliverableVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
