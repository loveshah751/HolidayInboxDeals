export type Offer = {
  brand: string;
  description: string;
  discount?: string | null;
  code?: string | null;
  expiry?: string | null;
  link?: string | null;
};

export type OffersResponse = {
  offers: Offer[];
  next_page_token?: string | null;
};

export type SessionResponse = {
  connected: boolean;
  gmail_address?: string;
};

export type PromotionsResponse = {
  emails: Record<string, unknown>[];
  next_page_token?: string | null;
};
