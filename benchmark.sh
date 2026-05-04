#!/usr/bin/env bash
set -euo pipefail

LIMIT=""

default_concurrency() {
  getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || echo 4
}

CONCURRENT="${BENCHMARK_CONCURRENCY:-$(default_concurrency)}"

print_help() {
  cat <<'EOF'
Usage:
  ./benchmark.sh [--concurrent N] [--limit N]

Options:
  --concurrent N  Number of Bun worker processes to run, or "auto"
  --limit N       Run only the first N dataset scenarios
  -h, --help      Show this help

Examples:
  ./benchmark.sh
  ./benchmark.sh --concurrent 8
  ./benchmark.sh --limit 25
  ./benchmark.sh --concurrent auto --limit 50
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      print_help
      exit 0
      ;;
    --concurrent)
      CONCURRENT="${2:-}"
      if [ "$CONCURRENT" = "auto" ]; then
        CONCURRENT="$(default_concurrency)"
      fi
      shift 2
      ;;
    --limit)
      LIMIT="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Run ./benchmark.sh --help for usage"
      exit 1
      ;;
  esac
done

CMD=(bun "scripts/benchmark/index.ts" "--concurrent" "$CONCURRENT")

if [ -n "$LIMIT" ]; then
  CMD+=("--limit" "$LIMIT")
fi

"${CMD[@]}"
