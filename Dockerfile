# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules for the bot
COPY package-lock.json package.json ./
RUN npm ci

# Install node modules for the admin panel
COPY admin-panel/package-lock.json admin-panel/package.json ./admin-panel/
RUN npm ci --prefix admin-panel

# Copy application code
COPY . .


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Setup sqlite3 on a separate volume
RUN mkdir -p /data
VOLUME /data

# Bot and admin panel run as two processes in one machine so they can
# share the sqlite file on /data through SQLite's own file locking,
# the same way they already do when run locally.
ENV DB_PATH="/data/database.sqlite"
CMD ["sh", "-c", "node src/bot.js & node admin-panel/server/server.js & wait -n"]
