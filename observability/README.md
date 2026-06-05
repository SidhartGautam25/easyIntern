# EzyIntern Logging Stack

This stack collects structured Node.js/Pino logs through Grafana Alloy, stores them in Loki, and provisions Grafana with a Loki datasource and starter dashboard.

## Flow

```text
Node.js backend
  -> Pino JSON stdout
  -> Docker json-file logs
  -> Grafana Alloy loki.source.docker
  -> Alloy JSON parsing, labels, structured metadata
  -> Loki
  -> Grafana
```

## Run

```bash
docker compose up -d --build
```

Grafana is exposed on `http://127.0.0.1:3000`.

Default login:

```text
admin / admin
```

Set `GRAFANA_ADMIN_PASSWORD` before production use.

## Important Labels

Alloy only scrapes containers with this Docker label:

```yaml
labels:
  ezyintern.logging: "enabled"
```

The backend has that label. Observability containers are intentionally not scraped by this pipeline.

Low-cardinality Loki labels:

- `service`
- `environment`
- `hostname`
- `level`
- `logType`
- `errorCategory`
- `container`
- `compose_service`
- `stack`

High-cardinality values are kept as structured metadata or JSON fields, not labels:

- `requestId`
- `traceId`
- `path`
- `route`
- `durationMs`

## Useful LogQL

Errors:

```logql
{service="ezyintern-server"} | json | level =~ "error|fatal"
```

One request:

```logql
{service="ezyintern-server"} | json | requestId="REQUEST_ID_HERE"
```

One trace:

```logql
{service="ezyintern-server"} | json | traceId="TRACE_ID_HERE"
```

Errors by category:

```logql
sum by (errorCategory) (count_over_time({service="ezyintern-server", errorCategory!=""}[5m]))
```

HTTP p95 from logs:

```logql
quantile_over_time(0.95, {service="ezyintern-server", logType="http"} | json | unwrap durationMs [5m])
```

## Production Notes

- Keep backend logs as JSON in production. Do not run `NODE_ENV=development` for containers that Alloy scrapes.
- Keep Loki and Alloy ports bound to localhost or private networks unless they sit behind authenticated ingress.
- Keep `requestId` and `traceId` out of labels. They are too high-cardinality for Loki labels.
- Use object storage and distributed Loki when log volume or retention grows beyond a single server.
- Tune `LOKI_RETENTION_PERIOD`, `ingestion_rate_mb`, and Docker log rotation based on real traffic.
- For Kubernetes, keep the same labels and parsing model, but replace `loki.source.docker` with Kubernetes discovery.
