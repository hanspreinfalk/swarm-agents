FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user/workspace
WORKDIR /home/user/workspace
