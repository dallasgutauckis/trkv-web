This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployment

The project uses a unified deployment process for both the main web application and the EventSub service:

1. **GitHub Actions**: Automated deployments are triggered on pushes to the main branch.
2. **Google Cloud Build**: The unified `cloudbuild.yaml` configuration builds and deploys both services.
3. **Google Cloud Run**: Both services are deployed as separate Cloud Run services.

### Required Secrets

These secrets need to be configured in GitHub repository settings:

- `GCP_PROJECT_ID`: Google Cloud project ID
- `SERVICE_ACCOUNT`: Google Cloud service account email
- `WORKLOAD_IDENTITY_PROVIDER`: Workload identity provider URL
- `TWITCH_CLIENT_ID`: Twitch API client ID
- `TWITCH_CLIENT_SECRET`: Twitch API client secret
- `NEXTAUTH_SECRET`: Secret for NextAuth.js
- `NEXTAUTH_URL`: URL for NextAuth.js
- `API_BASE_URL`: Base URL for the main web app

### Manual Deployment

To manually trigger deployment:

```bash
# From the repository root
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_TWITCH_CLIENT_ID=your_client_id,_TWITCH_CLIENT_SECRET=your_client_secret,_NEXTAUTH_SECRET=your_secret,_NEXTAUTH_URL=your_url,_API_BASE_URL=your_base_url \
  --project=your_project_id
```
