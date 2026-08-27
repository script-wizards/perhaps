install:
    pnpm install

test:
    pnpm -r test

build:
    pnpm -r build

roll file table="":
    pnpm --filter @scriptwizards/perhaps-cli exec tsx src/main.ts {{file}} {{table}}

# build the single-file web demo and serve it locally
web:
    pnpm --filter @scriptwizards/perhaps-engine build
    pnpm --filter @scriptwizards/perhaps-web build
    @echo "http://localhost:8746"
    python3 -m http.server 8746 -d packages/web/dist

# deploy the web demo to Cloudflare Pages (perhaps.sh)
deploy:
    pnpm --filter @scriptwizards/perhaps-engine build
    pnpm --filter @scriptwizards/perhaps-web build
    npx -y wrangler@latest pages deploy packages/web/dist --project-name perhaps --branch main --commit-dirty=true

