# TA Support App Gateway v2

## プロジェクト概要

**TA Support App Gateway v2** は，TA（Teaching Assistant）がグループワークの進行状況を素早く把握し，適切な声かけやフォローを行えるよう支援するダッシュボードアプリケーションです。音声認識ログや Miro の作業履歴など複数のデータソースを集約し，グループ単位の学習状況を一つの画面で俯瞰できるようにします。

主な機能は以下のとおりです。

- **グループ一覧ビュー (`/list-ver`)**: 発話回数・感情スコア・Miro 操作量などの統合指標を一覧で確認し，任意のグループを詳細表示へ切り替え。
- **推薦ビュー (`/recommend-ver`)**: リスクの高い／注視すべきグループをスコア順に提示し，推薦理由とともに優先度を可視化。
- **グループ詳細ペイン**: 時系列トレンド，最新の会話ログ，ログから自動生成される声かけシナリオ，Miro の変更サマリーをタブ切り替えで確認。
- **リアクティブなデータ取得**: 選択した日付・時間帯・グループに応じたデータを React Query でフェッチし，ローカルストレージに選択状態を保存して再訪問時も継続。

## アーキテクチャ概要

- **ルーティング**: Next.js App Router を採用し，`src/app/list-ver/page.tsx` と `src/app/recommend-ver/page.tsx` がダッシュボードのエントリーポイントです。ルート (`page.tsx`) は空ページとして存在します。
- **グローバル状態管理**: `src/app/providers.tsx` で `@tanstack/react-query` の `QueryClientProvider` を用意し，クエリキャッシュ・リトライ・スタレタイムなどの共通設定を集中管理しています。
- **API クライアント層**: `src/lib/api.ts` に REST API 呼び出し・レスポンス正規化・エラーハンドリングを一括実装。会話ログ・グループ指標・推薦・時系列・Miro 差分・シナリオ生成などのエンドポイントをカバーします。
- **ユースケース Hook**: `src/features/dashboard` 配下には `useGroupsQuery`, `useTimeseriesQuery`, `useConversationLogsQuery`, `useRecommendationsQuery`, `useScenarioQuery`, `useMiroSummaryManager` といった Hook 群があり，画面に必要なデータ取得・下準備・キャッシュキー組み立てを担います。
- **UI レイヤー**: `src/components/dashboard` でダッシュボード固有の表示ロジックを整理し，共通 UI は `src/components/ui` に配置。Tailwind CSS + shadcn/ui + Radix UI を基盤に，動的チャートは Recharts をラップした `MultiLineChart` コンポーネントで描画します。
- **API プロキシ**: `src/app/api/worker/[...path]/route.ts` が Cloudflare Workers など外部 API へのリバースプロキシを実装し，フロントエンドからのアクセス先を統一しています。
- **テーマ管理**: `src/components/theme-provider.tsx` で `next-themes` を利用し，現状はライトテーマ固定で提供しています。

### 主なディレクトリ

```text
ta-support-app-gw-v2/
├── public/                 # 画像やSVGなどの静的アセット
├── src/
│   ├── app/                # Next.js App Router のページとAPIルート
│   │   ├── list-ver/       # グループ一覧ダッシュボード
│   │   ├── recommend-ver/  # 推薦ダッシュボード
│   │   └── api/worker/     # 外部APIへのリバースプロキシ
│   ├── components/
│   │   ├── dashboard/      # ダッシュボード専用UI (詳細ペイン、シナリオ等)
│   │   └── ui/             # 共通UI部品 (ボタン、カード、ダイアログなど)
│   ├── features/dashboard/ # React Query Hooks・Miro集計ロジックなど
│   └── lib/                # APIクライアント、型定義、ユーティリティ、モック
├── eslint.config.mjs       # ESLint 設定
├── next.config.ts          # Next.js 設定
├── package.json            # スクリプトと依存関係
└── pnpm-lock.yaml          # 依存関係ロックファイル
```

## 主要な技術スタック

- **フレームワーク**: Next.js 15 (App Router) / React 19 / TypeScript 5
- **データ取得**: Axios + @tanstack/react-query（再検証・キャッシュ共通化）
- **UI & スタイリング**: Tailwind CSS 4, shadcn/ui, Radix UI, lucide-react
- **チャート**: Recharts をベースにした `MultiLineChart`
- **マークダウンレンダリング**: `react-markdown` + `remark-gfm`
- **その他ユーティリティ**: date-fns, zod, class-variance-authority, tailwind-merge
- **品質管理**: ESLint 9, Prettier 3, TypeScript strict 型付け

## 画面とデータフローの詳細

