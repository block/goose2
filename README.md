# ⚠️ This repository has moved

Goose2 now lives in the main goose monorepo:

**👉 https://github.com/aaif-goose/goose/tree/main/ui/goose2**

All new development, issues, and pull requests should go there.

## For contributors with open PRs

Your branch was based on this repo. To move your work over:

1. Clone the main goose repo and create a branch:

```bash
git clone https://github.com/aaif-goose/goose.git
cd goose
git checkout -b my-feature
```

From your old goose2 branch, generate patches and apply them:


```bash
# From the goose repo
git remote add goose2-old https://github.com/block/goose2.git
git fetch goose2-old
git format-patch main..<your-branch> --stdout \
  | git am --directory=ui/goose2
```

Open your PR against aaif-goose/goose instead.
