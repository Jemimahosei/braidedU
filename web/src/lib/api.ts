const API_BASE =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_URL || "http://localhost:8000/api";

export interface BraidStyle {
  id: number;
  name: string;
  description: string;
  typical_duration_minutes: number | null;
}

export interface Listing {
  id: number;
  braider: number;
  braider_id: number;
  braider_name: string;
  braider_is_demo: boolean;
  campus_area: string;
  style: number;
  style_name: string;
  title: string;
  description: string;
  price: string;
  duration_minutes: number;
  is_active: boolean;
  photo_url: string;
}

export interface Review {
  id: number;
  booking: number;
  client_name: string;
  rating: number;
  comment: string;
  photo_urls: string[];
  created_at: string;
}

export interface Braider {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  campus_area: string;
  location_detail: string;
  instagram: string;
  photo_url: string;
  years_experience: number;
  available_days: string[];
  available_start_time: string | null;
  available_end_time: string | null;
  service_places: string[];
  private_address?: string;
  cancel_window_hours: number;
  deposit_note: string;
  venmo_handle?: string;
  zelle_contact?: string;
  policy_text: string;
  reminders_enabled: boolean;
  buffer_minutes: number;
  is_active: boolean;
  is_demo: boolean;
  average_rating: number | null;
  review_count: number;
  listings: Listing[];
  reviews: Review[];
  match_score?: number;
  match_breakdown?: Record<string, number>;
  cheapest_listing?: Listing;
}

export interface TimeOff {
  id: number;
  start_date: string;
  end_date: string;
  note: string;
}

export interface Booking {
  id: number;
  client: number;
  client_name: string;
  listing: number;
  listing_title: string;
  style_name: string;
  braider: number;
  braider_id: number;
  braider_name: string;
  price: string;
  duration_minutes: number;
  date: string;
  start_time: string;
  end_time: string;
  status:
    | "requested"
    | "accepted"
    | "paid"
    | "confirmed"
    | "declined"
    | "completed"
    | "cancelled";
  notes: string;
  place: string;
  paid_at: string | null;
  payment_confirmed_at: string | null;
  payment_screenshot_url: string;
  cancelled_by: string;
  cancel_reason: string;
  late_cancel: boolean;
  cancel_deadline: string;
  cancel_window_hours: number;
  // Only present once the braider has accepted.
  pay?: { venmo: string; zelle: string; deposit_note: string };
  address?: string;
}

export type PhotoKind = "profile" | "work" | "review" | "message" | "reference";

export interface UploadedPhoto {
  id: number;
  url: string;
  thumb_url: string;
  large_url: string;
}

