export type Company = {
  id: string;
  name: string;
  document?: string | null;
  slug?: string | null;
  active: boolean;
  createdAt: string;
};

export type CompanyDeletionSummary = {
  company: number;
  branches: number;
  users: number;
  subscriptions: number;
  payments: number;
  webhookEvents: number;
  vehicles: number;
  vehicleProfilePhotos: number;
  vehicleChangeLogs: number;
  drivers: number;
  maintenanceRecords: number;
  maintenancePlans: number;
  debts: number;
  fuelRecords: number;
  trips: number;
  vehicleDocuments: number;
  tires: number;
  tireReadings: number;
  xmlImportBatches: number;
  xmlInvoices: number;
  xmlInvoiceItems: number;
  retailProductImports: number;
  retailProductImportItems: number;
};

export type CompanyDeleteWithBackupInput = {
  password: string;
  confirmationText: string;
};

export type CompanyDeleteWithBackupResult = {
  company: {
    id: string;
    name: string;
  };
  backup: {
    fileName: string;
    filePath: string;
    generatedAt: string;
  };
  deleted: CompanyDeletionSummary;
};
