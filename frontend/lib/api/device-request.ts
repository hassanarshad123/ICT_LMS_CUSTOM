/**
 * Client for the device-limit approval flow.
 *
 * Used exclusively by the login page when a user hits the hard device limit
 * on an institute configured for `require_approval`. Both endpoints are
 * unauthenticated — the ``pollingToken`` returned from ``createDeviceRequest``
 * is the secret that gates status lookups until admin approval.
 */
import { apiClient } from './client';

export interface DeviceRequestCreateResponse {
  requestId: string;
  pollingToken: string;
  pollIntervalSeconds: number;
  pollTimeoutSeconds: number;
}

export type DeviceRequestStatusResponse =
  | { status: 'pending' }
  | { status: 'rejected'; reason?: string }
  | { status: 'consumed' }
  | {
      status: 'approved';
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        instituteId: string | null;
      };
    };

export async function createDeviceRequest(
  email: string,
  password: string,
): Promise<DeviceRequestCreateResponse> {
  return apiClient<DeviceRequestCreateResponse>('/auth/device-request', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });
}

export async function getDeviceRequestStatus(
  requestId: string,
  pollingToken: string,
): Promise<DeviceRequestStatusResponse> {
  return apiClient<DeviceRequestStatusResponse>(
    `/auth/device-request/${requestId}/status`,
    { params: { polling_token: pollingToken } },
  );
}
