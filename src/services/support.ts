import { api } from "./api";

export type SupportRequestCategory = "BUG" | "IMPROVEMENT" | "REQUEST";
export type SupportRequestStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";

export type SupportRequest = {
  id: string;
  title: string;
  description: string;
  category: SupportRequestCategory;
  status: SupportRequestStatus;
  responseMessage?: string | null;
  estimatedCompletionAt?: string | null;
  respondedAt?: string | null;
  completionMessage?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
  };
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  respondedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  completedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type CreateSupportRequestInput = {
  title: string;
  description: string;
  category: SupportRequestCategory;
};

export type RespondSupportRequestInput = {
  responseMessage: string;
  estimatedCompletionAt?: string;
};

export type CompleteSupportRequestInput = {
  completionMessage?: string;
};

export async function getSupportRequests() {
  const response = await api.get<SupportRequest[]>("/support/requests");
  return Array.isArray(response.data) ? response.data : [];
}

export async function createSupportRequest(input: CreateSupportRequestInput) {
  const response = await api.post("/support/requests", input);
  return response.data;
}

export async function respondSupportRequest(
  requestId: string,
  input: RespondSupportRequestInput,
) {
  const response = await api.patch(`/support/requests/${requestId}/respond`, input);
  return response.data;
}

export async function completeSupportRequest(
  requestId: string,
  input: CompleteSupportRequestInput,
) {
  const response = await api.patch(`/support/requests/${requestId}/complete`, input);
  return response.data;
}

export async function deleteSupportRequest(requestId: string) {
  const response = await api.delete(`/support/requests/${requestId}`);
  return response.data;
}
