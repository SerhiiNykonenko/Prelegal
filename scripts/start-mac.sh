#!/usr/bin/env sh
docker compose up -d --build
printf 'Frontend: http://localhost:3000\nBackend:  http://localhost:8000\n'
