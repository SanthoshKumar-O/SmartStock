import type { Product, InventoryResult, Forecast, Holiday, ScenarioComparison, DemandAnalogSummary, Accuracy, InventoryBacktest } from '../types/contracts';

export async function getProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  const body = await res.json();
  return body.data;
}

export async function getProduct(productId: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find(p => p.product_id === productId) || null;
}

function mapStatus(status: string): "CRITICAL" | "WARNING" | "HEALTHY" | "OVERSTOCKED" {
  if (status === "ORDER NOW") return "CRITICAL";
  if (status === "ORDER SOON") return "WARNING";
  if (status === "OVERSTOCK") return "OVERSTOCKED";
  return "HEALTHY";
}

export async function getInventoryStatus(): Promise<InventoryResult[]> {
  const res = await fetch('/api/copilot');
  if (!res.ok) throw new Error('Failed to fetch inventory');
  const body = await res.json();
  return body.data.map((item: any) => ({
    ...item,
    status: mapStatus(item.status)
  }));
}

export async function getProductInventory(productId: string): Promise<InventoryResult | null> {
  const inv = await getInventoryStatus();
  return inv.find(inv => inv.product_id === productId) || null;
}

export async function getForecasts(productId: string): Promise<Forecast[]> {
  const res = await fetch(`/api/forecast?product_id=${productId}`);
  if (!res.ok) throw new Error('Failed to fetch forecast');
  const body = await res.json();
  return body.data;
}

export async function getHolidays(): Promise<Holiday[]> {
  const res = await fetch('/api/holidays');
  if (!res.ok) throw new Error('Failed to fetch holidays');
  const body = await res.json();
  return body.data;
}

export interface ScenarioInputs {
  uplift_pct: number;
  start_date: string;
  end_date: string;
  product_ids: string[];
  lead_time_extra_days: number;
  service_level: number;
  review_period_days: number;
}

export async function runScenario(inputs: ScenarioInputs): Promise<ScenarioComparison[]> {
  const res = await fetch('/api/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs)
  });
  if (!res.ok) throw new Error('Failed to run scenario');
  const body = await res.json();
  return body.comparison.map((item: any) => ({
    ...item,
    status_before: mapStatus(item.status_before),
    status_after: mapStatus(item.status_after)
  }));
}

export async function getDemandAnalogSummary(productId: string): Promise<DemandAnalogSummary | null> {
  const res = await fetch(`/api/analog?product_id=${encodeURIComponent(productId)}`);
  if (!res.ok) throw new Error('Failed to fetch demand analog');
  const body = await res.json();
  return body.data[0] || null;
}

export async function getAccuracyResults(): Promise<Accuracy[]> {
  const res = await fetch('/api/accuracy');
  if (!res.ok) throw new Error('Failed to fetch accuracy');
  const body = await res.json();
  return body.data;
}

export async function getInventoryBacktestResults(): Promise<InventoryBacktest[]> {
  const res = await fetch('/api/backtest');
  if (!res.ok) throw new Error('Failed to fetch backtest');
  const body = await res.json();
  return body.data;
}

export interface CopilotResponse {
  message: string;
  items?: InventoryResult[];
  intent: string;
}

export async function askCopilot(query: string, history: {role: string, content: string}[] = []): Promise<CopilotResponse> {
  const res = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: query, history: history })
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || 'Failed to chat with copilot');
  }
  const body = await res.json();
  if (typeof body.reply !== 'string' || !body.reply.trim()) {
    throw new Error('The Copilot returned an empty response.');
  }
  
  let items: InventoryResult[] | undefined = undefined;
  if (body.referenced_products && body.referenced_products.length > 0) {
    // Product cards supplement a response; they must never prevent the
    // conversation itself from being displayed when a second API call fails.
    try {
      const inv = await getInventoryStatus();
      items = inv.filter((i: any) => body.referenced_products.includes(i.product_id));
    } catch (error) {
      console.warn('Copilot reply received, but product cards could not load.', error);
    }
  }
  
  return {
    message: body.reply,
    items,
    intent: body.referenced_products?.length ? "WHY_ORDER" : "AI_CHAT"
  };
}
