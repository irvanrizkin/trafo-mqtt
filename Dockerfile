# Stage 1: Compile TypeScript to JavaScript
FROM node:16 AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Run the application
FROM node:16

# Set working directory
WORKDIR /app

# Copy built JavaScript files from the previous stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Copy .env file
COPY .env ./

# Install only production dependencies
RUN npm install --only=production

# Run the application
CMD ["npm", "start"]