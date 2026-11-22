import {
  InitPaymentParams,
  InitPaymentResult,
  PaymentGateway,
  QueryTransactionResult,
  ValidatePaymentParams,
  ValidatePaymentResult,
} from './types';
import { env } from '../../../config';

export class FakePaymentGateway implements PaymentGateway {
  private simulatedValidationOverride: Partial<ValidatePaymentResult> | null = null;
  private simulatedQueryOverride: Partial<QueryTransactionResult> | null = null;
  private recordedInitCalls: InitPaymentParams[] = [];

  public async initPayment(params: InitPaymentParams): Promise<InitPaymentResult> {
    this.recordedInitCalls.push(params);

    const redirectUrl = `${env.BACKEND_URL}/api/v1/payments/fake/checkout?tran_id=${params.tranId}`;
    return {
      gatewayPageURL: redirectUrl,
      sessionKey: `fake_session_${Date.now()}`,
      rawResponse: {
        status: 'SUCCESS',
        sessionkey: `fake_session_${Date.now()}`,
        GatewayPageURL: redirectUrl,
      },
    };
  }

  public async validatePayment(params: ValidatePaymentParams): Promise<ValidatePaymentResult> {
    if (this.simulatedValidationOverride) {
      return {
        status: this.simulatedValidationOverride.status || 'VALID',
        tranId: this.simulatedValidationOverride.tranId || params.tranId || 'unknown_tran',
        valId: this.simulatedValidationOverride.valId || params.valId,
        amountPaisa: this.simulatedValidationOverride.amountPaisa ?? 500000,
        currency: this.simulatedValidationOverride.currency || 'BDT',
        cardType: this.simulatedValidationOverride.cardType || 'BKASH-BKash',
        bankTranId: this.simulatedValidationOverride.bankTranId || `BANK-${Date.now()}`,
        rawResponse: this.simulatedValidationOverride.rawResponse || {
          status: 'VALID',
          val_id: params.valId,
          tran_id: params.tranId,
        },
      };
    }

    return {
      status: 'VALID',
      tranId: params.tranId || 'simulated_tran_id',
      valId: params.valId,
      amountPaisa: 500000, // 5,000 BDT default if not overridden
      currency: 'BDT',
      cardType: 'BKASH-BKash',
      bankTranId: `BANK-${Date.now()}`,
      rawResponse: {
        status: 'VALID',
        val_id: params.valId,
        tran_id: params.tranId,
        currency: 'BDT',
        card_type: 'BKASH-BKash',
      },
    };
  }

  public async queryTransaction(tranId: string): Promise<QueryTransactionResult> {
    if (this.simulatedQueryOverride) {
      return {
        status: this.simulatedQueryOverride.status || 'VALID',
        tranId: this.simulatedQueryOverride.tranId || tranId,
        valId: this.simulatedQueryOverride.valId || `VAL-${Date.now()}`,
        amountPaisa: this.simulatedQueryOverride.amountPaisa ?? 500000,
        currency: this.simulatedQueryOverride.currency || 'BDT',
        cardType: this.simulatedQueryOverride.cardType || 'BKASH-BKash',
        bankTranId: this.simulatedQueryOverride.bankTranId || `BANK-${Date.now()}`,
        rawResponse: this.simulatedQueryOverride.rawResponse || {
          status: 'VALID',
          tran_id: tranId,
        },
      };
    }

    return {
      status: 'VALID',
      tranId,
      valId: `VAL-${Date.now()}`,
      amountPaisa: 500000,
      currency: 'BDT',
      cardType: 'BKASH-BKash',
      bankTranId: `BANK-${Date.now()}`,
      rawResponse: {
        status: 'VALID',
        tran_id: tranId,
      },
    };
  }

  public verifySignature(_payload: Record<string, unknown>): boolean {
    return true;
  }

  public setSimulatedValidationResult(override: Partial<ValidatePaymentResult> | null): void {
    this.simulatedValidationOverride = override;
  }

  public setSimulatedQueryResult(override: Partial<QueryTransactionResult> | null): void {
    this.simulatedQueryOverride = override;
  }

  public getRecordedInitCalls(): InitPaymentParams[] {
    return this.recordedInitCalls;
  }

  public reset(): void {
    this.simulatedValidationOverride = null;
    this.simulatedQueryOverride = null;
    this.recordedInitCalls = [];
  }
}
