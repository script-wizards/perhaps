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

# copy the built plugin into an Obsidian vault, e.g.
# just plugin-install ~/winhome/Documents/scriptwizards
plugin-install vault:
    pnpm --filter @scriptwizards/perhaps-obsidian build
    mkdir -p "{{vault}}/.obsidian/plugins/perhaps"
    cp packages/obsidian/main.js packages/obsidian/manifest.json packages/obsidian/styles.css "{{vault}}/.obsidian/plugins/perhaps/"
