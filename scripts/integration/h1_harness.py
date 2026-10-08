#!/usr/bin/env python3
"""Validate a redacted H1 manifest and emit a deterministic evidence plan."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

SUPPORTED_NODE_COUNTS = (1, 8, 16)
MANIFEST_VERSION = "h1/v2"
CONTRACT_PATH = "contracts/edge-cloud/v2"
PACKET_REFS = ("ricky_c1", "ricky_c2", "jp_e2", "jp_e3", "jp_e4")
DEPENDENCY_REFS = ("agro_io", "h0_evidence", "iot_sensors")
ADAPTER_REFS = ("edge_capture", "cloud_submit", "cloud_verify")
NODE_CODE = re.compile(r"^H[0-9A-F]{4}$")
IMMUTABLE_REF = re.compile(r"^(git:[0-9a-f]{40}|sha256:[0-9a-f]{64})$")
SECRETISH = re.compile(r"(?i)^(ak_|sk_|api[-_]?key|bearer\s+)[A-Za-z0-9._-]{12,}$")
SECRET_REF_PREFIXES = ("PENDING_", "secret://", "vault://", "env://")
FORBIDDEN_SECRET_KEYS = {"api_key", "x-api-key", "x_api_key", "password", "token", "secret"}


class HarnessError(ValueError):
    pass


def _load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"cannot load manifest: {exc}") from exc
    if not isinstance(value, dict):
        raise HarnessError("manifest must be a JSON object")
    return value


def _walk(value: Any, path: str = ""):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _walk(item, f"{path}.{key}" if path else key)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk(item, f"{path}[{index}]")
    else:
        yield path, value


def _validate_refs(manifest: dict[str, Any], blockers: list[str], errors: list[str]) -> None:
    groups = (
        ("packet_refs", PACKET_REFS, True),
        ("dependency_refs", DEPENDENCY_REFS, True),
        ("command_adapters", ADAPTER_REFS, False),
    )
    contract_ref = manifest.get("contract_ref")
    if contract_ref is None:
        blockers.append("missing:contract_ref")
    elif not isinstance(contract_ref, str) or not contract_ref:
        errors.append("contract_ref must be a string reference")
    elif not contract_ref.startswith("PENDING_"):
        if contract_ref != CONTRACT_PATH and IMMUTABLE_REF.fullmatch(contract_ref) is None:
            errors.append(
                f"contract_ref must be {CONTRACT_PATH} or an immutable git: or sha256: reference"
            )
    for group_name, required, immutable in groups:
        group = manifest.get(group_name)
        if not isinstance(group, dict):
            blockers.append(f"missing:{group_name}")
            continue
        for name in required:
            value = group.get(name)
            if value is None:
                blockers.append(f"missing:{group_name}.{name}")
            elif not isinstance(value, str) or not value:
                errors.append(f"{group_name}.{name} must be a string reference")
            elif immutable and not value.startswith("PENDING_"):
                if IMMUTABLE_REF.fullmatch(value) is None:
                    errors.append(f"{group_name}.{name} must be immutable")


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    blockers: list[str] = []
    if manifest.get("manifest_version") != MANIFEST_VERSION:
        errors.append(f"manifest_version must be {MANIFEST_VERSION}")
    gateway_secret_ref = manifest.get("gateway_secret_ref")
    if gateway_secret_ref is None:
        blockers.append("missing:gateway_secret_ref")
    elif not isinstance(gateway_secret_ref, str) or not gateway_secret_ref.startswith(
        SECRET_REF_PREFIXES
    ):
        errors.append("gateway_secret_ref must be a redacted reference")
    expected_count = manifest.get("scenario_nodes")
    nodes = manifest.get("nodes")
    if expected_count not in SUPPORTED_NODE_COUNTS or not isinstance(nodes, list):
        errors.append("scenario_nodes and nodes must describe a supported 1/8/16-node run")
        nodes = []
    elif len(nodes) != expected_count:
        errors.append("nodes length must equal scenario_nodes")
    _validate_refs(manifest, blockers, errors)

    identities = {name: set() for name in ("node_code", "cloud_area_id", "logical_node_id")}
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            errors.append(f"nodes[{index}] must be an object")
            continue
        for field, seen in identities.items():
            value = node.get(field)
            marker = json.dumps(value, sort_keys=True)
            if value is None:
                blockers.append(f"missing:nodes[{index}].{field}")
            elif marker in seen:
                errors.append(f"duplicate {field}")
            else:
                seen.add(marker)
        if NODE_CODE.fullmatch(str(node.get("node_code", ""))) is None:
            errors.append(f"nodes[{index}].node_code has an invalid shape")
        for field in ("cloud_area_id", "logical_node_id"):
            value = node.get(field)
            if value is not None and not (
                isinstance(value, int) and not isinstance(value, bool) and value > 0
            ) and not (isinstance(value, str) and value.startswith("PENDING_")):
                errors.append(f"nodes[{index}].{field} must be a positive ID or placeholder")

    for path, value in _walk(manifest):
        key = path.rsplit(".", 1)[-1].split("[", 1)[0].lower()
        if key in FORBIDDEN_SECRET_KEYS:
            errors.append(f"raw secret field is forbidden: {path}")
        if isinstance(value, str) and value.startswith("PENDING_"):
            blockers.append(f"unresolved:{path}")
        elif isinstance(value, str) and SECRETISH.fullmatch(value):
            errors.append(f"suspicious secret-looking value: {path}")
    if errors:
        raise HarnessError("; ".join(sorted(set(errors))))
    return sorted(set(blockers))


def build_plan(manifest: dict[str, Any], execute: bool = False) -> dict[str, Any]:
    blockers = validate_manifest(manifest)
    if execute:
        blockers.append("execution:command adapter runner is not configured")
    canonical = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    node_count = manifest["scenario_nodes"]
    return {
        "blockers": sorted(set(blockers)),
        "evidence_record_shape": {
            "assertions": [],
            "command": None,
            "exit_status": None,
            "finished_at": None,
            "node_counts": {"manifest": node_count, "observed": None},
            "output": {"max_bytes": 65536, "path": None, "sha256": None},
            "revision_ref": None,
            "started_at": None,
            "status": "not_run",
        },
        "manifest_sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "mode": "execute" if execute else "plan-only",
        "node_codes": [node["node_code"] for node in manifest["nodes"]],
        "node_count": node_count,
        "status": "blocked" if blockers else "ready",
        "steps": [{"adapter_ref": name, "status": "not_run"} for name in ADAPTER_REFS],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--plan-only", action="store_true")
    args = parser.parse_args()
    try:
        plan = build_plan(_load(args.manifest), execute=not args.plan_only)
    except HarnessError as exc:
        print(json.dumps({"errors": str(exc).split("; "), "status": "invalid"}, sort_keys=True))
        return 2
    print(json.dumps(plan, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return 0 if args.plan_only else 2


if __name__ == "__main__":
    raise SystemExit(main())
