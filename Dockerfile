FROM node:22.15-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server.mjs index.html admin.html cv.html manifest.webmanifest robots.txt sitemap.xml sw.js ./
COPY --chown=node:node server ./server
COPY --chown=node:node data ./data
COPY --chown=node:node styles ./styles
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node vendor ./vendor
COPY --chown=node:node assets ./assets

RUN mkdir -p /app/storage && chown -R node:node /app/storage

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node --no-warnings=ExperimentalWarning -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--no-warnings=ExperimentalWarning", "server.mjs"]
