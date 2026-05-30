import type React from 'react';
import { useMemo } from 'react';
import type { AnalysisReport, HistoryItem, StockHistoryFilters, StockHistoryRange } from '../../types/analysis';
import { getSentimentColor } from '../../types/analysis';
import { formatDateTime, formatReportType } from '../../utils/format';
import { Badge, Button, Card } from '../common';
import { DashboardStateBlock } from '../dashboard';

interface StockHistoryTrendDrawerProps {
  report: AnalysisReport;
  items: HistoryItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error?: unknown;
  filters: StockHistoryFilters;
  onClose: () => void;
  onRangeChange: (range: StockHistoryRange) => void;
  onLoadMore: () => void;
  onSelectRecord: (recordId: number) => void;
  onRetry: () => void;
}

const RANGE_OPTIONS: Array<{ value: StockHistoryRange; label: string }> = [
  { value: 'all', label: '全部历史' },
  { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' },
];

const isPresent = <T,>(value: T | null | undefined): value is T =>
  value !== undefined && value !== null && value !== '';

const formatNumber = (value?: number, digits = 2): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--';

const formatChangePct = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const getPriceChangeStyle = (value?: number): React.CSSProperties | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return undefined;
  }
  return { color: value > 0 ? 'var(--home-price-up)' : 'var(--home-price-down)' };
};

const formatAdvice = (item: Pick<HistoryItem, 'operationAdvice' | 'trendPrediction'>): string => {
  const advice = item.operationAdvice?.trim();
  const trend = item.trendPrediction?.trim();
  if (advice && trend) {
    return `${advice} / ${trend}`;
  }
  return advice || trend || '--';
};

const summarizeView = (items: HistoryItem[], report: AnalysisReport, currentId?: number) => {
  const scores = items
    .map((item) => item.sentimentScore)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  const current = items.find((item) => item.id === currentId) || items[0];
  const models = new Map<string, number>();
  items.forEach((item) => {
    const model = item.modelUsed?.trim() || '未记录';
    models.set(model, (models.get(model) || 0) + 1);
  });

  return {
    current,
    currentScore: current?.sentimentScore ?? report.summary.sentimentScore,
    currentAdvice: current
      ? formatAdvice(current)
      : formatAdvice({
          operationAdvice: report.summary.operationAdvice,
          trendPrediction: report.summary.trendPrediction,
        }),
    latestTime: formatDateTime(items[0]?.createdAt || report.meta.createdAt),
    modelSummary: Array.from(models.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([model]) => model)
      .join(' / ') || '未记录',
    chartScores: scores.slice(0, 8).reverse(),
  };
};

const buildChartPoints = (scores: number[]) => {
  if (scores.length === 0) {
    return '';
  }
  const minScore = Math.min(...scores, 20);
  const maxScore = Math.max(...scores, 80);
  const span = Math.max(maxScore - minScore, 1);
  return scores
    .map((score, index) => {
      const x = scores.length === 1 ? 50 : (index / (scores.length - 1)) * 100;
      const y = 92 - ((score - minScore) / span) * 72;
      return `${x},${y}`;
    })
    .join(' ');
};

