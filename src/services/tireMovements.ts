import { api } from './api';

export type TireMovementType = 'MOVE' | 'ROTATION';

export type TireMovement = {
  id: string;
  vehicleId?: string | null;
  tireId?: string | null;
  secondTireId?: string | null;
  type: TireMovementType;
  tireSerial: string;
  secondTireSerial?: string | null;
  fromAxle?: string | null;
  fromWheel?: string | null;
  toAxle?: string | null;
  toWheel?: string | null;
  note?: string | null;
  createdAt: string;
};

export type CreateTireMovementPayload = {
  vehicleId?: string;
  tireId?: string;
  secondTireId?: string;
  type: TireMovementType;
  tireSerial: string;
  secondTireSerial?: string | null;
  fromAxle?: string;
  fromWheel?: string;
  toAxle?: string;
  toWheel?: string;
  note?: string;
};

export async function createTireMovement(payload: CreateTireMovementPayload) {
  const { data } = await api.post('/tire-movements', payload);
  return data;
}

export async function getTireMovements(params?: { vehicleId?: string; tireId?: string }) {
  const { data } = await api.get('/tire-movements', { params });
  return Array.isArray(data) ? data : [];
}