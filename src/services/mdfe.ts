import { api } from "./api";

export type MdfeStatus =
  | "DRAFT"
  | "PROCESSING"
  | "AUTHORIZED"
  | "REJECTED"
  | "CANCELED"
  | "CLOSED"
  | "ERROR";

export type MdfeRecord = {
  id: string;
  companyId: string;
  tripId: string;
  environment: "HOMOLOGATION" | "PRODUCTION";
  status: MdfeStatus;
  accessKey?: string | null;
  protocol?: string | null;
  series: number;
  number: number;
  rejectionCode?: string | null;
  rejectionReason?: string | null;
  issuedAt?: string | null;
  closedAt?: string | null;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MdfeProviderResult = {
  status:
  | "AUTHORIZED"
  | "REJECTED"
  | "PROCESSING"
  | "ERROR"
  | "CANCELED"
  | "CLOSED";
  accessKey?: string;
  protocol?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  rawResponse?: unknown;
};

export async function getTripMdfe(tripId: string) {
  const { data } = await api.get<MdfeRecord>(`/trips/${tripId}/mdfe`);
  return data;
}

export async function consultTripMdfe(tripId: string) {
  const { data } = await api.post<MdfeProviderResult>(
    `/trips/${tripId}/mdfe/consult`,
  );
  return data;
}

export async function closeTripMdfe(tripId: string) {
  const { data } = await api.post<MdfeProviderResult>(
    `/trips/${tripId}/mdfe/close`,
  );
  return data;
}

export async function cancelTripMdfe(tripId: string, reason: string) {
  const { data } = await api.post<MdfeProviderResult>(
    `/trips/${tripId}/mdfe/cancel`,
    { reason },
  );
  return data;
}

async function downloadFile(url: string, fileName: string) {
  const { data } = await api.get<Blob>(url, {
    responseType: "blob",
  });

  const blobUrl = window.URL.createObjectURL(data);
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function downloadTripMdfeXml(tripId: string) {
  await downloadFile(`/trips/${tripId}/mdfe/xml`, `mdfe-${tripId}.xml`);
}

export async function downloadTripDamdfe(tripId: string) {
  await downloadFile(`/trips/${tripId}/mdfe/damdfe`, `damdfe-${tripId}.pdf`);
}

export async function generateTripMdfe(tripId: string) {
  const { data } = await api.post<MdfeProviderResult>(
    `/trips/${tripId}/mdfe`,
  );
  return data;
}