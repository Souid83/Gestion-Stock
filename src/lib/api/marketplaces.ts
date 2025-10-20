interface AccountResponse {
  accounts: {
    id: string;
    display_name: string;
    environment: string;
    provider_account_id: string;
  }[];
}

interface ListingsParams {
  provider: string;
  account_id: string;
  q?: string;
  only_unmapped?: boolean;
  status?: "all" | "ok" | "pending" | "failed";
  page?: number;
  limit?: number;
}

interface ListingsResponse {
  items: {
    remote_id: string;
    remote_sku: string;
    title: string;
    price_amount: number | null;
    price_currency: string;
    price_eur: number | null;
    internal_price: number | null;
    status_sync: "ok" | "pending" | "failed" | "unmapped";
    mapped_product_id: string | null;
  }[];
  page: number;
  total: number;
}

interface MappingBody {
  action: "link" | "create" | "ignore";
  provider: string;
  account_id: string;
  remote_id?: string;
  remote_sku?: string;
  product_id?: string;
}

interface MappingResponse {
  ok: boolean;
  mapping?: any;
}

export async function listAccounts(provider: string): Promise<AccountResponse> {
  const response = await fetch(
    `/.netlify/functions/marketplaces-accounts?provider=${encodeURIComponent(provider)}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return { accounts: data.accounts || [] };
}

export async function listListings(params: ListingsParams): Promise<ListingsResponse> {
  const searchParams = new URLSearchParams({
    provider: params.provider,
    account_id: params.account_id,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.only_unmapped !== undefined) {
    searchParams.set("only_unmapped", String(params.only_unmapped));
  }

  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  const response = await fetch(
    `/.netlify/functions/marketplaces-listings?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    items: data.items || [],
    page: data.page || 1,
    total: data.total || 0,
  };
}

export async function postMapping(body: MappingBody): Promise<MappingResponse> {
  const response = await fetch("/.netlify/functions/marketplaces-mapping", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return { ok: true, mapping: data };
}
