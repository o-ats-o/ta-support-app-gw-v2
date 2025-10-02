## プロジェクト概要

**TA Support App Gateway v2** は、授業設計や振り返りを支援するダッシュボードアプリケーションです。学習者の会話ログやシナリオ進行状況、Miro ワークのサマリー、トレンド指標などを集約し、グループ単位での状況把握の支援をします。

主要な機能:

- グループ/シナリオごとのログと進捗の可視化
- 推薦グループの一覧表示と詳細
- Recharts を利用したトレンドグラフや指標の可視化
- Shadcn UI + Radix UI をベースとしたモダンな UI コンポーネント群

## リポジトリ構造

```text
ta-support-app-gw-v2/
├── public/                     # 画像やアイコンなどの静的アセット
├── src/
│   ├── app/                    # App Router のルーティングとページ
│   │   ├── page.tsx            # ルートトップページ
│   │   ├── list-ver/           # グループ一覧ビュー
│   │   └── recommend-ver/      # 推薦ビュー
│   ├── components/
│   │   ├── dashboard/          # ダッシュボード専用 UI コンポーネント
│   │   └── ui/                 # 共通 UI コンポーネント (shadcn/ui ベース)
│   ├── features/
│   │   └── dashboard/          # ダッシュボード機能に関するロジックと hooks
│   └── lib/                    # API クライアント、型定義、ユーティリティ
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── next.config.ts
└── README.md
```

上記以外にも ESLint/Tailwind の設定ファイルや `tsconfig.json`、`src/app/api/worker/[...path]/route.ts` などの API ルートが含まれています。

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **UI/スタイリング**: Tailwind CSS 4、Radix UI、shadcn/ui コンポーネント、lucide-react アイコン
- **データフェッチ**: Axios、@tanstack/react-query
- **可視化**: Recharts
- **ユーティリティ**: date-fns、zod、class-variance-authority など
- **品質管理**: ESLint、Prettier

## ローカル環境構築

推奨動作環境: Node.js 20 LTS 以上、pnpm 9 系。

1. 依存パッケージをインストールします。

   ```bash
   pnpm install
   ```

2. 環境変数を設定します。`.env.example` をコピーして `.env.local` を作成し、API エンドポイントなどの値を入力してください。

   ```bash
   cp .env.example .env.local
   ```

   `NEXT_PUBLIC_API_BASE_URL` などの URL は末尾に `/` を付けてください。

3. 開発サーバーを起動します。

   ```bash
   pnpm dev
   ```

   ブラウザで [http://localhost:3000/list-ver](http://localhost:3000/list-ver) または， [http://localhost:3000/recommend-ver](http://localhost:3000/recommend-ver)を開くとアプリを確認できます。`src/app` 以下のファイルを更新するとホットリロードされます。

4. その他の便利なスクリプト:
   - `pnpm build`: Vercel 本番相当のビルドを実行します。
   - `pnpm start`: ビルド済みアプリをローカルでサーブします。
   - `pnpm lint:fix`: ESLint による静的解析と自動修正を実行します。
   - `pnpm format`: Prettier によるコード整形を実行します。

## Vercel でのデプロイ

このリポジトリは Vercel によって自動デプロイされます。基本的な運用フローは以下の通りです。

1. GitHub の `main` ブランチに変更をマージすると、Vercel が自動的にビルドとデプロイを実行します。
2. プレビュー環境が必要な場合は、Pull Request 作成時に Vercel が自動生成するプレビューデプロイ URL を利用できます。
3. 環境変数 (`NEXT_PUBLIC_API_BASE_URL` など) は Vercel プロジェクトの **Settings > Environment Variables** から管理してください。ローカルと同じ値を `Preview` と `Production` に設定することで、環境間の挙動をそろえられます。
4. ビルドコマンドには `pnpm install` と `pnpm build` が使用され、出力ディレクトリは Next.js App Router のデフォルト設定で Vercel によって処理されます。

Vercel 上でのログやデプロイの詳細は、Vercel ダッシュボードから確認できます。

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
