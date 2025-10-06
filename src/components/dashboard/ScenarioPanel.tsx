"use client";

import { useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScenarioQuery } from "@/features/dashboard/useScenarioQuery";
import type { DashboardData, GroupInfo } from "@/lib/types";

const MARKDOWN_LIST_MARKER_RE = /^\s*(?:[-*+]\s|\d+\.\s)/;

const markdownComponents: Components = {
  h1: (props) => (
    <h2 className="mt-4 text-lg font-semibold text-foreground" {...props} />
  ),
  h2: (props) => (
    <h3 className="mt-4 text-base font-semibold text-foreground" {...props} />
  ),
  h3: (props) => (
    <h4 className="mt-3 text-[15px] font-semibold text-foreground" {...props} />
  ),
  p: (props) => (
    <p className="mb-3 text-[15px] leading-7 text-foreground/90" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mb-3 space-y-2 pl-5 text-[15px] leading-7 text-foreground/90 marker:text-emerald-600 list-disc"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mb-3 space-y-2 pl-5 text-[15px] leading-7 text-foreground/90 marker:text-emerald-600 list-decimal"
      {...props}
    />
  ),
  li: (props) => <li className="leading-7" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a className="text-emerald-600 underline underline-offset-2" {...props} />
  ),
  blockquote: (props) => (
    <blockquote
      className="mb-3 border-l-2 border-emerald-300/70 pl-3 text-[15px] italic text-foreground/80"
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => (
    <code
      className={`rounded bg-emerald-50 px-1 py-0.5 text-[14px] text-emerald-700 ${className ?? ""}`.trim()}
      {...props}
    >
      {children}
    </code>
  ),
};

type Props = {
  data: DashboardData;
  selected: GroupInfo;
  logsLoading?: boolean;
  date?: string;
  timeRange?: string;
  windowMinutes?: number;
};

export default function ScenarioPanel({
  data,
  selected,
  logsLoading,
  date,
  timeRange,
  windowMinutes = 10,
}: Props) {
  const logs = useMemo(() => data.logs ?? [], [data.logs]);
  const {
    data: scenario,
    error,
    isPending,
    isFetching,
    refetch,
    hasTranscript,
  } = useScenarioQuery({
    group: selected,
    logs,
    enabled: !logsLoading,
    date,
    timeRange,
    windowMinutes,
  });

  const loading = isPending || isFetching;

  const handleRegenerate = useCallback(() => {
    if (!hasTranscript) return;
    void refetch();
  }, [hasTranscript, refetch]);

  const buttonDisabled =
    !hasTranscript || Boolean(logsLoading) || isPending || isFetching;
  const buttonLabel = isPending || isFetching ? "生成中…" : "再生成";

  const markdownContent = useMemo(() => {
    if (!scenario) return null;
    const explicit = scenario.markdown?.trim();
    if (explicit) return explicit;
    const bulletLines = scenario.bullets
      .map((bullet) => {
        const raw = (bullet.markdown ?? bullet.text ?? "").trim();
        if (!raw) return null;
        return MARKDOWN_LIST_MARKER_RE.test(raw) ? raw : `- ${raw}`;
      })
      .filter((line): line is string => Boolean(line));
    if (bulletLines.length === 0) return null;
    return bulletLines.join("\n");
  }, [scenario]);

  let content: React.ReactNode;
  if (logsLoading) {
    content = (
      <div className="text-sm text-muted-foreground">
        会話履歴を読み込んでいます…
      </div>
    );
  } else if (!hasTranscript) {
    content = (
      <div className="text-sm text-muted-foreground">
        対象グループの会話履歴がまだありません
      </div>
    );
  } else if (loading) {
    content = (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  } else if (error) {
    content = (
      <div className="text-sm text-red-600">
        シナリオの生成に失敗しました。
        {error instanceof Error && error.message ? (
          <span className="ml-1 text-red-500/80">{error.message}</span>
        ) : (
          <span className="ml-1">再度お試しください。</span>
        )}
      </div>
    );
  } else if (scenario) {
    content = markdownContent ? (
      <div className="text-[15px] leading-7 text-foreground/90">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {markdownContent}
        </ReactMarkdown>
      </div>
    ) : (
      <div className="text-sm text-muted-foreground">シナリオがありません</div>
    );
  } else {
    content = (
      <div className="text-sm text-muted-foreground">シナリオがありません</div>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-md mb-2">声かけシナリオ</div>
        <Button
          type="button"
          variant="outline"
          className="bg-white text-emerald-700 border-emerald-600 hover:bg-emerald-50"
          onClick={handleRegenerate}
          disabled={buttonDisabled}
        >
          {buttonLabel}
        </Button>
      </div>
      <div className="relative mt-4 h-[400px]">
        <ScrollArea className="h-full pr-2">
          <div className="pb-2">{content}</div>
        </ScrollArea>
      </div>
    </Card>
  );
}
