#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Creates the two Microsoft Entra ID (Azure AD) app registrations ProjectFlow
# needs, wired together:
#
#   ProjectFlow API  - the protected resource. Exposes the scope
#                      api://<api-id>/access_as_user and the app role
#                      ProjectFlow.Manager.
#   ProjectFlow Web  - the React single-page app. Signs users in with
#                      auth code + PKCE and asks for the API scope.
#
# Usage:  az login
#         ./infra/entra-apps.sh https://<your-webapp>.azurewebsites.net
# Safe to run once; re-running creates new, separate registrations.
# ---------------------------------------------------------------------------
set -euo pipefail

PROD_URL="${1:-}"
LOCAL_URL="http://localhost:5173"
TENANT_ID="$(az account show --query tenantId -o tsv)"

SCOPE_ID="$(uuidgen | tr 'A-Z' 'a-z')"
ROLE_ID="$(uuidgen | tr 'A-Z' 'a-z')"

echo "Creating API app registration..."
API_APP_ID="$(az ad app create --display-name "ProjectFlow API" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
az ad sp create --id "$API_APP_ID" >/dev/null
az ad app update --id "$API_APP_ID" --identifier-uris "api://$API_APP_ID"

echo "Creating Web (SPA) app registration..."
SPA_APP_ID="$(az ad app create --display-name "ProjectFlow Web" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
az ad sp create --id "$SPA_APP_ID" >/dev/null

REDIRECTS="\"$LOCAL_URL\""
if [[ -n "$PROD_URL" ]]; then REDIRECTS="$REDIRECTS, \"${PROD_URL%/}\""; fi

# API: scope, app role, v2 tokens, and pre-authorise the SPA (no consent prompt)
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications(appId='$API_APP_ID')" \
  --headers "Content-Type=application/json" \
  --body "{
    \"api\": {
      \"requestedAccessTokenVersion\": 2,
      \"oauth2PermissionScopes\": [{
        \"id\": \"$SCOPE_ID\",
        \"value\": \"access_as_user\",
        \"type\": \"User\",
        \"isEnabled\": true,
        \"adminConsentDisplayName\": \"Use ProjectFlow\",
        \"adminConsentDescription\": \"Allows the app to read and change ProjectFlow data as the signed-in user.\",
        \"userConsentDisplayName\": \"Use ProjectFlow\",
        \"userConsentDescription\": \"Allows the app to read and change ProjectFlow data on your behalf.\"
      }],
      \"preAuthorizedApplications\": []
    },
    \"appRoles\": [{
      \"id\": \"$ROLE_ID\",
      \"value\": \"ProjectFlow.Manager\",
      \"displayName\": \"ProjectFlow manager\",
      \"description\": \"Can create, change and delete projects, tasks, people and bookings.\",
      \"allowedMemberTypes\": [\"User\"],
      \"isEnabled\": true
    }]
  }"

az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications(appId='$API_APP_ID')" \
  --headers "Content-Type=application/json" \
  --body "{ \"api\": { \"preAuthorizedApplications\": [{ \"appId\": \"$SPA_APP_ID\", \"delegatedPermissionIds\": [\"$SCOPE_ID\"] }] } }"

# SPA: redirect URIs (SPA platform = PKCE, no client secret) + permission to call the API
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications(appId='$SPA_APP_ID')" \
  --headers "Content-Type=application/json" \
  --body "{
    \"spa\": { \"redirectUris\": [ $REDIRECTS ] },
    \"requiredResourceAccess\": [{
      \"resourceAppId\": \"$API_APP_ID\",
      \"resourceAccess\": [{ \"id\": \"$SCOPE_ID\", \"type\": \"Scope\" }]
    }]
  }"

# Give yourself the manager role (needed only if you set ENFORCE_ROLES=true)
ME="$(az ad signed-in-user show --query id -o tsv)"
API_SP_ID="$(az ad sp show --id "$API_APP_ID" --query id -o tsv)"
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$API_SP_ID/appRoleAssignedTo" \
  --headers "Content-Type=application/json" \
  --body "{ \"principalId\": \"$ME\", \"resourceId\": \"$API_SP_ID\", \"appRoleId\": \"$ROLE_ID\" }" >/dev/null

cat <<EOF

Done. Put these values in your configuration:

  api/.env and Azure app settings
    AZURE_TENANT_ID=$TENANT_ID
    API_CLIENT_ID=$API_APP_ID

  web/.env.local and GitHub repository variables
    VITE_AZURE_TENANT_ID=$TENANT_ID
    VITE_SPA_CLIENT_ID=$SPA_APP_ID
    VITE_API_SCOPE=api://$API_APP_ID/access_as_user

You were assigned the ProjectFlow.Manager role.
EOF