/** A smaller copy of a Cloudinary photo (fast pages); other links pass through. */
export function sized(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`);
}

export interface Session {
  token: string;
  username: string;
  role: AuthUser["role"];
  profile_id: number | null;
}

export interface AuthUser {
  username: string;
  role: "braider" | "client" | null;
  profile_id: number | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const page = data as Paginated<T>;
  return page.results ?? [];
}

export function getToken(): string | null {
  return localStorage.getItem("braidedu_token");
}

export function getStoredUser(): AuthUser | null {
  // A corrupted or blocked localStorage entry must never crash the whole app.
  try {
    const raw = localStorage.getItem("braidedu_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Today as YYYY-MM-DD in the viewer's local time, for date input minimums. */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem("braidedu_token", token);
  localStorage.setItem("braidedu_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("braidedu_token");
  localStorage.removeItem("braidedu_user");
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    // A multipart upload sets its own Content-Type (with the boundary).
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Token ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail =
        body?.detail ||
        (typeof body === "object"
          ? Object.entries(body)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
              .join("; ")
          : detail);
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  styles: () => request<BraidStyle[]>("/styles/"),
  braiders: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<Paginated<Braider>>(`/braiders/${q ? `?${q}` : ""}`).then(unwrap<Braider>);
  },
  braider: (id: number | string) => request<Braider>(`/braiders/${id}/`),
  slots: (braiderId: number | string, listing: string, date: string) =>
    request<{ date: string; slots: string[] }>(
      `/braiders/${braiderId}/slots/?listing=${listing}&date=${date}`,
    ),
  timeOff: () => request<TimeOff[]>("/braiders/me/time-off/"),
  addTimeOff: (data: { start_date: string; end_date: string; note: string }) =>
    request<TimeOff>("/braiders/me/time-off/", { method: "POST", body: JSON.stringify(data) }),
  removeTimeOff: (id: number) => request<void>(`/braiders/me/time-off/${id}/`, { method: "DELETE" }),
  recommended: (params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return request<Braider[]>(`/recommended/?${q}`);
  },
  listings: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<Paginated<Listing>>(`/listings/${q ? `?${q}` : ""}`).then(unwrap<Listing>);
  },
  myListings: () => request<Listing[]>("/my-listings/"),
  createListing: (data: Record<string, unknown>) =>
    request<Listing>("/listings/", { method: "POST", body: JSON.stringify(data) }),
  updateListing: (id: number, data: Record<string, unknown>) =>
    request<Listing>(`/listings/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  myBraiderProfile: () => request<Braider>("/braiders/me/"),
  updateBraiderProfile: (data: Record<string, unknown>) =>
    request<Braider>("/braiders/me/", { method: "PATCH", body: JSON.stringify(data) }),
  myClientProfile: () => request<{ id: number; display_name: string }>("/clients/me/"),
  bookings: (status?: string) =>
    request<Booking[]>(`/bookings/${status ? `?status=${status}` : ""}`),
  createBooking: (data: Record<string, unknown>) =>
    request<Booking>("/bookings/", { method: "POST", body: JSON.stringify(data) }),
  bookingAction: (
    id: number,
    action: "accept" | "decline" | "complete" | "cancel" | "payment-received" | "braider-cancel",
    body: Record<string, unknown> = {},
  ) => request<Booking>(`/bookings/${id}/${action}/`, { method: "POST", body: JSON.stringify(body) }),
  markPaid: (id: number, screenshot_url = "") =>
    request<Booking>(`/bookings/${id}/paid/`, { method: "POST", body: JSON.stringify({ screenshot_url }) }),
  reschedule: (id: number, date: string, start_time: string) =>
    request<Booking>(`/bookings/${id}/reschedule/`, {
      method: "POST",
      body: JSON.stringify({ date, start_time }),
    }),
  receipt: (id: number) =>
    request<{
      receipt_no: number;
      braider: string;
      client: string;
      service: string;
      date: string;
      start_time: string;
      duration_minutes: number;
      amount: string;
      paid_on: string;
    }>(`/bookings/${id}/receipt/`),
  reviewBooking: (id: number, rating: number, comment: string, photo_urls: string[] = []) =>
    request<Review>(`/bookings/${id}/review/`, {
      method: "POST",
      body: JSON.stringify({ rating, comment, photo_urls }),
    }),
  uploadPhoto: (file: File, kind: PhotoKind) => {
    const body = new FormData();
    body.append("image", file);
    body.append("kind", kind);
    return request<UploadedPhoto>("/photos/", { method: "POST", body });
  },
  deletePhoto: (id: number) => request<void>(`/photos/${id}/`, { method: "DELETE" }),
  braiderReviews: (id: number) => request<Review[]>(`/braiders/${id}/reviews/`),
  login: (username: string, password: string) =>
    request<Session>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (email: string, password: string, role: "braider" | "client", display_name: string) =>
    request<{ detail: string; email: string }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({ email, password, role, display_name }),
    }),
  confirmEmail: (token: string) =>
    request<Session>("/auth/confirm/", { method: "POST", body: JSON.stringify({ token }) }),
  resendConfirmation: (email: string) =>
    request<{ detail: string }>("/auth/resend/", { method: "POST", body: JSON.stringify({ email }) }),
  forgotPassword: (email: string) =>
    request<{ detail: string }>("/auth/password-reset/", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<Session>("/auth/password-reset/confirm/", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};

export const CAMPUS_AREAS: Record<string, string> = {
  north: "North Campus",
  west: "West Campus",
  south: "South Campus",
  collegetown: "Collegetown",
  east: "East Campus",
  off_campus: "Off Campus",
};

export const SERVICE_PLACES: Record<string, string> = {
  my_place: "At my place",
  client_place: "I come to you",
  campus_space: "A campus space",
};

export const WEEKDAYS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function campusLabel(area: string): string {
  return CAMPUS_AREAS[area] || area;
}

export function formatPrice(price: string | number): string {
  return `$${Number(price).toFixed(0)}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
