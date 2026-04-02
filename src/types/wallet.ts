export type TransactionType = 'credit' | 'debit';

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  reason: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}
