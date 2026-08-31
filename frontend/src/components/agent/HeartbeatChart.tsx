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
    <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Heartbeat Activity</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="heartbeatGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b8eff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b8eff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: '#4b5563', fontSize: 10 }}
            axisLine={{ stroke: '#1f2937' }}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: '#4b5563', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#3b8eff' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#3b8eff"
            strokeWidth={2}
            fill="url(#heartbeatGradient)"
            name="Events"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
