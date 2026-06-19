FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Run the Vite dev server (host=0.0.0.0 is configured in package.json)
CMD ["npm", "run", "dev"]
