"""AgentPulse-v2 — Copilot Analytics Dashboard (Flask backend)."""

import os
import json
import random
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")

# ---------------------------------------------------------------------------
# Azure clients (lazy-initialised; gracefully degrade to mock data)
# ---------------------------------------------------------------------------
_table_client = None
_blob_client = None
_kv_client = None


def _init_azure():
    global _table_client, _blob_client, _kv_client
    try:
        from azure.identity import DefaultAzureCredential
        credential = DefaultAzureCredential()

        storage = os.getenv("STORAGE_ACCOUNT_NAME")
        kv_url = os.getenv("KEY_VAULT_URL")
        conn_str = os.getenv("STORAGE_CONNECTION_STRING")

        if storage:
            from azure.data.tables import TableServiceClient
            _table_client = TableServiceClient(
                endpoint=f"https://{storage}.table.core.windows.net",
                credential=credential,
            )
        elif conn_str:
            from azure.data.tables import TableServiceClient
            _table_client = TableServiceClient.from_connection_string(conn_str)

        if kv_url:
            from azure.keyvault.secrets import SecretClient
            _kv_client = SecretClient(vault_url=kv_url, credential=credential)
    except Exception as e:
        app.logger.warning(f"Azure init skipped (using mock data): {e}")


_init_azure()

# ---------------------------------------------------------------------------
# Mock / seed data
# ---------------------------------------------------------------------------
TENANTS = [
    {"id": "tenant-contoso", "name": "Contoso Ltd", "domain": "contoso.onmicrosoft.com", "seats": 12500},
    {"id": "tenant-fabrikam", "name": "Fabrikam Inc", "domain": "fabrikam.onmicrosoft.com", "seats": 8200},
    {"id": "tenant-northwind", "name": "Northwind Traders", "domain": "northwind.onmicrosoft.com", "seats": 3400},
]


def _trend_series(days=30, base=100, noise=15):
    return [
        {"date": (datetime.utcnow() - timedelta(days=days - i)).strftime("%b %d"), "value": base + random.randint(-noise, noise) + i * 2}
        for i in range(days)
    ]


def _overview(tid):
    t = next((t for t in TENANTS if t["id"] == tid), TENANTS[0])
    seats = t["seats"]
    active = int(seats * random.uniform(0.55, 0.78))
    return {
        "tenantId": tid,
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


def _agents(tid):
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
    return {"tenantId": tid, "agents": agents, "trending": trending, "platformBreakdown": {p: sum(1 for a in agents if a["platform"] == p) for p in platforms}}


def _usage(tid):
    return {
        "tenantId": tid,
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


def _health(tid):
    return {
        "tenantId": tid,
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


def _security(tid):
    return {
        "tenantId": tid,
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
# API routes
# ---------------------------------------------------------------------------
@app.route("/api/tenants")
def api_tenants():
    return jsonify(TENANTS)


@app.route("/api/tenants/<tid>/overview")
def api_overview(tid):
    return jsonify(_overview(tid))


@app.route("/api/tenants/<tid>/agents")
def api_agents(tid):
    return jsonify(_agents(tid))


@app.route("/api/tenants/<tid>/usage")
def api_usage(tid):
    return jsonify(_usage(tid))


@app.route("/api/tenants/<tid>/health")
def api_health(tid):
    return jsonify(_health(tid))


@app.route("/api/tenants/<tid>/security")
def api_security(tid):
    return jsonify(_security(tid))


@app.route("/api/debug/status")
def api_status():
    return jsonify({
        "status": "ok",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "azure_table": _table_client is not None,
        "azure_kv": _kv_client is not None,
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