export const StockHistoryTrendDrawer: React.FC<StockHistoryTrendDrawerProps> = ({
  report,
  items,
  total,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  filters,
  onClose,
  onRangeChange,
  onLoadMore,
  onSelectRecord,
  onRetry,
}) => {
  const currentRecordId = report.meta.id;
  const summary = useMemo(
    () => summarizeView(items, report, currentRecordId),
    [currentRecordId, items, report],
  );
  const chartPoints = buildChartPoints(summary.chartScores);

  return (
    <Card variant="bordered" padding="sm" className="home-panel-card home-rail-card p-0">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h3 className="text-base font-semibold text-foreground">同股历史趋势</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-secondary-text transition-colors hover:text-foreground"
          aria-label="关闭同股历史趋势"
        >
          ×
        </button>
      </div>

      {isLoading ? (
        <div className="p-4">
          <DashboardStateBlock loading compact title="加载同股历史中..." />
        </div>
      ) : error ? (
        <div className="p-4">
          <DashboardStateBlock
            compact
            title="历史趋势加载失败"
            description="请稍后重试"
            action={(
              <Button variant="secondary" size="sm" onClick={onRetry}>
                重新加载
              </Button>
            )}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="p-4">
          <DashboardStateBlock
            compact
            title="暂无更多同股历史分析"
            description="完成多次分析后，这里会展示观点变化、评分走势和模型记录。"
          />
        </div>
      ) : (
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-3 divide-x divide-border/60 rounded-xl border border-border/60 bg-background/40 px-2 py-2 text-center">
            <div>
              <p className="text-xs text-muted-text">共 {total || items.length} 次分析</p>
              <p className="mt-1 text-xs text-secondary-text">最近一次 {summary.latestTime}</p>
            </div>
            <div>
              <p className="text-xs text-muted-text">当前观点</p>
              <p className="mt-1 text-sm font-semibold text-success">{summary.currentAdvice}</p>
            </div>
            <div>
              <p className="text-xs text-muted-text">模型分布</p>
              <p className="mt-1 truncate text-xs font-semibold text-indigo-400" title={summary.modelSummary}>
                {summary.modelSummary}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-border/60 bg-card/55 p-3">
            <h4 className="text-sm font-semibold text-foreground">情绪分数走势</h4>
            <div className="mt-3 h-32">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                {[20, 50, 80].map((score) => (
                  <line
                    key={score}
                    x1="0"
                    x2="100"
                    y1={92 - ((score - 20) / 60) * 72}
                    y2={92 - ((score - 20) / 60) * 72}
                    stroke="currentColor"
                    strokeOpacity="0.12"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {chartPoints ? (
                  <>
                    <polyline
                      points={chartPoints}
                      fill="none"
                      stroke="var(--color-primary, #22d3ee)"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                    />
                    {chartPoints.split(' ').map((point, index) => {
                      const [cx, cy] = point.split(',');
                      return (
                        <circle
                          key={`${point}-${index}`}
                          cx={cx}
                          cy={cy}
                          r="1.6"
                          fill="var(--color-primary, #22d3ee)"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </>
                ) : null}
              </svg>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onRangeChange(option.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    filters.range === option.value
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/70 bg-background/50 text-secondary-text hover:bg-hover hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 px-2.5 py-1.5 text-xs text-secondary-text">
              模型：全部
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 px-2.5 py-1.5 text-xs text-secondary-text">
              排序：最新优先
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="grid grid-cols-[5rem_minmax(0,1.3fr)_2.5rem_4.5rem_4rem_minmax(0,1.2fr)] border-b border-border/60 bg-background/45 px-2 py-2 text-xs font-medium text-secondary-text">
              <span>时间</span>
              <span>建议/趋势</span>
              <span>分数</span>
              <span>模型</span>
              <span>涨跌幅</span>
              <span>摘要</span>
            </div>
            <div className="max-h-[28rem] divide-y divide-border/55 overflow-y-auto">
              {items.map((item) => {
                const isCurrent = item.id === currentRecordId;
                const sentimentColor = isPresent(item.sentimentScore)
                  ? getSentimentColor(item.sentimentScore)
                  : undefined;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectRecord(item.id)}
                    className={`grid w-full grid-cols-[5rem_minmax(0,1.3fr)_2.5rem_4.5rem_4rem_minmax(0,1.2fr)] items-center gap-2 px-2 py-2 text-left text-xs transition-colors ${
                      isCurrent ? 'bg-primary/10 ring-1 ring-inset ring-primary/35' : 'hover:bg-hover/55'
                    }`}
                  >
                    <span className="font-mono text-secondary-text">
                      {formatDateTime(item.createdAt).slice(5)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap gap-1">
                        {isCurrent ? (
                          <Badge variant="info" size="sm" className="shadow-none">
                            当前
                          </Badge>
                        ) : null}
                        {formatAdvice(item).split('/').map((part, index) => (
                          <Badge key={`${item.id}-${part}-${index}`} variant="default" size="sm" className="shadow-none">
                            {part.trim()}
                          </Badge>
                        ))}
                      </span>
                    </span>
                    <span
                      className="font-mono font-semibold"
                      style={sentimentColor ? { color: sentimentColor } : undefined}
                    >
                      {formatNumber(item.sentimentScore, 0)}
                    </span>
                    <span className="truncate text-secondary-text" title={item.modelUsed || '未记录模型'}>
                      {item.modelUsed || formatReportType(item.reportType) || '--'}
                    </span>
                    <span className="font-mono" style={getPriceChangeStyle(item.changePct)}>
                      {formatChangePct(item.changePct)}
                    </span>
                    <span className="line-clamp-2 text-secondary-text">
                      {item.analysisSummary || '暂无分析摘要'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {hasMore ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={onLoadMore}
                isLoading={isLoadingMore}
                loadingText="加载中..."
              >
                加载更多
              </Button>
            ) : (
              <p className="text-xs text-secondary-text">已加载 {items.length} / {total || items.length} 条</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
