FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:5000
ARG VITE_APP_ENV=production
ARG VITE_FEATURE_TEST_SUITE=false
# Token pricing (USD per 1M tokens). Vite inlines VITE_* at build time, and .env files are
# excluded from the build context, so every var the UI reads must be declared here or the
# cost display silently falls back to "not configured".
ARG VITE_TOKEN_INPUT_COST_PER_MILLION_USD=
ARG VITE_TOKEN_OUTPUT_COST_PER_MILLION_USD=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_FEATURE_TEST_SUITE=$VITE_FEATURE_TEST_SUITE
ENV VITE_TOKEN_INPUT_COST_PER_MILLION_USD=$VITE_TOKEN_INPUT_COST_PER_MILLION_USD
ENV VITE_TOKEN_OUTPUT_COST_PER_MILLION_USD=$VITE_TOKEN_OUTPUT_COST_PER_MILLION_USD
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
