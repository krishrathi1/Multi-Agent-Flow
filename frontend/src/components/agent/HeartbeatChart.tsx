import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Activity } from '../../types';
import { format } from 'date-fns';

export function HeartbeatChart({ activities }: { activities: Activity[] }) {
  // Group activities by 10-minute buckets
  const heartbeats = activities.filter((a) => a.type === 'HEARTBEAT');
  const bucketMap = new Map<string, number>();

  // Create 24 buckets covering the last 4 hours
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now - i * 10 * 60 * 1000);
    const key = format(time, 'HH:mm');
    bucketMap.set(key, 0);
  }

  // Fill buckets
  for (const hb of heartbeats) {
    const time = new Date(hb.createdAt);
    const key = format(time, 'HH:mm');
    // Find closest bucket
    for (const [bucketKey] of bucketMap) {
      if (key >= bucketKey) {
        bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + 1);
      }
    }
  }

  const data = Array.from(bucketMap.entries()).map(([time, count]) => ({ time, count }));

  return (
    <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6 shadow-xs">
      <h3 className="text-sm font-bold text-ink mb-4">Heartbeat Activity</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="heartbeatGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-line)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--c-ink)',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            }}
            labelStyle={{ color: 'var(--c-ink-muted)', fontWeight: 600 }}
            itemStyle={{ color: '#2563eb', fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#heartbeatGradient)"
            name="Events"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
