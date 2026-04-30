"""AgentPulse-v2 — Copilot Analytics Dashboard (Flask backend).

Supports real tenant connections via Graph API and Dataverse,
with mock data as fallback when credentials are not available.
"""

import csv
import io
import json
import logging
import os
import random
import time
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request, send_from_directory

try:
    import msal
except ImportError:
    msal = None

import requests

# ---------------------------------------------------------------------------
# App Configuration
# ---------------------------------------------------------------------------

APP_VERSION = "2.0.0"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_BETA = "https://graph.microsoft.com/beta"

STORAGE_CONN_STRING = os.environ.get("STORAGE_CONNECTION_STRING", "")
STORAGE_ACCOUNT_NAME = os.environ.get("STORAGE_ACCOUNT_NAME", "")
KEY_VAULT_URL = os.environ.get("KEY_VAULT_URL", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("agentpulse-v2")

app = Flask(__name__, static_folder="static", static_url_path="")

# ---------------------------------------------------------------------------
# In-memory fallback stores
# ---------------------------------------------------------------------------
_cred_store: dict[str, str] = {}
_tenant_mem_store: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Azure Table Storage helpers (ported from v1)
# ---------------------------------------------------------------------------

def _get_table_client(table_name: str = "tenants"):
    """Create an Azure Table client for the specified table.

    Uses connection string if available, otherwise DefaultAzureCredential.
    Returns None if not configured (dev fallback).
    """
    if not STORAGE_ACCOUNT_NAME and not STORAGE_CONN_STRING:
        logger.warning(f"No storage configured for table '{table_name}' — using in-memory fallback")
        return None
    try:
        from azure.data.tables import TableServiceClient

        if STORAGE_CONN_STRING:
            service = TableServiceClient.from_connection_string(STORAGE_CONN_STRING)
        else:
            from azure.identity import DefaultAzureCredential
            credential = DefaultAzureCredential()
            service = TableServiceClient(
                endpoint=f"https://{STORAGE_ACCOUNT_NAME}.table.core.windows.net",
                credential=credential,
            )
        table = service.get_table_client(table_name)
        try:
            service.create_table_if_not_exists(table_name)
        except Exception:
            pass
        return table
    except Exception as e:
        logger.error(f"Failed to create table client for '{table_name}': {e}")
        return None


def _get_creds_table_client():
    """Get a Table client for the 'credentials' table."""
    return _get_table_client("credentials")


# ---------------------------------------------------------------------------
# Credential storage (Table Storage primary, memory fallback)
# ---------------------------------------------------------------------------

def save_tenant_credentials(tenant_id: str, client_id: str, client_secret: str) -> bool:
    """Store tenant credentials in Table Storage or memory fallback."""
    table = _get_creds_table_client()
    if table:
        try:
            entity = {
                "PartitionKey": "tenants",
                "RowKey": tenant_id,
                "tenant_id": tenant_id,
                "client_id": client_id,
                "client_secret": client_secret,
            }
            table.upsert_entity(entity)
            logger.info(f"Stored credentials in Table Storage for {tenant_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save credentials to Table Storage: {e}")

    # Memory fallback
    _cred_store[f"{tenant_id}:tenant_id"] = tenant_id
    _cred_store[f"{tenant_id}:client_id"] = client_id
    _cred_store[f"{tenant_id}:client_secret"] = client_secret
    logger.info(f"Stored credentials in memory for {tenant_id}")
    return True


def load_tenant_credentials(tenant_id: str) -> dict | None:
    """Load tenant credentials from Table Storage or memory fallback.

    Returns dict with tenant_id, client_id, client_secret or None.
    """
    table = _get_creds_table_client()
    if table:
        try:
            entity = table.get_entity(partition_key="tenants", row_key=tenant_id)
            creds = {
                "tenant_id": entity.get("tenant_id", ""),
                "client_id": entity.get("client_id", ""),
                "client_secret": entity.get("client_secret", ""),
            }
            if creds.get("tenant_id"):
                return creds
        except Exception as e:
            logger.debug(f"No credentials in Table Storage for {tenant_id}: {e}")

    # Memory fallback
    creds = {
        "tenant_id": _cred_store.get(f"{tenant_id}:tenant_id", ""),
        "client_id": _cred_store.get(f"{tenant_id}:client_id", ""),
        "client_secret": _cred_store.get(f"{tenant_id}:client_secret", ""),
    }
    if creds.get("tenant_id"):
        return creds
    return None


def delete_tenant_credentials(tenant_id: str) -> bool:
    """Remove stored credentials for a tenant."""
    table = _get_creds_table_client()
    if table:
        try:
            table.delete_entity(partition_key="tenants", row_key=tenant_id)
            logger.info(f"Deleted credentials from Table Storage for {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to delete credentials from Table Storage: {e}")

    # Also clean memory
    for suffix in ("tenant_id", "client_id", "client_secret"):
        _cred_store.pop(f"{tenant_id}:{suffix}", None)
    return True


# ---------------------------------------------------------------------------
# Tenant metadata storage (Table Storage primary, memory fallback)
# ---------------------------------------------------------------------------

def save_tenant_metadata(tenant_id: str, display_name: str, domain: str = "") -> bool:
    """Store tenant metadata in Table Storage or memory."""
    table = _get_table_client("tenants")
    if table:
        try:
            entity = {
                "PartitionKey": "tenants",
                "RowKey": tenant_id,
                "tenant_id": tenant_id,
                "display_name": display_name,
                "domain": domain,
                "connected_at": datetime.now(timezone.utc).isoformat(),
            }
            table.upsert_entity(entity)
            logger.info(f"Stored tenant metadata for {tenant_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save tenant metadata: {e}")

    # Memory fallback
    _tenant_mem_store[tenant_id] = {
        "id": tenant_id,
        "name": display_name,
        "domain": domain,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    return True


def load_all_tenants() -> list[dict]:
    """Load all connected tenants from Table Storage or memory."""
    tenants = []
    table = _get_table_client("tenants")
    if table:
        try:
            entities = table.query_entities("PartitionKey eq 'tenants'")
            for e in entities:
                tenants.append({
                    "id": e.get("RowKey", e.get("tenant_id", "")),
                    "name": e.get("display_name", e.get("RowKey", "")),
                    "domain": e.get("domain", ""),
                    "connected_at": e.get("connected_at", ""),
                    "real": True,
                })
            if tenants:
                return tenants
        except Exception as e:
            logger.error(f"Failed to query tenants: {e}")

    # Memory fallback
    if _tenant_mem_store:
        return [{"id": tid, "name": t.get("name", tid), "domain": t.get("domain", ""),
                 "connected_at": t.get("connected_at", ""), "real": True}
                for tid, t in _tenant_mem_store.items()]
    return []


def delete_tenant_metadata(tenant_id: str) -> bool:
    """Remove tenant metadata."""
    table = _get_table_client("tenants")
    if table:
        try:
            table.delete_entity(partition_key="tenants", row_key=tenant_id)
        except Exception as e:
            logger.error(f"Failed to delete tenant metadata: {e}")
    _tenant_mem_store.pop(tenant_id, None)
    return True


# ---------------------------------------------------------------------------
# GraphClient (ported from v1 — MSAL client creds, retry, pagination, CSV)
# ---------------------------------------------------------------------------

def _parse_csv(text: str) -> list[dict]:
    """Parse CSV text (from Graph reports) into a list of dicts."""
    text = text.lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


class GraphClient:
    """Microsoft Graph API client with MSAL token caching, automatic retry,
    and transparent pagination support.
    """

    def __init__(self, tenant_id: str, client_id: str, client_secret: str, label: str = ""):
        if not msal:
            raise RuntimeError("msal package not installed")
        self.label = label
        self.token: str | None = None
        self.token_expires: float = 0
        self._app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )

    def _ensure_token(self):
        """Acquire or refresh the client credentials token."""
        if self.token and time.time() < self.token_expires - 60:
            return
        result = self._app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        if "access_token" not in result:
            error = result.get("error_description", result.get("error", "Unknown error"))
            raise RuntimeError(f"[{self.label}] Auth failed: {error}")
        self.token = result["access_token"]
        self.token_expires = time.time() + result.get("expires_in", 3600)

    def _headers(self) -> dict:
        self._ensure_token()
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def get(self, url: str, params: dict | None = None) -> dict:
        return self._request("GET", url, params=params)

    def post(self, url: str, json_body: dict | None = None) -> dict:
        return self._request("POST", url, json_body=json_body)

    def _request(self, method: str, url: str, params=None, json_body=None, retries: int = 5) -> dict | str:
        """Execute an HTTP request with retry on 429/5xx errors."""
        if not url.startswith("http"):
            url = f"{GRAPH_BASE}{url}"
        for attempt in range(retries):
            resp = requests.request(
                method, url, headers=self._headers(),
                params=params, json=json_body, timeout=30,
            )
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2 ** attempt))
                logger.warning(f"[{self.label}] 429 on {url}, retrying in {retry_after}s")
                time.sleep(retry_after)
                continue
            if resp.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"[{self.label}] {method} {url} -> {resp.status_code}: {resp.text[:500]}"
                )
            content_type = resp.headers.get("Content-Type", "")
            if "text/csv" in content_type or "application/octet-stream" in content_type:
                return resp.text
            return resp.json() if resp.content else {}
        raise RuntimeError(f"[{self.label}] {method} {url} failed after {retries} retries")

    def get_all_pages(self, url: str, params: dict | None = None) -> list:
        """Follow @odata.nextLink to collect all pages of results."""
        results = []
        while url:
            data = self.get(url, params=params)
            if isinstance(data, str):
                return [data]
            results.extend(data.get("value", []))
            url = data.get("@odata.nextLink")
            params = None
        return results

    def get_csv(self, url: str, params: dict | None = None) -> list[dict]:
        """Fetch a Graph reports endpoint that returns CSV and parse to list of dicts."""
        raw = self._request("GET", url, params=params)
        if isinstance(raw, str):
            return _parse_csv(raw)
        if isinstance(raw, dict) and "value" in raw:
            return raw["value"]
        return []


