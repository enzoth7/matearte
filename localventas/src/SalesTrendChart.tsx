import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type SalesTrendChartProps = {
  data: Array<{ label: string; amount: number }>
  period: 'today' | 'week' | 'month' | 'quarter'
  periodLabel: string
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(value)

const formatAxisMoney = (value: number) =>
  `$${new Intl.NumberFormat('es-UY', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`

function SalesTrendChart({ data, period, periodLabel }: SalesTrendChartProps) {
  return (
    <div className="sales-chart" role="img" aria-label={`Gráfico de evolución del total vendido durante ${periodLabel.toLowerCase()}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#e5e9e5" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" axisLine={{ stroke: '#cfd6d1' }} tickLine={false} tick={{ fill: '#68746d', fontSize: 12 }} minTickGap={24} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#68746d', fontSize: 12 }} tickFormatter={formatAxisMoney} width={60} />
          <Tooltip formatter={(value) => [formatMoney(Number(value)), 'Vendido']} contentStyle={{ border: '1px solid #deddd5', borderRadius: '8px', boxShadow: '0 8px 24px rgba(35, 50, 42, .08)' }} />
          <Line type="monotone" dataKey="amount" name="Vendido" stroke="#2e6c50" strokeWidth={3} dot={period === 'today' ? { r: 3, fill: '#2e6c50' } : false} activeDot={{ r: 5, fill: '#b96131', stroke: '#fff', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SalesTrendChart
