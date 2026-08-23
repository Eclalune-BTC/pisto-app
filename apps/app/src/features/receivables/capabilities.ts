export type ReceivablePaymentCapabilities = {
  atomicCashMovement: boolean;
};

// Enabled only because integration commit 04ada13 closes the receivable payment/cash movement
// transaction, account-ownership, operation-receipt, and reversal seam.
export const RECEIVABLE_PAYMENT_CAPABILITIES: ReceivablePaymentCapabilities = {
  atomicCashMovement: true,
};

export function receivablePaymentsEnabled(
  capabilities: ReceivablePaymentCapabilities = RECEIVABLE_PAYMENT_CAPABILITIES,
): boolean {
  return capabilities.atomicCashMovement;
}
