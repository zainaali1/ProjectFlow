#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Lets GitHub Actions deploy to your Web App WITHOUT storing any password:
# GitHub proves who it is with a short-lived OIDC token, and Entra ID trusts
# tokens from your repo's "production" environment only.
#
# Usage: ./infra/github-oidc.sh <unique-app-name> <github-owner>/<repo>
# ---------------------------------------------------------------------------
set -euo pipefail

NAME="${1:?Usage: github-oidc.sh <unique-app-name> <owner/repo>}"
REPO="${2:?Usage: github-oidc.sh <unique-app-name> <owner/repo>}"
RG="rg-$NAME"

APP_ID="$(az ad app create --display-name "ProjectFlow GitHub deploy" --query appId -o tsv)"
az ad sp create --id "$APP_ID" -o none

az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-production\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:$REPO:environment:production\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}" -o none

WEBAPP_ID="$(az webapp show -g "$RG" -n "$NAME" --query id -o tsv)"
# Least privilege: it can deploy to this one web app, nothing else.
az role assignment create --assignee "$APP_ID" --role "Website Contributor" --scope "$WEBAPP_ID" -o none

cat <<EOF

Add these to GitHub > your repo > Settings > Secrets and variables > Actions:

  Secrets
    AZURE_CLIENT_ID        $APP_ID
    AZURE_TENANT_ID        $(az account show --query tenantId -o tsv)
    AZURE_SUBSCRIPTION_ID  $(az account show --query id -o tsv)

  Variables
    AZURE_WEBAPP_NAME      $NAME
    VITE_AZURE_TENANT_ID   (from entra-apps.sh)
    VITE_SPA_CLIENT_ID     (from entra-apps.sh)
    VITE_API_SCOPE         (from entra-apps.sh)

And create an environment called "production" (Settings > Environments).
EOF
