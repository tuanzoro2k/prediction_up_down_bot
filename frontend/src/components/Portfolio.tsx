import { useQuery } from '@tanstack/react-query';
import { getVirtualBets, getBetSummary } from '../api/prediction';
import { useAuth } from '../context/AuthContext';

const STATUS_BADGE = {
  PENDING: 'bg-yellow-500/15 text-yellow-400',
  WON: 'bg-emerald-500/15 text-emerald-400',
  LOST: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-gray-500/15 text-gray-400',
} as const;

export default function Portfolio() {
  const { user } = useAuth();

  const { data: summary } = useQuery({
    queryKey: ['bet-summary'],
    queryFn: getBetSummary,
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: bets, isLoading } = useQuery({
    queryKey: ['virtual-bets'],
    queryFn: () => getVirtualBets(),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  if (!user) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Portfolio
      </h2>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Balance"
            value={`$${summary.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color="text-white"
          />
          <SummaryCard
            label="Total P/L"
            value={`${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}`}
            color={summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <SummaryCard
            label="Win Rate"
            value={summary.settledBets > 0 ? `${summary.winRate}%` : '-'}
            color="text-indigo-400"
          />
          <SummaryCard
            label="Bets"
            value={`${summary.wonBets}W / ${summary.lostBets}L / ${summary.pendingBets}P`}
            color="text-gray-300"
          />
        </div>
      )}

      {/* Bets Table */}
      {isLoading ? (
        <div className="text-center text-gray-500 py-6 text-sm">Loading bets...</div>
      ) : !bets || bets.length === 0 ? (
        <div className="text-center text-gray-500 py-6 text-sm">
          No virtual bets yet. Make a prediction and place your first bet!
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/60 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-left">Direction</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Edge</th>
                  <th className="px-4 py-3 text-right">Payout</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {bets.map((bet) => (
                  <tr key={bet.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                      {new Date(bet.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs font-semibold">
                        {bet.prediction.symbol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold ${
                          bet.direction === 'UP'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {bet.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      ${bet.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">
                      {bet.prediction.edgeProb != null
                        ? `${(bet.prediction.edgeProb * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      ${bet.potentialPayout.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[bet.status]}`}
                      >
                        {bet.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {bet.pnl != null ? (
                        <span className={bet.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {bet.pnl >= 0 ? '+' : ''}${bet.pnl.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold font-mono ${color}`}>{value}</p>
    </div>
  );
}
