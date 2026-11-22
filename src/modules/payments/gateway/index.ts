import { env } from '../../../config';
import { FakePaymentGateway } from './fakeGateway';
import { SSLCommerzGateway } from './sslcommerzGateway';
import { PaymentGateway } from './types';

export * from './types';
export * from './fakeGateway';
export * from './sslcommerzGateway';

let activeGateway: PaymentGateway | null = null;
const defaultFakeGateway = new FakePaymentGateway();

export const getPaymentGateway = (): PaymentGateway => {
  if (activeGateway) {
    return activeGateway;
  }

  if (env.NODE_ENV === 'test' || env.SSLCOMMERZ_GATEWAY_MODE === 'fake') {
    activeGateway = defaultFakeGateway;
    return activeGateway;
  }

  activeGateway = new SSLCommerzGateway({
    storeId: env.SSLCOMMERZ_STORE_ID,
    storePass: env.SSLCOMMERZ_STORE_PASS,
    isSandbox: env.SSLCOMMERZ_IS_SANDBOX,
  });

  return activeGateway;
};

/**
 * Helper to allow unit and integration tests to swap in a custom gateway mock.
 */
export const setTestPaymentGateway = (gateway: PaymentGateway | null): void => {
  activeGateway = gateway;
};
