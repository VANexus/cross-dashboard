const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function backendGet(path: string, searchParams?: Record<string, string | undefined>) {
  const url = new URL(`${BACKEND_URL}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  return res.json();
}

export async function backendPost(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json();
}

export async function backendPatch(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json();
}

export async function backendPut(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json();
}

export async function backendDelete(path: string) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "DELETE",
    cache: "no-store",
  });
  return res.json();
}
