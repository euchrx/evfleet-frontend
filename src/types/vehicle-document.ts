export type VehicleDocumentType =
  | "LICENSING"
  | "INSURANCE"
  | "IPVA"
  | "LEASING_CONTRACT"
  | "INSPECTION"
  | "CNH"
  | "EAR"
  | "MOPP"
  | "TOXICOLOGICAL_EXAM"
  | "EMPLOYMENT_RECORD"
  | "RG"
  | "CPF_DOCUMENT"
  | "DEFENSIVE_DRIVING"
  | "TRUCAO_TRANSPORTE"
  | "CRLV"
  | "CIV"
  | "CIPP"
  | "ENVIRONMENTAL_AUTHORIZATION"
  | "RNTRC"
  | "OTHER";

export type VehicleDocumentOwnerType = "VEHICLE" | "DRIVER" | "GENERAL";
export type VehicleDocumentStatus = "VALID" | "EXPIRING" | "EXPIRED";

export type VehicleDocument = {
  id: string;
  type: VehicleDocumentType;
  ownerType: VehicleDocumentOwnerType;
  name: string;
  number?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  status: VehicleDocumentStatus;
  issuer?: string | null;
  notes?: string | null;
  fileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: {
    id: string;
    name: string;
  } | null;
  vehicleId?: string | null;
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
  } | null;
  driverId?: string | null;
  driver?: {
    id: string;
    name: string;
    cnh: string;
    cnhCategory: string;
    vehicleId?: string | null;
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
    } | null;
  } | null;
};
