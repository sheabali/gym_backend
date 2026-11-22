import { Request, Response } from 'express';
import { env } from '../../config';
import { sendSuccess } from '../../utils/response';
import * as paymentsService from './payments.service';

const shouldRedirectBrowser = (req: Request): boolean => {
  const acceptHeader = req.headers.accept || '';
  return !acceptHeader.includes('application/json');
};

export const handleSslcommerzSuccess = async (req: Request, res: Response): Promise<void> => {
  const payload = (req.body || {}) as Record<string, unknown>;
  const result = await paymentsService.handleSuccessCallback(payload);

  if (shouldRedirectBrowser(req)) {
    res.redirect(`${env.FRONTEND_URL}/payment/result?tran_id=${result.payment.tranId}&status=success`);
    return;
  }

  sendSuccess(res, {
    statusCode: 200,
    message: 'Payment processed successfully',
    data: result,
  });
};

export const handleSslcommerzFail = async (req: Request, res: Response): Promise<void> => {
  const payload = (req.body || {}) as Record<string, unknown>;
  const result = await paymentsService.handleFailCallback(payload);

  if (shouldRedirectBrowser(req)) {
    res.redirect(`${env.FRONTEND_URL}/payment/result?tran_id=${result.payment.tranId}&status=failed`);
    return;
  }

  sendSuccess(res, {
    statusCode: 200,
    message: 'Payment marked as failed',
    data: result,
  });
};

export const handleSslcommerzCancel = async (req: Request, res: Response): Promise<void> => {
  const payload = (req.body || {}) as Record<string, unknown>;
  const result = await paymentsService.handleCancelCallback(payload);

  if (shouldRedirectBrowser(req)) {
    res.redirect(`${env.FRONTEND_URL}/payment/result?tran_id=${result.payment.tranId}&status=cancelled`);
    return;
  }

  sendSuccess(res, {
    statusCode: 200,
    message: 'Payment marked as cancelled',
    data: result,
  });
};

export const handleSslcommerzIpn = async (req: Request, res: Response): Promise<void> => {
  const payload = (req.body || {}) as Record<string, unknown>;
  const result = await paymentsService.handleIpnWebhook(payload);

  sendSuccess(res, {
    statusCode: 200,
    message: 'IPN processed successfully',
    data: result,
  });
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  const { tranId } = req.params;
  const status = await paymentsService.getPaymentStatus(tranId, req.user!);

  sendSuccess(res, {
    statusCode: 200,
    message: 'Payment status retrieved',
    data: status,
  });
};

export const reconcilePayments = async (_req: Request, res: Response): Promise<void> => {
  const results = await paymentsService.reconcilePendingPayments();

  sendSuccess(res, {
    statusCode: 200,
    message: 'Payment reconciliation completed',
    data: results,
  });
};
