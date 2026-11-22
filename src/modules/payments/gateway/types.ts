export interface InitPaymentParams {
  tranId: string;
  amountPaisa: number;
  currency: string;
  planName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface InitPaymentResult {
  gatewayPageURL: string;
  sessionKey?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ValidatePaymentParams {
  valId: string;
  tranId?: string;
}

export interface ValidatePaymentResult {
  status: 'VALID' | 'FAILED' | 'CANCELLED';
  tranId: string;
  valId: string;
  amountPaisa: number;
  currency: string;
  cardType?: string; // e.g. BKASH-BKash, VISA-Dutch Bangla Bank, etc.
  bankTranId?: string;
  rawResponse: Record<string, unknown>;
}

export interface QueryTransactionResult {
  status: 'VALID' | 'FAILED' | 'PENDING' | 'CANCELLED';
  tranId: string;
  valId?: string;
  amountPaisa: number;
  currency: string;
  cardType?: string;
  bankTranId?: string;
  rawResponse: Record<string, unknown>;
}

export interface PaymentGateway {
  initPayment(params: InitPaymentParams): Promise<InitPaymentResult>;
  validatePayment(params: ValidatePaymentParams): Promise<ValidatePaymentResult>;
  queryTransaction(tranId: string): Promise<QueryTransactionResult>;
  verifySignature(payload: Record<string, unknown>): boolean;
}
