# TERMINAL COMMANDS

### START SERVER
pnpm infra:up && sleep 2 && pnpm dev
`localhost:3000`

### TERMINATE SERVER
pkill -f "node.*3000|node.*3001" && pkill -f "postgres" && pnpm infra:down