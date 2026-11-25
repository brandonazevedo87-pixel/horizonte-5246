import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '../lib/api';

export const useLedger = () => useQuery(orpc.ledger.list.queryOptions({ retry: false }));
export function useLedgerActions() {
  const query = useQueryClient();
  const onSuccess = () => query.invalidateQueries({ queryKey: orpc.ledger.list.key() });
  return {
    client: useMutation(orpc.ledger.saveClient.mutationOptions({ onSuccess })),
    service: useMutation(orpc.ledger.saveService.mutationOptions({ onSuccess })),
    charge: useMutation(orpc.ledger.saveCharge.mutationOptions({ onSuccess })),
    payment: useMutation(orpc.ledger.recordPayment.mutationOptions({ onSuccess })),
  };
}
