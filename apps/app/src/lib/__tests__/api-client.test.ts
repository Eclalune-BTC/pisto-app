import axios, { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const adapter = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ OS: "web" }));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { getCookie: async () => "pisto.session=native-cookie" },
}));
vi.mock("@/lib/env", () => ({ env: { apiUrl: "https://api.pisto.dev" } }));

// Inject at Axios' supported adapter boundary; the production client and all
// request/response/security handling remain under test.
axios.defaults.adapter = adapter;
const { apiRequest } = await import("../api-client");
const schema = z.object({ data: z.object({ id: z.string() }) });
beforeEach(() => {
  platform.OS = "web";
  adapter.mockReset();
  adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ({
    config,
    data: '{"data":{"id":"saved"}}',
    status: 200,
    statusText: "OK",
    headers: {},
  }));
});

describe("shared Axios transport", () => {
  it("bounds the request and sends web credentials only to the configured origin", async () => {
    expect(
      await apiRequest(
        "/v1/sales",
        { method: "POST", body: { amount: 100 }, authenticated: true },
        schema,
      ),
    ).toEqual({ id: "saved" });
    const request = adapter.mock.calls[0]?.[0];
    expect(request.baseURL).toBe("https://api.pisto.dev");
    expect(request.timeout).toBe(30_000);
    expect(request.withCredentials).toBe(true);
    expect(request.data).toBe('{"amount":100}');
    expect(request.headers.get("Cookie")).toBeUndefined();
  });
  it("uses the existing SecureStore-backed native cookie adapter", async () => {
    platform.OS = "ios";
    await apiRequest("/v1/sales", { authenticated: true }, schema);
    const request = adapter.mock.calls[0]?.[0];
    expect(request.withCredentials).toBe(false);
    expect(request.headers.get("Cookie")).toBe("pisto.session=native-cookie");
  });
  it("rejects cross-origin paths before reading credentials or making a request", async () => {
    await expect(apiRequest("//foreign.test", {}, schema)).rejects.toMatchObject({ status: 400 });
    await expect(apiRequest("/\\foreign.test", {}, schema)).rejects.toMatchObject({ status: 400 });
    expect(adapter).not.toHaveBeenCalled();
  });
  it("preserves typed failures and refuses malformed success payloads", async () => {
    adapter.mockResolvedValueOnce({
      status: 429,
      data: '{"error":{"code":"RATE_LIMITED","message":"Wait","requestId":"request-1"}}',
      headers: {},
    });
    await expect(apiRequest("/v1/sales", {}, schema)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      requestId: "request-1",
    });
    adapter.mockResolvedValueOnce({ status: 200, data: '{"data":{}}', headers: {} });
    await expect(apiRequest("/v1/sales", {}, schema)).rejects.toMatchObject({ status: 200 });
  });
  it("never retries an uncertain financial mutation and preserves caller cancellation", async () => {
    adapter.mockRejectedValueOnce(new AxiosError("Timeout", "ECONNABORTED"));
    await expect(
      apiRequest("/v1/sales", { method: "POST", body: {} }, schema),
    ).rejects.toMatchObject({ status: 0 });
    expect(adapter).toHaveBeenCalledTimes(1);
    const canceled = new CanceledError();
    adapter.mockRejectedValueOnce(canceled);
    await expect(apiRequest("/v1/sales", {}, schema)).rejects.toBe(canceled);
    adapter.mockRejectedValueOnce(new CanceledError());
    await expect(
      apiRequest("/v1/sales", { method: "POST", body: {} }, schema),
    ).rejects.toMatchObject({ status: 0 });
  });
});
