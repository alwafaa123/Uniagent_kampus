const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Error khusus agar komponen bisa membedakan jenis kegagalan
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api(
  path: string,
  opts: { method?: string; body?: any } = {},
) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const isFormData = opts.body instanceof FormData;

  const res = await fetch(BASE + "/api" + path, {
    method: opts.method || "GET",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isFormData
      ? opts.body
      : opts.body
        ? JSON.stringify(opts.body)
        : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data.detail || data.error || "Terjadi kesalahan", res.status);
  }
  return data;
}
