import { BigNumber } from 'bignumber.js';
import { TransactionType } from '@metamask/transaction-controller';
import { hasTransactionType } from '../../../../../shared/lib/transactions.utils';
import { useTransactionMetadataRequestOptional } from '../transactions/useTransactionMetadataRequest';
import {
  useTransactionPayHasPositiveRequiredAmount,
  useTransactionPayQuotes,
  useTransactionPaySourceAmounts,
  useTransactionPayTotals,
} from './useTransactionPayData';

const SUPPORTED_TYPES: TransactionType[] = [
  TransactionType.musdConversion,
  TransactionType.moneyAccountDeposit,
  TransactionType.moneyAccountWithdraw,
];

/**
 * Determines whether the current transaction is fully sponsored by MetaMask
 * (zero gas, zero provider fee, zero MetaMask fee).
 *
 * Same-token Money Account withdraws store a Pay no-op quote whose totals
 * still include estimated network gas. That gas is sponsored on Monad, so
 * it must not be treated as a user-paid fee.
 */
export function useIsPaidByMetaMask(): boolean {
  const transactionMeta = useTransactionMetadataRequestOptional();
  const totals = useTransactionPayTotals();
  const quotes = useTransactionPayQuotes();
  const sourceAmounts = useTransactionPaySourceAmounts();
  const hasPositiveRequiredAmount =
    useTransactionPayHasPositiveRequiredAmount();

  if (!hasTransactionType(transactionMeta, SUPPORTED_TYPES)) {
    return false;
  }

  const isMoneyAccountWithdraw = hasTransactionType(transactionMeta, [
    TransactionType.moneyAccountWithdraw,
  ]);
  const isGasFeeSponsored = Boolean(transactionMeta?.isGasFeeSponsored);

  // Pre-quote / same-token no-op: nothing to convert, gas is sponsored.
  if (isGasFeeSponsored && !sourceAmounts?.length) {
    return true;
  }

  // Every fee is zero before an amount is entered, which is indistinguishable
  // from genuine sponsorship. Requiring a positive amount stops the empty
  // deposit state from claiming "Paid by MetaMask". Withdrawals have no
  // `requiredAssets`, so that gate would never pass.
  if (
    !quotes?.length ||
    !totals?.fees ||
    (!isMoneyAccountWithdraw && !hasPositiveRequiredAmount)
  ) {
    return false;
  }

  const sourceNetwork = new BigNumber(
    totals.fees.sourceNetwork?.estimate?.usd ?? 0,
  );
  const targetNetwork = new BigNumber(totals.fees.targetNetwork?.usd ?? 0);
  const provider = new BigNumber(totals.fees.provider?.usd ?? 0);
  const metaMask = new BigNumber(totals.fees.metaMask?.usd ?? 0);
  const networkFee = isGasFeeSponsored
    ? new BigNumber(0)
    : sourceNetwork.plus(targetNetwork);

  return networkFee.isZero() && provider.isZero() && metaMask.isZero();
}