# ---------------------------------------------------------------------------
# Microsoft API Integration Functions (ported from v1)
# ---------------------------------------------------------------------------

def fetch_copilot_usage(graph_client: GraphClient, period: str = "D7") -> list[dict]:
    """Fetch Microsoft 365 Copilot usage user detail report (beta endpoint)."""
    try:
        url = f"{GRAPH_BETA}/reports/getMicrosoft365CopilotUsageUserDetail(period='{period}')"
        return graph_client.get_csv(url)
    except RuntimeError as e:
        if "403" in str(e):
            logger.warning(f"Copilot usage report 403 — insufficient permissions: {e}")
            return [{"error": "insufficient_permissions",
                      "message": "The app registration needs Reports.Read.All permission."}]
        logger.error(f"Failed to fetch Copilot usage: {e}")
        return [{"error": "api_error", "message": str(e)}]


def fetch_copilot_user_count_trend(graph_client: GraphClient, period: str = "D30") -> list[dict]:
    """Fetch Copilot user count trend report (beta endpoint)."""
    try:
        url = f"{GRAPH_BETA}/reports/getMicrosoft365CopilotUserCountTrend(period='{period}')"
        return graph_client.get_csv(url)
    except RuntimeError as e:
        if "403" in str(e):
            logger.warning(f"Copilot trend report 403: {e}")
            return [{"error": "insufficient_permissions",
                      "message": "Reports.Read.All permission required."}]
        logger.error(f"Failed to fetch Copilot trend: {e}")
        return [{"error": "api_error", "message": str(e)}]