| タブ / 機能 | 取得データ | 主なコンポーネント / Hook | 補足 |
| --- | --- | --- | --- |
| グループ一覧 | `fetchGroupsByRange` | `GroupList`, `useGroupsQuery` | 時間帯セレクタ (`GroupListHeader`) の選択値をローカルストレージに保存。 |
| 推薦グループ | `fetchGroupRecommendationsByRange` | `RecommendGroupList`, `useRecommendationsQuery` | 優先観察すべきグループに警告アイコン・スコアを表示。 |
| 時間推移グラフ | `fetchGroupTimeseriesByRange` | `TrendChartPanel`, `MultiLineChart`, `useTimeseriesQuery` | 指標切替（発話 / 感情 / Miro）と「選択グループのみ表示」トグルを提供。 |
| 会話ログ | `fetchGroupConversationLogsByRange` | `ConversationLogs`, `useConversationLogsQuery` | バケット分割した会話履歴をスクロール表示。 |
| 声かけシナリオ | `generateTalkScenarioFromTranscript` | `ScenarioPanel`, `useScenarioQuery` | 指定時間帯の会話ログをテキスト化し，Markdown でシナリオを生成。再生成ボタン付き。 |
| Miro 差分 | `fetchMiroDiffsForGroup` | `MiroWorkDetail`, `useMiroSummaryManager`, `miroSummary.ts` | 変更カテゴリ別の要約・割合・詳細を表示し，他グループの差分もバックグラウンドでプリフェッチ。 |

各 Hook では「日付」「時間帯」「グループ ID」をキーとして React Query のキャッシュを構築し，プリフェッチや再取得 (`invalidateQueries`) を適切に行うことで UI の応答性を高めています。ローカルストレージには選択グループ・日付・タブ位置・時間帯を保持し，ページ再訪時も文脈を維持します。

## 環境変数

| 変数名 | 用途 | 必須 | 備考 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | フロントエンドから呼び出す公開 API ベース URL | ✅ | 末尾 `/` 推奨。未設定の場合 `src/lib/api.ts` で明示的にエラーになります。 |
| `API_BASE_URL` | `/api/worker/*` プロキシの転送先 URL | ✅ | 認証付き Worker / API を想定。サーバーサイドのみで参照。 |

`.env.example` を元に `.env.local` を作成し，上記値をセットしてください。URL はプロトコル付きで設定し，ステージング / 本番では Vercel 環境変数 (Preview/Production) に同じキーで登録します。

## ローカル開発手順

推奨環境: Node.js 20 LTS 以上 / pnpm 9 系。

1. 依存パッケージをインストール
   ```bash
   pnpm install
   ```
2. 環境変数ファイルを作成
   ```bash
   cp .env.example .env.local
   ```
   必要に応じて `NEXT_PUBLIC_API_BASE_URL` と `API_BASE_URL` を編集します。
3. 開発サーバーを起動（Turbopack 使用）
   ```bash
   pnpm dev
   ```
   ブラウザで `http://localhost:3000/list-ver` または `http://localhost:3000/recommend-ver` を開くとダッシュボードを確認できます。

## 利用可能なスクリプト

| コマンド | 説明 |
| --- | --- |
| `pnpm dev` | 開発サーバーを起動 (Turbopack)。 |
| `pnpm build` | 本番ビルドを実行 (Turbopack)。 |
| `pnpm start` | ビルド済みアプリをローカルで起動。 |
| `pnpm lint:fix` | ESLint による静的解析と自動修正。 |
| `pnpm format` | Prettier によるコード整形。 |

## デプロイメント

- `main` ブランチへのマージをトリガーに Vercel が自動ビルド・デプロイを実行します。
- プレビュー環境は Pull Request 作成時に自動生成されます。
- 環境変数 (`NEXT_PUBLIC_API_BASE_URL`, `API_BASE_URL`) は Vercel ダッシュボードの **Settings > Environment Variables** で Preview / Production 両方に設定してください。

## 補足メモ

- `src/lib/mock.ts` は画面レイアウトの把握や Storybook 代替として利用できる静的サンプルデータを持ちますが，実行時は React Query で取得した API レスポンスのみを描画に使用します。
- `usePersistentDate` Hook を通じて日付選択がローカルストレージに保存されるため，複数タブでも最新状態を共有できます。
- Chart 表示は SSR を無効化した dynamic import (`ssr: false`) でレンダリングしています。ビルド時にクライアント専用コードとして扱われる点に注意してください。
- 今後自動テストを追加する場合は，React Testing Library + Playwright 等で主要フローの E2E チェックを整備するのが推奨です。
