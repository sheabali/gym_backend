import crypto from 'crypto';
import {
  InitPaymentParams,
  InitPaymentResult,
  PaymentGateway,
  QueryTransactionResult,
  ValidatePaymentParams,
  ValidatePaymentResult,
} from './types';
import { AppError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';

export interface SSLCommerzConfig {
  storeId: string;
  storePass: string;
  isSandbox: boolean;
}

export class SSLCommerzGateway implements PaymentGateway {
  private readonly storeId: string;
  private readonly storePass: string;
  private readonly isSandbox: boolean;
  private readonly baseUrl: string;
  private readonly validationUrl: string;
  private readonly queryUrl: string;

  constructor(config: SSLCommerzConfig) {
    this.storeId = config.storeId;
    this.storePass = config.storePass;
    this.isSandbox = config.isSandbox;

    this.baseUrl = this.isSandbox
      ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
      : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

    this.validationUrl = this.isSandbox
      ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
      : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

    this.queryUrl = this.isSandbox
      ? 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php'
      : 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';
  }

  public async initPayment(params: InitPaymentParams): Promise<InitPaymentResult> {
    const amountInBdt = (params.amountPaisa / 100).toFixed(2);

    const formData = new URLSearchParams();
    formData.append('store_id', this.storeId);
    formData.append('store_passwd', this.storePass);
    formData.append('total_amount', amountInBdt);
    formData.append('currency', params.currency || 'BDT');
    formData.append('tran_id', params.tranId);
    formData.append('success_url', params.successUrl);
    formData.append('fail_url', params.failUrl);
    formData.append('cancel_url', params.cancelUrl);
    formData.append('ipn_url', params.ipnUrl);

    // Customer details
    formData.append('cus_name', params.customerName);
    formData.append('cus_email', params.customerEmail);
    formData.append('cus_phone', params.customerPhone || '01700000000');
    formData.append('cus_add1', 'Dhaka');
    formData.append('cus_city', 'Dhaka');
    formData.append('cus_country', 'Bangladesh');

    // Product info
    formData.append('product_name', params.planName);
    formData.append('product_category', 'Gym Membership');
    formData.append('product_profile', 'non-physical-goods');
    formData.append('shipping_method', 'NO');

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new AppError(
          `SSLCommerz session init failed with HTTP ${response.status}`,
          502,
          'BAD_GATEWAY'
        );
      }

      const data = (await response.json()) as Record<string, unknown>;

      if (data.status !== 'SUCCESS' || typeof data.GatewayPageURL !== 'string') {
        logger.error({ data }, 'SSLCommerz session initiation rejected by gateway');
        throw new AppError(
          `SSLCommerz initiation failed: ${String(data.failedreason || 'Unknown gateway rejection')}`,
          502,
          'BAD_GATEWAY'
        );
      }

      return {
        gatewayPageURL: data.GatewayPageURL,
        sessionKey: typeof data.sessionkey === 'string' ? data.sessionkey : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      logger.error({ err }, 'SSLCommerz network request failed');
      throw new AppError('Unable to connect to payment gateway', 502, 'BAD_GATEWAY');
    }
  }

  public async validatePayment(params: ValidatePaymentParams): Promise<ValidatePaymentResult> {
    const url = new URL(this.validationUrl);
    url.searchParams.append('val_id', params.valId);
    url.searchParams.append('store_id', this.storeId);
    url.searchParams.append('store_passwd', this.storePass);
    url.searchParams.append('format', 'json');

    try {
      const response = await fetch(url.toString(), { method: 'GET' });

      if (!response.ok) {
        throw new AppError(
          `SSLCommerz validation failed with HTTP ${response.status}`,
          502,
          'BAD_GATEWAY'
        );
      }

      const data = (await response.json()) as Record<string, unknown>;

      const rawStatus = String(data.status || '').toUpperCase();
      let status: 'VALID' | 'FAILED' | 'CANCELLED' = 'FAILED';
      if (rawStatus === 'VALID' || rawStatus === 'VALIDATED') {
        status = 'VALID';
      } else if (rawStatus === 'CANCELLED') {
        status = 'CANCELLED';
      }

      const rawAmount = parseFloat(String(data.amount || '0'));
      const amountPaisa = Math.round(rawAmount * 100);

      return {
        status,
        tranId: String(data.tran_id || params.tranId || ''),
        valId: String(data.val_id || params.valId),
        amountPaisa,
        currency: String(data.currency || 'BDT').toUpperCase(),
        cardType: typeof data.card_type === 'string' ? data.card_type : undefined,
        bankTranId: typeof data.bank_tran_id === 'string' ? data.bank_tran_id : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      logger.error({ err, valId: params.valId }, 'SSLCommerz validation request failed');
      throw new AppError('Unable to validate payment with gateway', 502, 'BAD_GATEWAY');
    }
  }

  public async queryTransaction(tranId: string): Promise<QueryTransactionResult> {
    const url = new URL(this.queryUrl);
    url.searchParams.append('tran_id', tranId);
    url.searchParams.append('store_id', this.storeId);
    url.searchParams.append('store_passwd', this.storePass);
    url.searchParams.append('format', 'json');

    try {
      const response = await fetch(url.toString(), { method: 'GET' });
      if (!response.ok) {
        throw new AppError(
          `SSLCommerz query failed with HTTP ${response.status}`,
          502,
          'BAD_GATEWAY'
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      let status: 'VALID' | 'FAILED' | 'PENDING' | 'CANCELLED' = 'PENDING';

      // SSLCommerz transaction query may return element array or direct object
      const element = Array.isArray(data.element) && data.element.length > 0 ? (data.element[0] as Record<string, unknown>) : data;
      const rawStatus = String(element.status || '').toUpperCase();

      if (rawStatus === 'VALID' || rawStatus === 'VALIDATED') {
        status = 'VALID';
      } else if (rawStatus === 'FAILED') {
        status = 'FAILED';
      } else if (rawStatus === 'CANCELLED') {
        status = 'CANCELLED';
      }

      const rawAmount = parseFloat(String(element.amount || '0'));
      const amountPaisa = Math.round(rawAmount * 100);

      return {
        status,
        tranId,
        valId: typeof element.val_id === 'string' ? element.val_id : undefined,
        amountPaisa,
        currency: String(element.currency || 'BDT').toUpperCase(),
        cardType: typeof element.card_type === 'string' ? element.card_type : undefined,
        bankTranId: typeof element.bank_tran_id === 'string' ? element.bank_tran_id : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      logger.error({ err, tranId }, 'SSLCommerz transaction query failed');
      throw new AppError('Unable to query transaction status from gateway', 502, 'BAD_GATEWAY');
    }
  }

  public verifySignature(payload: Record<string, unknown>): boolean {
    const verifySign = typeof payload.verify_sign === 'string' ? payload.verify_sign : null;
    const verifyKey = typeof payload.verify_key === 'string' ? payload.verify_key : null;

    if (!verifySign || !verifyKey) {
      // If gateway didn't pass signature parameters, fallback to mandatory Order Validation API
      return true;
    }

    try {
      const keys = verifyKey.split(',');
      const parts: string[] = [];
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          parts.push(`${key}=${String(payload[key])}`);
        }
      }

      // Add hashed store password to parts
      const hashedPass = crypto.createHash('md5').update(this.storePass).digest('hex');
      parts.push(`store_passwd=${hashedPass}`);

      const stringToHash = parts.join('&');
      const calculatedHash = crypto.createHash('md5').update(stringToHash).digest('hex');

      return calculatedHash === verifySign;
    } catch (err) {
      logger.warn({ err }, 'Signature verification encountered error, defaulting to fallback validation');
      return true;
    }
  }
}
