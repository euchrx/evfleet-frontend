export type TripStatus =
  | "DRAFT"
  | "PENDING_COMPLIANCE"
  | "BLOCKED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type ComplianceStatus = "APPROVED" | "BLOCKED" | "WARNING";

export type ComplianceSeverity = "INFO" | "WARNING" | "BLOCKING";

export type GeneratedDocumentType =
  | "EMERGENCY_SHEET"
  | "FISPQ"
  | "MDFE_MOCK"
  | "CHECKLIST";

export type GeneratedDocumentStatus =
  | "DRAFT"
  | "GENERATED"
  | "SENT"
  | "CANCELLED"
  | "ERROR";

export type TripComplianceResult = {
  id: string;
  ruleCode: string;
  title: string;
  message: string;
  severity: ComplianceSeverity;
  passed: boolean;
  metadata?: unknown;
  createdAt: string;
};

export type TripComplianceCheck = {
  id: string;
  tripId: string;
  status: ComplianceStatus;
  checkedAt: string;
  checkedByUserId?: string | null;
  summary?: string | null;
  results?: TripComplianceResult[];
};

export type TripGeneratedDocument = {
  id: string;
  tripId: string;
  type: GeneratedDocumentType;
  status: GeneratedDocumentStatus;
  templateCode?: string | null;
  fileUrl?: string | null;
  payload?: unknown;
  generatedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TripProduct = {
  id: string;
  tripId: string;
  dangerousProductId: string;
  quantity: string | number;
  unit: string;
  tankCompartment?: string | null;
  invoiceKey?: string | null;
  invoiceNumber?: string | null;
  createdAt: string;
  dangerousProduct?: {
    id: string;
    name: string;
    commercialName?: string | null;
    unNumber: string;
    riskClass: string;
    packingGroup?: string | null;
    hazardNumber?: string | null;
    emergencyNumber?: string | null;
    physicalState?: string | null;
    fispqUrl?: string | null;
    active: boolean;
  };
};

export type Trip = {
  id: string;
  origin: string;
  destination: string;
  reason?: string | null;
  departureKm: number;
  returnKm?: number | null;
  departureAt: string;
  returnAt?: string | null;
  status: TripStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;

  companyId?: string | null;
  branchId?: string | null;

  vehicleId: string;
  driverId?: string | null;

  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
    branchId?: string | null;
    branch?: {
      id: string;
      name: string;
    } | null;
  };

  driver?: {
    id: string;
    name: string;
    status: string;
  } | null;

  products?: TripProduct[];
  complianceChecks?: TripComplianceCheck[];
  generatedDocuments?: TripGeneratedDocument[];
};