def _get_dataverse_token(tenant_id: str, client_id: str, client_secret: str, env_url: str) -> str | None:
    """Get a Dataverse access token via client credentials."""
    try:
        dv_app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )
        result = dv_app.acquire_token_for_client(scopes=[f"{env_url}/.default"])
        return result.get("access_token")
    except Exception as e:
        logger.error(f"Failed to get Dataverse token: {e}")
        return None


def fetch_power_platform_environments(tenant_id: str, client_id: str, client_secret: str) -> list[dict]:
    """Discover Power Platform environments in a tenant."""
    # Try Power Platform API
    try:
        pp_app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )
        result = pp_app.acquire_token_for_client(scopes=["https://api.powerplatform.com/.default"])
        if "access_token" in result:
            token = result["access_token"]
            resp = requests.get(
                "https://api.powerplatform.com/appmanagement/environments",
                params={"api-version": "2023-06-01"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            if resp.status_code < 400:
                data = resp.json()
                envs = data.get("value", data.get("environments", []))
                if envs:
                    return envs
    except Exception as e:
        logger.warning(f"Power Platform API failed (trying Dataverse discovery): {e}")

    # Fallback: GlobalDiscovery
    try:
        gd_app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )
        result = gd_app.acquire_token_for_client(scopes=["https://globaldisco.crm.dynamics.com/.default"])
        if "access_token" in result:
            token = result["access_token"]
            resp = requests.get(
                "https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            if resp.status_code < 400:
                instances = resp.json().get("value", [])
                return [{"id": inst.get("EnvironmentId", inst.get("Id", "")),
                          "properties": {"displayName": inst.get("FriendlyName", ""),
                                          "linkedEnvironmentMetadata": {"instanceApiUrl": inst.get("ApiUrl", "")}},
                          "apiUrl": inst.get("ApiUrl", ""),
                          "friendlyName": inst.get("FriendlyName", "")}
                         for inst in instances]
            else:
                logger.warning(f"GlobalDiscovery returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Dataverse GlobalDiscovery failed: {e}")

    return []


def fetch_copilot_agents_dataverse(tenant_id: str, client_id: str, client_secret: str,
                                     env_url: str) -> list[dict]:
    """Discover Copilot Studio agents via Dataverse Web API (bot entity)."""
    try:
        token = _get_dataverse_token(tenant_id, client_id, client_secret, env_url)
        if not token:
            return [{"error": "auth_failed",
                      "message": "Could not authenticate to Dataverse."}]

        resp = requests.get(
            f"{env_url}/api/data/v9.2/bots",
            params={"$select": "name,botid,schemaname,language,createdon,modifiedon,publishedon,statuscode,"
                               "applicationmanifestinformation,configuration",
                    "$orderby": "modifiedon desc"},
            headers={"Authorization": f"Bearer {token}",
                     "OData-MaxVersion": "4.0",
                     "OData-Version": "4.0",
                     "Accept": "application/json"},
            timeout=30,
        )
        if resp.status_code == 403:
            return [{"error": "insufficient_permissions",
                      "message": "Dataverse access denied. Register the app as an Application User."}]
        if resp.status_code >= 400:
            return [{"error": "api_error", "message": f"Dataverse HTTP {resp.status_code}: {resp.text[:300]}"}]

        bots = resp.json().get("value", [])
        STATUS_MAP = {0: "inactive", 1: "active", 2: "inactive", 3: "draft"}
        agents = []
        for bot in bots:
            raw_status = bot.get("statuscode", 0)
            agents.append({
                "id": bot.get("botid", ""),
                "name": bot.get("name", "Unknown Agent"),
                "schemaName": bot.get("schemaname", ""),
                "language": bot.get("language", ""),
                "platform": "Copilot Studio",
                "createdOn": bot.get("createdon", ""),
                "modifiedOn": bot.get("modifiedon", ""),
                "publishedOn": bot.get("publishedon", ""),
                "lastActive": bot.get("modifiedon", ""),
                "status": STATUS_MAP.get(raw_status, f"unknown ({raw_status})"),
                "invocations7d": 0,  # Will be enriched by analytics
                "successRate": 0,
                "avgLatencyMs": 0,
            })
        return agents

    except Exception as e:
        logger.error(f"Failed to fetch agents from Dataverse: {e}")
        return [{"error": "exception", "message": str(e)}]


def fetch_agent_analytics_dataverse(tenant_id: str, client_id: str, client_secret: str,
                                      env_url: str, bot_id: str,
                                      days: int = 90) -> dict:
    """Fetch conversation analytics for a specific bot from Dataverse conversationtranscript table."""
    try:
        token = _get_dataverse_token(tenant_id, client_id, client_secret, env_url)
        if not token:
            return {"error": "auth_failed", "message": "Could not authenticate to Dataverse."}

        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")

        params = {
            "$filter": f"_bot_conversationtranscriptid_value eq '{bot_id}' and createdon ge {cutoff}",
            "$select": "conversationtranscriptid,createdon,metadata,content,schematype,conversationstarttime",
            "$orderby": "createdon desc",
            "$count": "true",
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "Accept": "application/json",
            "Prefer": "odata.include-annotations=*,odata.maxpagesize=5000",
        }

        resp = requests.get(
            f"{env_url}/api/data/v9.2/conversationtranscripts",
            params=params, headers=headers, timeout=30,
        )

        if resp.status_code == 400:
            params["$filter"] = f"bot_conversationtranscriptid eq '{bot_id}' and createdon ge {cutoff}"
            resp = requests.get(
                f"{env_url}/api/data/v9.2/conversationtranscripts",
                params=params, headers=headers, timeout=30,
            )

        if resp.status_code >= 400:
            return {"error": "api_error", "status": resp.status_code,
                    "message": f"Dataverse HTTP {resp.status_code}: {resp.text[:500]}"}

        transcripts = resp.json().get("value", [])
        total_count = resp.json().get("@odata.count", len(transcripts))

        sessions_by_date = {}
        outcomes = {"resolved": 0, "escalated": 0, "abandoned": 0, "unknown": 0}

        for t in transcripts:
            created = t.get("createdon", t.get("conversationstarttime", ""))
            if created:
                date_key = created[:10]
                sessions_by_date[date_key] = sessions_by_date.get(date_key, 0) + 1

            meta_str = t.get("metadata", "") or ""
            content_str = t.get("content", "") or ""
            combined = (meta_str + content_str).lower()

            if "escalat" in combined or "transfer" in combined:
                outcomes["escalated"] += 1
            elif "resolv" in combined or "complet" in combined:
                outcomes["resolved"] += 1
            elif "abandon" in combined or "timeout" in combined:
                outcomes["abandoned"] += 1
            else:
                outcomes["unknown"] += 1

        sorted_dates = sorted(sessions_by_date.keys())
        time_series = [{"date": d, "sessions": sessions_by_date[d]} for d in sorted_dates]

        engaged = outcomes["resolved"] + outcomes["escalated"]
        engagement_rate = round((engaged / total_count * 100), 1) if total_count > 0 else 0
        escalation_rate = round((outcomes["escalated"] / total_count * 100), 1) if total_count > 0 else 0

        active_days = len(sessions_by_date)
        avg_daily_sessions = round(total_count / max(active_days, 1), 1)

        return {
            "total_sessions": total_count,
            "engagement_rate": engagement_rate,
            "escalation_rate": escalation_rate,
            "avg_daily_sessions": avg_daily_sessions,
            "active_days": active_days,
            "outcomes": outcomes,
            "time_series": time_series,
            "period_days": days,
        }

    except Exception as e:
        logger.error(f"Failed to fetch agent analytics from Dataverse: {e}")
        return {"error": "exception", "message": str(e)}


# ---------------------------------------------------------------------------
# Helper: create GraphClient from stored credentials
# ---------------------------------------------------------------------------

def _graph_client_for_tenant(tenant_id: str) -> GraphClient | None:
    """Load credentials and create a GraphClient, or return None."""
    creds = load_tenant_credentials(tenant_id)
    if not creds:
        return None
    try:
        return GraphClient(
            tenant_id=creds["tenant_id"],
            client_id=creds["client_id"],
            client_secret=creds["client_secret"],
            label=tenant_id[:8],
        )
    except Exception as e:
        logger.error(f"Failed to create GraphClient for {tenant_id}: {e}")
        return None


# ---------------------------------------------------------------------------
# Mock / seed data (kept as fallbacks)
# ---------------------------------------------------------------------------
MOCK_TENANTS = [
    {"id": "tenant-contoso", "name": "Contoso Ltd", "domain": "contoso.onmicrosoft.com", "seats": 12500},
    {"id": "tenant-fabrikam", "name": "Fabrikam Inc", "domain": "fabrikam.onmicrosoft.com", "seats": 8200},
    {"id": "tenant-northwind", "name": "Northwind Traders", "domain": "northwind.onmicrosoft.com", "seats": 3400},
]


def _trend_series(days=30, base=100, noise=15):
    return [
        {"date": (datetime.utcnow() - timedelta(days=days - i)).strftime("%b %d"), "value": base + random.randint(-noise, noise) + i * 2}
        for i in range(days)
    ]


def _overview_mock(tid):
    t = next((t for t in MOCK_TENANTS if t["id"] == tid), MOCK_TENANTS[0])
    seats = t.get("seats", 5000)
    active = int(seats * random.uniform(0.55, 0.78))
    return {
        "tenantId": tid,
        "dataSource": "mock",
        "kpis": [
            {"label": "Active Copilot Users", "value": active, "trend": round(random.uniform(3, 12), 1), "unit": "users", "direction": "up"},
            {"label": "Adoption Score", "value": round(random.uniform(62, 88), 1), "trend": round(random.uniform(1, 6), 1), "unit": "%", "direction": "up"},
            {"label": "User Satisfaction", "value": round(random.uniform(3.8, 4.6), 1), "trend": round(random.uniform(-0.5, 0.8), 1), "unit": "/ 5", "direction": "up" if random.random() > 0.3 else "down"},
        ],
        "actions": [
            {"title": "Licenses to assign", "count": random.randint(20, 200), "severity": "warning", "cta": "Assign now"},
            {"title": "Agents need approval", "count": random.randint(0, 12), "severity": "info", "cta": "Review"},
            {"title": "Security alerts", "count": random.randint(0, 5), "severity": "critical" if random.random() > 0.6 else "warning", "cta": "Investigate"},
        ],
        "charts": {
            "dailyActiveUsers": _trend_series(30, active // 30, active // 60),
            "adoptionOverTime": _trend_series(30, 60, 8),
            "queriesPerDay": _trend_series(30, 4500, 800),
            "satisfactionTrend": [{"date": (datetime.utcnow() - timedelta(days=30 - i)).strftime("%b %d"), "value": round(random.uniform(3.6, 4.7), 1)} for i in range(30)],
        },
    }


def _agents_mock(tid):
    platforms = ["Microsoft 365", "Teams", "SharePoint", "Power Platform", "Custom"]
    statuses = ["active", "active", "active", "inactive", "pending"]
    agents = []
    for i in range(1, 16):
        agents.append({
            "id": f"agent-{i:03d}",
            "name": f"Agent {random.choice(['Helper','Analyst','Writer','Researcher','Summarizer','Coder','Planner'])} {i}",
            "platform": random.choice(platforms),
            "status": random.choice(statuses),
            "invocations7d": random.randint(50, 5000),
            "successRate": round(random.uniform(0.88, 0.998), 3),
            "avgLatencyMs": random.randint(120, 2400),
            "lastActive": (datetime.utcnow() - timedelta(hours=random.randint(0, 72))).isoformat() + "Z",
        })
    trending = sorted(agents, key=lambda a: a["invocations7d"], reverse=True)[:5]
    return {"tenantId": tid, "dataSource": "mock", "agents": agents, "trending": trending,
            "platformBreakdown": {p: sum(1 for a in agents if a["platform"] == p) for p in platforms}}


def _usage_mock(tid):
    return {
        "tenantId": tid,
        "dataSource": "mock",
        "totalQueries30d": random.randint(80000, 250000),
        "avgQueriesPerUser": round(random.uniform(12, 45), 1),
        "topFeatures": [
            {"name": "Summarize", "usage": random.randint(20000, 60000)},
            {"name": "Draft", "usage": random.randint(15000, 50000)},
            {"name": "Analyze", "usage": random.randint(10000, 40000)},
            {"name": "Search", "usage": random.randint(8000, 35000)},
            {"name": "Code", "usage": random.randint(5000, 25000)},
        ],
        "usageTrend": _trend_series(30, 5000, 1200),
    }


def _health_mock(tid):
    return {
        "tenantId": tid,
        "dataSource": "mock",
        "overallStatus": random.choice(["healthy", "healthy", "degraded"]),
        "services": [
            {"name": "Copilot Core", "status": "healthy", "uptime": round(random.uniform(99.5, 99.99), 2)},
            {"name": "Graph Connector", "status": random.choice(["healthy", "healthy", "degraded"]), "uptime": round(random.uniform(98.0, 99.99), 2)},
            {"name": "Search Index", "status": "healthy", "uptime": round(random.uniform(99.0, 99.99), 2)},
            {"name": "Agent Runtime", "status": random.choice(["healthy", "degraded"]), "uptime": round(random.uniform(97.0, 99.99), 2)},
        ],
        "latencyP50Ms": random.randint(180, 400),
        "latencyP99Ms": random.randint(800, 2500),
        "errorRate": round(random.uniform(0.1, 2.5), 2),
    }


def _security_mock(tid):
    return {
        "tenantId": tid,
        "dataSource": "mock",
        "overallScore": random.randint(65, 95),
        "dlpPolicies": random.randint(3, 12),
        "dlpViolations30d": random.randint(0, 45),
        "sensitivityLabels": random.randint(5, 20),
        "riskAlerts": [
            {"level": "high", "message": "Oversharing detected in 3 agents", "date": (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"},
            {"level": "medium", "message": "2 agents accessing external data without review", "date": (datetime.utcnow() - timedelta(days=3)).isoformat() + "Z"},
        ],
        "complianceChecks": [
            {"name": "DLP Enforcement", "passed": True},
            {"name": "Data Residency", "passed": True},
            {"name": "Agent Permissions Audit", "passed": random.choice([True, False])},
            {"name": "Sensitivity Label Coverage", "passed": random.choice([True, False])},
        ],
    }


# ---------------------------------------------------------------------------
# Real data fetchers for endpoints
# ---------------------------------------------------------------------------

def _overview_real(tid: str, graph_client: GraphClient) -> dict:
    """Fetch real overview data from Graph API."""
    result = {
        "tenantId": tid,
        "dataSource": "live",
        "kpis": [],
        "actions": [],
        "charts": {},
    }

    # 1. Active Copilot Users (beta report)
    active_users = 0
    try:
        usage_rows = fetch_copilot_usage(graph_client, "D7")
        if usage_rows and not usage_rows[0].get("error"):
            active_users = len(usage_rows)
    except Exception as e:
        logger.warning(f"Failed to fetch copilot usage for overview: {e}")

    # 2. License info from subscribedSkus
    total_licenses = 0
    assigned_licenses = 0
    copilot_sku_keywords = ["copilot", "microsoft_365_copilot", "microsoft365_copilot"]
    try:
        skus = graph_client.get(f"{GRAPH_BASE}/subscribedSkus")
        for sku in skus.get("value", []):
            sku_name = (sku.get("skuPartNumber", "") or "").lower()
            if any(kw in sku_name for kw in copilot_sku_keywords):
                for plan in sku.get("prepaidUnits", {}).values():
                    if isinstance(plan, int):
                        total_licenses += plan
                enabled = sku.get("prepaidUnits", {}).get("enabled", 0)
                total_licenses = max(total_licenses, enabled)
                assigned_licenses += sku.get("consumedUnits", 0)
    except Exception as e:
        logger.warning(f"Failed to fetch subscribedSkus: {e}")

    # 3. User count trend for week-over-week delta
    trend_pct = 0.0
    try:
        trend_data = fetch_copilot_user_count_trend(graph_client, "D30")
        if trend_data and len(trend_data) >= 14 and not trend_data[0].get("error"):
            # Compare last 7 days vs previous 7 days
            recent = trend_data[-7:]
            previous = trend_data[-14:-7]

            def _sum_users(rows):
                total = 0
                for r in rows:
                    for k, v in r.items():
                        if "count" in k.lower() and v:
                            try:
                                total += int(v)
                            except (ValueError, TypeError):
                                pass
                return total

            recent_sum = _sum_users(recent)
            prev_sum = _sum_users(previous)
            if prev_sum > 0:
                trend_pct = round((recent_sum - prev_sum) / prev_sum * 100, 1)
    except Exception as e:
        logger.warning(f"Failed to compute trend: {e}")

    unassigned = max(0, total_licenses - assigned_licenses)

    result["kpis"] = [
        {"label": "Active Copilot Users", "value": active_users,
         "trend": trend_pct, "unit": "users",
         "direction": "up" if trend_pct >= 0 else "down"},
        {"label": "Copilot Licenses", "value": f"{assigned_licenses}/{total_licenses}",
         "trend": 0, "unit": "assigned",
         "direction": "neutral"},
        {"label": "Adoption Rate",
         "value": round(active_users / max(assigned_licenses, 1) * 100, 1),
         "trend": trend_pct, "unit": "%",
         "direction": "up" if trend_pct >= 0 else "down"},
    ]

    result["actions"] = [
        {"title": "Unassigned licenses", "count": unassigned,
         "severity": "warning" if unassigned > 0 else "info", "cta": "Assign now"},
    ]

    # Build trend chart from real data
    try:
        trend_data = fetch_copilot_user_count_trend(graph_client, "D30")
        if trend_data and not trend_data[0].get("error"):
            dau_chart = []
            for row in trend_data:
                date_val = row.get("Report Date", row.get("reportDate", ""))
                count_val = 0
                for k, v in row.items():
                    if "count" in k.lower() and v:
                        try:
                            count_val += int(v)
                        except (ValueError, TypeError):
                            pass
                if date_val:
                    dau_chart.append({"date": date_val, "value": count_val})
            result["charts"]["dailyActiveUsers"] = dau_chart
    except Exception:
        pass

    return result


def _agents_real(tid: str, creds: dict) -> dict:
    """Fetch real agent data from Dataverse."""
    result = {
        "tenantId": tid,
        "dataSource": "live",
        "agents": [],
        "trending": [],
        "platformBreakdown": {},
        "environments": [],
    }

    tenant_id = creds["tenant_id"]
    client_id = creds["client_id"]
    client_secret = creds["client_secret"]

    # Discover environments
    envs = fetch_power_platform_environments(tenant_id, client_id, client_secret)
    result["environments"] = [{"id": e.get("id", ""), "name": e.get("friendlyName", e.get("properties", {}).get("displayName", ""))} for e in envs if not e.get("error")]

    all_agents = []
    for env in envs:
        if env.get("error"):
            continue
        api_url = env.get("apiUrl", "")
        if not api_url:
            props = env.get("properties", {})
            meta = props.get("linkedEnvironmentMetadata", {})
            api_url = meta.get("instanceApiUrl", "")
        if not api_url:
            continue

        agents = fetch_copilot_agents_dataverse(tenant_id, client_id, client_secret, api_url)
        for agent in agents:
            if agent.get("error"):
                continue
            agent["environment"] = env.get("friendlyName", env.get("id", ""))
            agent["environmentUrl"] = api_url
            all_agents.append(agent)

    result["agents"] = all_agents
    result["trending"] = sorted(all_agents, key=lambda a: a.get("modifiedOn", ""), reverse=True)[:5]

    platforms = {}
    for a in all_agents:
        p = a.get("platform", "Copilot Studio")
        platforms[p] = platforms.get(p, 0) + 1
    result["platformBreakdown"] = platforms

    return result


def _usage_real(tid: str, graph_client: GraphClient) -> dict:
    """Fetch real usage data from Graph Copilot reports."""
    result = {
        "tenantId": tid,
        "dataSource": "live",
        "totalQueries30d": 0,
        "avgQueriesPerUser": 0,
        "topFeatures": [],
        "usageTrend": [],
        "appBreakdown": {},
    }

    try:
        usage_rows = fetch_copilot_usage(graph_client, "D30")
        if not usage_rows or usage_rows[0].get("error"):
            return result

        total_users = len(usage_rows)
        result["totalQueries30d"] = total_users  # Each row = one active user in period

        # Parse per-app usage columns from the CSV
        # Typical columns: Microsoft Teams, Word, Excel, PowerPoint, Outlook, OneNote, Loop, Copilot chat
        app_counts = {}
        app_keys = ["Microsoft Teams", "Word", "Excel", "PowerPoint", "Outlook",
                     "OneNote", "Loop", "Copilot chat", "Microsoft Copilot"]

        for row in usage_rows:
            for app_key in app_keys:
                # Check various column name patterns
                for col_name, col_val in row.items():
                    if app_key.lower() in col_name.lower() and col_val:
                        # Column might be a date (last activity) or a count
                        try:
                            count = int(col_val)
                            app_counts[app_key] = app_counts.get(app_key, 0) + count
                        except (ValueError, TypeError):
                            # Might be a date like "2024-01-15" indicating the app was used
                            if col_val and col_val != "No activity":
                                app_counts[app_key] = app_counts.get(app_key, 0) + 1

        result["appBreakdown"] = app_counts
        result["topFeatures"] = [{"name": k, "usage": v}
                                  for k, v in sorted(app_counts.items(), key=lambda x: x[1], reverse=True)]

        if total_users > 0:
            total_interactions = sum(app_counts.values())
            result["avgQueriesPerUser"] = round(total_interactions / total_users, 1)
            result["totalQueries30d"] = total_interactions

    except Exception as e:
        logger.error(f"Failed to fetch real usage data: {e}")

    # Usage trend from user count trend
    try:
        trend_data = fetch_copilot_user_count_trend(graph_client, "D30")
        if trend_data and not trend_data[0].get("error"):
            for row in trend_data:
                date_val = row.get("Report Date", row.get("reportDate", ""))
                count_val = 0
                for k, v in row.items():
                    if "count" in k.lower() and v:
                        try:
                            count_val += int(v)
                        except (ValueError, TypeError):
                            pass
                if date_val:
                    result["usageTrend"].append({"date": date_val, "value": count_val})
    except Exception:
        pass

    return result


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.route("/api/tenants", methods=["GET"])
def api_tenants_list():
    """List connected tenants, falling back to mock data."""
    real_tenants = load_all_tenants()
    if real_tenants:
        return jsonify(real_tenants)
    return jsonify(MOCK_TENANTS)


@app.route("/api/tenants", methods=["POST"])
def api_tenants_connect():
    """Connect a new tenant by validating credentials and storing them."""
    body = request.get_json(silent=True) or {}
    tenant_id = body.get("tenant_id", "").strip()
    client_id = body.get("client_id", "").strip()
    client_secret = body.get("client_secret", "").strip()
    display_name = body.get("display_name", "").strip() or tenant_id

    if not all([tenant_id, client_id, client_secret]):
        return jsonify({"error": "Missing required fields: tenant_id, client_id, client_secret"}), 400

    # Validate credentials by trying to get a Graph token
    if not msal:
        return jsonify({"error": "msal package not installed on server"}), 500

    try:
        test_app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )
        result = test_app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        if "access_token" not in result:
            error_msg = result.get("error_description", result.get("error", "Unknown error"))
            return jsonify({"error": "Authentication failed", "details": error_msg}), 401
    except Exception as e:
        return jsonify({"error": "Authentication failed", "details": str(e)}), 401

    # Store credentials and metadata
    save_tenant_credentials(tenant_id, client_id, client_secret)
    save_tenant_metadata(tenant_id, display_name)

    return jsonify({
        "status": "connected",
        "tenant_id": tenant_id,
        "display_name": display_name,
        "message": "Tenant connected successfully. Graph API token validated.",
    }), 201


@app.route("/api/tenants/<tid>", methods=["DELETE"])
def api_tenants_disconnect(tid):
    """Disconnect a tenant by removing credentials and metadata."""
    delete_tenant_credentials(tid)
    delete_tenant_metadata(tid)
    return jsonify({"status": "disconnected", "tenant_id": tid})


@app.route("/api/tenants/<tid>/test", methods=["POST"])
def api_tenant_test(tid):
    """Test connection for a tenant."""
    creds = load_tenant_credentials(tid)
    if not creds:
        return jsonify({"status": "error", "message": "No credentials stored for this tenant"}), 404

    try:
        test_app = msal.ConfidentialClientApplication(
            creds["client_id"],
            authority=f"https://login.microsoftonline.com/{creds['tenant_id']}",
            client_credential=creds["client_secret"],
        )
        result = test_app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        if "access_token" in result:
            # Try a simple Graph call
            token = result["access_token"]
            resp = requests.get(
                f"{GRAPH_BASE}/organization",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            org_info = {}
            if resp.status_code < 400:
                orgs = resp.json().get("value", [])
                if orgs:
                    org_info = {
                        "displayName": orgs[0].get("displayName", ""),
                        "verifiedDomains": [d.get("name", "") for d in orgs[0].get("verifiedDomains", [])],
                    }
            return jsonify({
                "status": "connected",
                "tenant_id": tid,
                "graph_token": True,
                "organization": org_info,
                "expires_in": result.get("expires_in", 0),
            })
        else:
            return jsonify({
                "status": "error",
                "message": result.get("error_description", result.get("error", "Unknown")),
            }), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/tenants/<tid>/overview")
def api_overview(tid):
    """Overview data — real when credentials available, mock fallback."""
    graph_client = _graph_client_for_tenant(tid)
    if graph_client:
        try:
            return jsonify(_overview_real(tid, graph_client))
        except Exception as e:
            logger.error(f"Real overview failed for {tid}, falling back to mock: {e}")
    return jsonify(_overview_mock(tid))


@app.route("/api/tenants/<tid>/agents")
def api_agents(tid):
    """Agent data — real when credentials available, mock fallback."""
    creds = load_tenant_credentials(tid)
    if creds:
        try:
            return jsonify(_agents_real(tid, creds))
        except Exception as e:
            logger.error(f"Real agents failed for {tid}, falling back to mock: {e}")
    return jsonify(_agents_mock(tid))


@app.route("/api/tenants/<tid>/usage")
def api_usage(tid):
    """Usage data — real when credentials available, mock fallback."""
    graph_client = _graph_client_for_tenant(tid)
    if graph_client:
        try:
            return jsonify(_usage_real(tid, graph_client))
        except Exception as e:
            logger.error(f"Real usage failed for {tid}, falling back to mock: {e}")
    return jsonify(_usage_mock(tid))


@app.route("/api/tenants/<tid>/health")
def api_health(tid):
    """Health data — mock for now (needs Intune/Service Health APIs)."""
    return jsonify(_health_mock(tid))


@app.route("/api/tenants/<tid>/security")
def api_security(tid):
    """Security data — mock for now (needs Purview APIs)."""
    return jsonify(_security_mock(tid))


@app.route("/api/debug/status")
def api_status():
    """Debug status endpoint with storage and tenant info."""
    # Test credential storage
    storage_ok = False
    table = _get_table_client("tenants")
    if table:
        try:
            # Simple query to test connectivity
            list(table.query_entities("PartitionKey eq 'tenants'", results_per_page=1))
            storage_ok = True
        except Exception as e:
            logger.warning(f"Storage test failed: {e}")

    # Count connected tenants
    connected_count = 0
    try:
        real_tenants = load_all_tenants()
        connected_count = len(real_tenants)
    except Exception:
        pass

    return jsonify({
        "status": "ok",
        "version": APP_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "azure_table": table is not None,
        "azure_table_connected": storage_ok,
        "connected_tenants": connected_count,
        "msal_available": msal is not None,
        "storage_conn_string": bool(STORAGE_CONN_STRING),
        "storage_account_name": bool(STORAGE_ACCOUNT_NAME),
        "key_vault_url": bool(KEY_VAULT_URL),
    })


# ---------------------------------------------------------------------------
# SPA catch-all
# ---------------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
