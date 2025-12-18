# OpenTelemetry Telemetry Setup

This document explains how to set up OpenTelemetry monitoring for Claude Code sessions in Forge.

## Quick Start

1. **Start the monitoring stack:**

```bash
docker-compose up -d
```

This will start:
- **OpenTelemetry Collector** - Receives telemetry on ports 4317 (gRPC) and 4318 (HTTP)
- **Prometheus** - Stores metrics (accessible at http://localhost:9090)
- **Grafana** - Visualizes metrics (accessible at http://localhost:3000)

2. **Access the dashboards:**

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (username: `admin`, password: `admin`)

3. **Configure Grafana:**

   a. Log in to Grafana at http://localhost:3000
   b. Go to **Configuration** → **Data Sources** → **Add data source**
   c. Select **Prometheus**
   d. Set URL to `http://prometheus:9090`
   e. Click **Save & Test**

4. **Start Forge:**

When you start a Claude Code session in Forge, telemetry will automatically be enabled and metrics will be sent to the collector, which will then be scraped by Prometheus and available for visualization in Grafana.

## Configuration

### Default Configuration

By default, Forge will:
- Enable telemetry for Claude Code sessions
- Send metrics/logs to `http://localhost:4317` using gRPC protocol
- Use OTLP exporters for both metrics and logs

### Customizing the OTEL Endpoint

You can customize the OpenTelemetry endpoint by setting environment variables:

```bash
# Change the endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4317

# Change the protocol (grpc, http/json, or http/protobuf)
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc

# Change exporters (comma-separated)
export OTEL_METRICS_EXPORTER=otlp,prometheus
export OTEL_LOGS_EXPORTER=otlp,console

# Add authentication headers
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your-token"
```

### Docker Compose Configuration

The `docker-compose.yml` file sets up a complete monitoring stack:

**OpenTelemetry Collector:**
- **Receivers**: OTLP (gRPC on port 4317, HTTP on port 4318)
- **Exporters**: Prometheus exporter (port 8889) and debug exporter (for logging)
- **Processors**: Batch processor for efficient data handling

**Prometheus:**
- Scrapes metrics from the OTEL Collector every 15 seconds
- Stores time-series data for querying and alerting
- Accessible at http://localhost:9090

**Grafana:**
- Visualizes metrics from Prometheus
- Pre-configured with admin credentials (admin/admin)
- Accessible at http://localhost:3000

You can customize the collector configuration by editing `otel-collector-config.yaml`. The current setup exports metrics to both Prometheus (for storage/visualization) and debug console (for troubleshooting).

## What Gets Monitored

Claude Code exports the following telemetry data:

### Metrics
- Session count
- Lines of code (added/removed)
- Pull request count
- Commit count
- Cost tracking
- Token usage (input/output/cache)
- Code edit tool decisions
- Active time

### Events/Logs
- User prompts
- Tool results
- API requests
- API errors
- Tool decisions

For more details, see the [Claude Code Monitoring Documentation](https://code.claude.com/docs/en/monitoring-usage).

## Troubleshooting

### Collector Not Receiving Data

1. Check that all services are running:
   ```bash
   docker-compose ps
   ```

2. Check collector logs:
   ```bash
   docker-compose logs otel-collector
   ```

3. Verify the endpoint is correct:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT
   ```

### Prometheus Not Scraping Metrics

1. Check Prometheus targets at http://localhost:9090/targets
2. Verify the `otel-collector` target is UP
3. Check Prometheus logs:
   ```bash
   docker-compose logs prometheus
   ```

### Grafana Can't Connect to Prometheus

1. Verify Prometheus is running: `docker-compose ps prometheus`
2. In Grafana, check the data source configuration:
   - URL should be `http://prometheus:9090` (not `localhost:9090`)
   - Test the connection using "Save & Test" button
3. Check Grafana logs:
   ```bash
   docker-compose logs grafana
   ```

### Telemetry Not Enabled

Telemetry is only enabled for Claude Code sessions. Make sure you're using the "Claude Code" agent, not other agents.

### Port Conflicts

If ports are already in use, you can change them in `docker-compose.yml`:

```yaml
ports:
  - "4319:4317"   # OTLP gRPC
  - "4320:4318"   # OTLP HTTP
  - "9091:9090"   # Prometheus
  - "3001:3000"   # Grafana
```

Then update your `OTEL_EXPORTER_OTLP_ENDPOINT` accordingly.

## Using Grafana Dashboards

### Creating Your First Dashboard

1. In Grafana, go to **Dashboards** → **New Dashboard**
2. Click **Add visualization**
3. Select **Prometheus** as the data source
4. Use PromQL queries to visualize metrics. Example queries:

**Session Count:**
```promql
claude_code_session_count_total
```

**Token Usage by Type:**
```promql
claude_code_token_usage_total{type="input"}
claude_code_token_usage_total{type="output"}
```

**Cost Tracking:**
```promql
claude_code_cost_usage_total
```

**Lines of Code:**
```promql
claude_code_lines_of_code_count_total{type="added"}
claude_code_lines_of_code_count_total{type="removed"}
```

### Example Dashboard Queries

- **Total Sessions**: `sum(claude_code_session_count_total)`
- **Total Cost**: `sum(claude_code_cost_usage_total)`
- **Average Token Usage**: `avg(claude_code_token_usage_total)`
- **Code Edit Acceptance Rate**: `sum(claude_code_code_edit_tool_decision_count_total{decision="accept"}) / sum(claude_code_code_edit_tool_decision_count_total)`

## Advanced Usage

### Exporting to Multiple Backends

You can configure the collector to export to multiple backends simultaneously. Edit `otel-collector-config.yaml`:

```yaml
exporters:
  debug:
    verbosity: detailed
  prometheus:
    endpoint: "0.0.0.0:8889"
  otlp/remote:
    endpoint: "your-remote-collector:4317"
    headers:
      Authorization: "Bearer your-token"

service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug, prometheus, otlp/remote]
```

### Production Setup

For production environments, consider:
- Using a managed OpenTelemetry service (e.g., Datadog, New Relic, Honeycomb)
- Setting up proper authentication headers
- Configuring resource attributes for team/department tracking
- Setting up Grafana alerts for cost thresholds or error rates
- Using persistent volumes for Prometheus and Grafana data
- Configuring Grafana authentication (LDAP, OAuth, etc.)

See the [Claude Code Monitoring Documentation](https://code.claude.com/docs/en/monitoring-usage) for enterprise configuration options.

