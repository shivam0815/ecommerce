import axios, { AxiosInstance } from "axios";

type ServiceabilityParams = {
  pickup_postcode: string;
  delivery_postcode: string;
  weight: number; // in kg
  cod?: 0 | 1;
  declared_value?: number;
  mode?: "Air" | "Surface";
};

type CreateOrderPayload = Record<string, any>;

const BASE_URL = process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in";
const EMAIL = process.env.SHIPROCKET_EMAIL || "";
const PASSWORD = process.env.SHIPROCKET_PASSWORD || "";

if (!EMAIL || !PASSWORD) {
  // log once at boot; avoid throwing so app can still run non-SR features
  console.warn("⚠️ SHIPROCKET_EMAIL/PASSWORD not set. Shiprocket routes will fail until configured.");
}

class SRClient {
  private http: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: number = 0; // epoch ms

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 20000,
    });
  }

  private async authenticate() {
    // reuse token if not expired (Shiprocket tokens ~240h; we keep 1h safety)
    const now = Date.now();
    if (this.token && now < this.tokenExpiry) return;

    const res = await this.http.post("/v1/external/auth/login", {
      email: EMAIL,
      password: PASSWORD,
    });

    const token = res?.data?.token || res?.data?.access_token;
    if (!token) throw new Error("Shiprocket login failed: no token returned");

    this.token = token;
    // set expiry ~9 days from now (10 days – safety)
    this.tokenExpiry = now + 9 * 24 * 60 * 60 * 1000;
  }

  private async authed() {
    await this.authenticate();
    const inst = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return inst;
  }

  async serviceability(params: ServiceabilityParams) {
    const a = await this.authed();
    const { data } = await a.get("/v1/external/courier/serviceability/", { params });
    return data;
  }

  async createAdhocOrder(payload: CreateOrderPayload) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/orders/create/adhoc", payload);
    return data;
  }

  async assignAwb(opts: { shipment_id: number; courier_id?: number }) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/courier/assign/awb", opts);
    return data;
  }

  async generatePickup(opts: { shipment_id: number[] }) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/courier/generate/pickup", opts);
    return data;
  }

  async generateManifest(opts: { shipment_id: number[] }) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/manifests/generate", opts);
    return data;
  }

  async printManifest(opts: { shipment_id: number[] }) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/manifests/print", opts);
    return data;
  }

  async generateLabel(opts: { shipment_id: number[] }) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/courier/generate/label", opts);
    return data;
  }

  async printInvoice(opts: { ids: number[] }) {
    const a = await this.authed();
    const { data } = await a.post("/v1/external/orders/print/invoice", opts);
    return data;
  }

  async trackByAwb(awb: string) {
    const a = await this.authed();
    const { data } = await a.get(`/v1/external/courier/track/awb/${encodeURIComponent(awb)}`);
    return data;
  }
}

export const ShiprocketAPI = new SRClient();
