FROM node:20-alpine

WORKDIR /app

EXPOSE 3000

CMD ["node", "dist/index.js"]
