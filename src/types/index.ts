export interface SalesData {
  channel: string;
  sales: number;
  stock: number;
}

export interface StockLocation {
  id: string;
  name: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  imei?: string;
  price: number;
  vat: number;
  margin: number;
  stock: StockLocation[];
  amazonPrice?: number;
  ebayPrice?: number;
}