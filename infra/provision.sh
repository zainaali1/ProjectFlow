#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Creates the Azure resources for ProjectFlow in YOUR subscription:
#
#   Resource group
#   Azure SQL logical server (Microsoft Entra-only auth, no SQL passwords)
#   Azure SQL database (serverless, auto-pauses when idle to save money)
#   App Service plan (Linux) + Web App (Node 22) with a managed identity
#   App settings for the API
#
# Usage:
#   az login
#   az account set --subscription "<subscription name or id>"
#   ./infra/provision.sh <unique-app-name> [region]
#
# <unique-app-name> becomes <name>.azurewebsites.net and <name>-sql.database.windows.net,
# so it must be globally unique: lowercase letters, numbers and hyphens.
# ---------------------------------------------------------------------------
set -euo pipefail

# Windows Git Bash support: stop Git Bash rewriting Azure IDs that start with "/",
# and strip the Windows line endings (\r) that az adds to captured values.
export MSYS_NO_PATHCONV=1
azv() { az "$@" | tr -d '\r'; }
newid() { node -e "console.log(require('crypto').randomUUID())" | tr -d '\r'; }

NAME="${1:?Usage: provision.sh <unique-app-name> [region]}"
LOCATION="${2:-centralus}"
RG="rg-$NAME"
SQL_SERVER="$NAME-sql"
SQL_DB="projectflow"
PLAN="plan-$NAME"
WEBAPP="$NAME"

: "${AZURE_TENANT_ID:=$(azv account show --query tenantId -o tsv)}"
API_CLIENT_ID="${API_CLIENT_ID:-}"   # from entra-apps.sh; can be set later

ME_UPN="$(azv ad signed-in-user show --query userPrincipalName -o tsv)"
ME_ID="$(azv ad signed-in-user show --query id -o tsv)"

echo "==> Making sure this subscription can use SQL and App Service"
az provider register --namespace Microsoft.Sql --wait
az provider register --namespace Microsoft.Web --wait

echo "==> Resource group $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> SQL server $SQL_SERVER (Entra-only auth, admin: $ME_UPN)"
az sql server create -g "$RG" -n "$SQL_SERVER" -l "$LOCATION" \
  --enable-ad-only-auth \
  --external-admin-principal-type User \
  --external-admin-name "$ME_UPN" \
  --external-admin-sid "$ME_ID" \
  --minimal-tls-version 1.2 -o none

az sql server wait -g "$RG" -n "$SQL_SERVER" --exists --interval 10 --timeout 600

echo "==> Firewall: allow Azure services and this computer"
az sql server firewall-rule create -g "$RG" -s "$SQL_SERVER" -n AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none
MY_IP="$(curl -s https://api.ipify.org | tr -d '\r' || true)"
if [[ -n "$MY_IP" ]]; then
  az sql server firewall-rule create -g "$RG" -s "$SQL_SERVER" -n "dev-$(whoami)" \
    --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" -o none
fi

echo "==> SQL database $SQL_DB (serverless, auto-pause after 60 min)"
az sql db create -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB" \
  --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 1 \
  --auto-pause-delay 60 --backup-storage-redundancy Local -o none
# Tip: new subscriptions can use the free Azure SQL offer instead - in the portal choose
# "Apply offer" when creating the database, or add: --use-free-limit --free-limit-exhaustion-behavior AutoPause

echo "==> App Service plan $PLAN (Linux B1) and Web App $WEBAPP"
az appservice plan create -g "$RG" -n "$PLAN" --is-linux --sku B1 -l "$LOCATION" -o none
az webapp create -g "$RG" -p "$PLAN" -n "$WEBAPP" --runtime "NODE:22-lts" -o none

echo "==> Security settings: HTTPS only, TLS 1.2+, FTP off, managed identity on"
az webapp update -g "$RG" -n "$WEBAPP" --https-only true -o none
az webapp config set -g "$RG" -n "$WEBAPP" --min-tls-version 1.2 --ftps-state Disabled \
  --startup-file "node dist/server.js" --always-on true -o none
PRINCIPAL_ID="$(azv webapp identity assign -g "$RG" -n "$WEBAPP" --query principalId -o tsv)"

echo "==> App settings"
az webapp config appsettings set -g "$RG" -n "$WEBAPP" -o none --settings \
  NODE_ENV=production \
  AUTH_MODE=entra \
  AZURE_TENANT_ID="$AZURE_TENANT_ID" \
  API_CLIENT_ID="$API_CLIENT_ID" \
  ENFORCE_ROLES=false \
  DATA_PROVIDER=mssql \
  SQL_SERVER="$SQL_SERVER.database.windows.net" \
  SQL_DATABASE="$SQL_DB" \
  SQL_AUTH=aad-default \
  WEB_DIST_DIR=public \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false
az webapp config set -g "$RG" -n "$WEBAPP" --generic-configurations '{"healthCheckPath": "/api/health"}' -o none

cat <<EOF

=====================================================================
Azure resources are ready.

Web app:      https://$WEBAPP.azurewebsites.net
SQL server:   $SQL_SERVER.database.windows.net
Database:     $SQL_DB
Managed identity principal id: $PRINCIPAL_ID

NEXT: let the web app's managed identity use the database.
Open the database in the Azure portal > Query editor, sign in with
Microsoft Entra (as $ME_UPN) and run:

  CREATE USER [$WEBAPP] FROM EXTERNAL PROVIDER;
  ALTER ROLE db_datareader ADD MEMBER [$WEBAPP];
  ALTER ROLE db_datawriter ADD MEMBER [$WEBAPP];

Then create the tables and demo data (see README, "Set up the database").
=====================================================================
EOF