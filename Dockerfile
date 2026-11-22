FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

ARG DATABASE_URL="mysql://root:root@mysql:3306/fitnes_sehat"
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
