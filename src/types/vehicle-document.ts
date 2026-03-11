export type VehicleDocumentType =
  | "LICENSING"
  | "INSURANCE"
  | "IPVA"
  | "LEASING_CONTRACT"
  | "INSPECTION"
  | "OTHER";

export type VehicleDocumentStatus = "VALID" | "EXPIRING" | "EXPIRED";

export type VehicleDocument = {
  id: string;
  type: VehicleDocumentType;
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
  vehicleId: string;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
    branchId: string;
    branch: {
      id: string;
      name: string;
    };
  };
};
